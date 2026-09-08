import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PrintButton from './PrintButton'

export const dynamic = 'force-dynamic'

export default async function RekapTahunanPage({ searchParams }: { searchParams: { year?: string, cat?: string, blok?: string } }) {
  const supabase = createClient()
  const adminClient = createAdminClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const now = new Date()
  const targetYear = searchParams.year ? parseInt(searchParams.year) : now.getFullYear()
  const category = searchParams.cat || 'all'
  const filterBlok = searchParams.blok || 'all'

  // 1. Fetch all residents (warga)
  const { data: wargaList } = await adminClient
    .from('profiles')
    .select('id, full_name, house_number')
    .eq('role', 'user')
    .order('house_number', { ascending: true })

  // 2. Fetch all bills for the target year
  const { data: allBills } = await adminClient
    .from('bills')
    .select('id, profile_id, user_id, period_month, total_amount, water_fee, trash_fee, security_fee, treasury_fee, status')
    .eq('period_year', targetYear)

  let filteredWarga = wargaList || []
  if (filterBlok !== 'all') {
    filteredWarga = filteredWarga.filter(w => w.house_number?.toUpperCase().startsWith(filterBlok.toUpperCase()))
  }

  // Map the bills to their respective residents
  const reportData = filteredWarga.map(warga => {
    // Some older records might use user_id instead of profile_id, accommodate both
    const residentBills = (allBills || []).filter(b => b.profile_id === warga.id || b.user_id === warga.id)
    
    const statuses: Record<number, { status: string, amount: number }> = {}
    let totalTunggakan = 0

    // Initialize all 12 months as NO_BILL
    for (let m = 1; m <= 12; m++) {
      statuses[m] = { status: 'NO_BILL', amount: 0 }
    }

    residentBills.forEach(bill => {
      const month = bill.period_month
      if (month >= 1 && month <= 12) {
        let amount = 0
        
        if (category === 'air') {
          amount = Number(bill.water_fee || 0)
        } else if (category === 'keamanan_sampah') {
          amount = Number(bill.security_fee || 0) + Number(bill.trash_fee || 0)
        } else if (category === 'kas') {
          amount = Number(bill.treasury_fee || 0)
        } else {
          amount = Number(bill.total_amount || 0)
        }

        statuses[month] = {
          status: bill.status,
          amount: amount
        }
        
        if (bill.status !== 'PAID') {
          totalTunggakan += amount
        }
      }
    })

    return {
      warga,
      statuses,
      totalTunggakan
    }
  })

  // Sort by totalTunggakan descending (so people with highest arrears are at the top)
  // or default by house_number (already sorted from DB)
  reportData.sort((a, b) => b.totalTunggakan - a.totalTunggakan || a.warga.house_number.localeCompare(b.warga.house_number))

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
  
  // Calculate summary stats
  const totalWarga = reportData.length
  const wargaMenunggak = reportData.filter(r => r.totalTunggakan > 0).length
  const totalTunggakanKeseluruhan = reportData.reduce((sum, r) => sum + r.totalTunggakan, 0)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar - Disembunyikan saat print */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 print:hidden">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-blue-400">Panel Admin</h2>
          <p className="text-sm text-slate-400 mt-1">Sistem Perumahan</p>
        </div>
        <div className="px-6 mb-6">
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Login sebagai:</p>
            <p className="font-semibold">{profile?.full_name}</p>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <Link href="/admin/dashboard" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Dasbor Utama</Link>
          <Link href="/admin/tunggakan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Kelola Tunggakan</Link>
          <Link href="/admin/warga" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Kelola Warga</Link>
          <Link href="/admin/pengaturan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Pengaturan Tagihan</Link>
          <Link href="/admin/notifikasi" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Log Notifikasi</Link>
          <Link href="/admin/keuangan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Pembukuan</Link>
          <Link href="/admin/laporan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Laporan Bulanan</Link>
          <Link href="/admin/rekap-tahunan" className="block px-4 py-3 rounded-lg bg-blue-600 text-white font-medium">Rekap Tahunan</Link>
          <Link href="/admin/tutup-buku" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Tutup Buku</Link>
        </nav>
        <div className="p-4 border-t border-slate-700">
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="w-full text-left px-4 py-2 text-slate-300 hover:text-white transition">Log Out</button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 bg-white md:bg-slate-50 min-h-screen max-w-full overflow-hidden flex flex-col">
        
        {/* Filter Controls - Hidden when print */}
        <div className="mb-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Laporan Rekap Tahunan Warga</h1>
            <p className="text-slate-500 text-sm mt-1">Status pembayaran tagihan seluruh warga dari bulan Januari hingga Desember.</p>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
            <form className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select name="cat" defaultValue={category} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium">
                <option value="all">Semua Kategori</option>
                <option value="air">Air</option>
                <option value="keamanan_sampah">Keamanan & Sampah</option>
                <option value="kas">Kas RT</option>
              </select>
              <select name="blok" defaultValue={filterBlok} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium">
                <option value="all">Semua Blok</option>
                <option value="A">Blok A</option>
                <option value="B">Blok B</option>
                <option value="K">Komersil</option>
              </select>
              <select name="year" defaultValue={targetYear} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold">
                {[targetYear - 2, targetYear - 1, targetYear, targetYear + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition">Tampilkan</button>
            </form>
            
            <PrintButton />
          </div>
        </div>

        {/* Laporan Kertas (Printable Area) */}
        <div className="bg-white p-0 md:p-6 md:rounded-2xl md:shadow-sm md:border md:border-slate-200 print:shadow-none print:border-none print:p-0 flex-1 overflow-auto">
          
          <div className="text-center mb-6 border-b-2 border-slate-800 pb-4">
            <h1 className="text-2xl font-bold uppercase tracking-wider">Rekapitulasi Tagihan Warga</h1>
            <p className="text-lg mt-1 font-medium">Tahun: {targetYear}</p>
          </div>

          {/* Ringkasan Eksekutif */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl print:border-slate-300 print:bg-transparent text-center">
              <p className="text-xs text-slate-500 font-semibold uppercase mb-1">TOTAL WARGA</p>
              <p className="text-2xl font-bold text-slate-800 print:text-black">{totalWarga}</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl print:border-slate-300 print:bg-transparent text-center">
              <p className="text-xs text-slate-500 font-semibold uppercase mb-1">WARGA MENUNGGAK</p>
              <p className="text-2xl font-bold text-amber-600 print:text-black">{wargaMenunggak}</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl print:border-slate-300 print:bg-transparent text-center">
              <p className="text-xs text-slate-500 font-semibold uppercase mb-1">TOTAL NOMINAL TUNGGAKAN</p>
              <p className="text-2xl font-bold text-rose-600 print:text-black">Rp {totalTunggakanKeseluruhan.toLocaleString('id-ID')}</p>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-4 text-xs font-medium text-slate-500 justify-center print:justify-start">
            <span className="flex items-center gap-1"><span className="text-slate-700 font-bold">50.000</span> = Lunas (Sesuai Nominal)</span>
            <span className="flex items-center gap-1"><span className="text-rose-400 font-bold">0</span> = Belum Lunas (UNPAID/PENDING)</span>
            <span className="flex items-center gap-1"><span className="text-slate-300 font-bold">-</span> = Belum ada tagihan</span>
          </div>

          {/* Rincian Matriks */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg pb-2">
            <table className="w-full text-left text-sm border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-100 print:bg-slate-200 border-b border-slate-300">
                  <th className="p-2 font-semibold border-r border-slate-200 sticky left-0 bg-slate-100 print:bg-transparent z-10 w-8 text-center">No</th>
                  <th className="p-2 font-semibold border-r border-slate-200 sticky left-[40px] bg-slate-100 print:bg-transparent z-10 w-48 truncate">Nama Warga</th>
                  <th className="p-2 font-semibold border-r border-slate-200 text-center w-16">Blok</th>
                  {months.map((m, idx) => (
                    <th key={idx} className="p-2 font-semibold text-center border-r border-slate-200 w-12">{m}</th>
                  ))}
                  <th className="p-2 font-semibold text-right">Total Tunggakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {reportData.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="p-6 text-center text-slate-500 italic">Tidak ada data warga ditemukan.</td>
                  </tr>
                ) : (
                  reportData.map((item, idx) => (
                    <tr key={item.warga.id} className="hover:bg-slate-50 transition print:break-inside-avoid">
                      <td className="p-2 text-center text-slate-500 border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50 print:bg-transparent z-10">{idx + 1}</td>
                      <td className="p-2 font-medium border-r border-slate-200 sticky left-[40px] bg-white group-hover:bg-slate-50 print:bg-transparent z-10 truncate max-w-[200px]" title={item.warga.full_name}>
                        {item.warga.full_name}
                      </td>
                      <td className="p-2 text-center text-slate-600 border-r border-slate-200">{item.warga.house_number}</td>
                      
                      {months.map((_, mIdx) => {
                        const monthNum = mIdx + 1
                        const statusData = item.statuses[monthNum]
                        let content = <span className="text-slate-300">-</span>
                        if (statusData.status === 'PAID') {
                          content = <span className="text-slate-700 font-semibold">{statusData.amount.toLocaleString('id-ID')}</span>
                        } else if (statusData.status !== 'NO_BILL') {
                          content = <span className="text-rose-400 font-medium" title={`Tunggakan: Rp ${statusData.amount.toLocaleString('id-ID')}`}>0</span>
                        }
                        return (
                          <td key={monthNum} className="p-2 text-center border-r border-slate-200">
                            {content}
                          </td>
                        )
                      })}

                      <td className={`p-2 text-right font-bold ${item.totalTunggakan > 0 ? 'text-rose-600 print:text-black' : 'text-slate-400'}`}>
                        {item.totalTunggakan > 0 ? `Rp ${item.totalTunggakan.toLocaleString('id-ID')}` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* TTD Area untuk Cetak */}
          <div className="mt-12 flex justify-end print:block hidden print:flex">
            <div className="text-center w-64">
              <p className="mb-16">Pengurus Perumahan,</p>
              <p className="font-bold border-b border-black pb-1 inline-block px-4">{profile?.full_name}</p>
              <p className="text-sm mt-1">Dicetak pada: {now.toLocaleDateString('id-ID')}</p>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
