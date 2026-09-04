import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PrintButton from './PrintButton'

export const dynamic = 'force-dynamic'

export default async function LaporanPage({ searchParams }: { searchParams: { month?: string, year?: string } }) {
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

  const now = new Date()
  const targetMonth = searchParams.month ? parseInt(searchParams.month) : now.getMonth() + 1
  const targetYear = searchParams.year ? parseInt(searchParams.year) : now.getFullYear()

  // 1. Fetch Iuran Warga (Tagihan yang sudah PAID untuk bulan tersebut)
  // Catatan: Iuran dihitung berdasarkan period_month dan period_year tagihannya, bukan kapan dibayarnya,
  // atau bisa juga berdasarkan tanggal dibayar (paid_at). Untuk laporan kas, lebih tepat berdasarkan
  // kapan uang tersebut masuk (paid_at / waktu pembayaran divalidasi).
  // Kita akan ambil payments yang terjadi di bulan dan tahun target.
  const { data: allPayments } = await adminClient
    .from('payments')
    .select('*, bills(*)')
    .not('validated_by', 'is', null) // Hanya yang sudah divalidasi/PAID

  let totalIuran = 0
  const iuranList: any[] = []

  allPayments?.forEach(payment => {
    // Kita gunakan payment.paid_at atau created_at sebagai waktu masuknya kas
    const pDate = new Date(payment.paid_at || payment.created_at)
    if (pDate.getMonth() + 1 === targetMonth && pDate.getFullYear() === targetYear) {
      totalIuran += Number(payment.amount || payment.bills?.total_amount || 0)
      iuranList.push({
        date: pDate,
        category: `Iuran Warga - Bulan ${payment.bills?.period_month}/${payment.bills?.period_year}`,
        amount: Number(payment.amount || payment.bills?.total_amount || 0),
        type: 'INCOME'
      })
    }
  })

  // 2. Fetch Transactions (Pemasukan Lain & Pengeluaran)
  const { data: transactions } = await adminClient
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })

  let totalPemasukanLain = 0
  let totalPengeluaran = 0
  const transactionList: any[] = []

  transactions?.forEach(t => {
    const tDate = new Date(t.date)
    if (tDate.getMonth() + 1 === targetMonth && tDate.getFullYear() === targetYear) {
      if (t.type === 'INCOME') totalPemasukanLain += Number(t.amount)
      if (t.type === 'EXPENSE') totalPengeluaran += Number(t.amount)
      
      transactionList.push({
        date: tDate,
        category: t.category + (t.description ? ` (${t.description})` : ''),
        amount: Number(t.amount),
        type: t.type
      })
    }
  })

  const totalPemasukan = totalIuran + totalPemasukanLain
  const saldoBersih = totalPemasukan - totalPengeluaran

  // Gabungkan semua mutasi kas untuk tabel rincian
  const combinedLedger = [...iuranList, ...transactionList].sort((a, b) => a.date.getTime() - b.date.getTime())
  
  const monthName = new Date(targetYear, targetMonth - 1, 1).toLocaleString('id-ID', { month: 'long' })

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
          <Link href="/admin/laporan" className="block px-4 py-3 rounded-lg bg-blue-600 text-white font-medium">Laporan Bulanan</Link>
        </nav>
        <div className="p-4 border-t border-slate-700">
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="w-full text-left px-4 py-2 text-slate-300 hover:text-white transition">Log Out</button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 bg-white md:bg-slate-50 min-h-screen">
        
        {/* Filter Controls - Hidden when print */}
        <div className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:hidden flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Laporan Kas Bulanan</h1>
            <p className="text-slate-500 text-sm mt-1">Rekapitulasi pemasukan iuran warga, pemasukan lain, dan pengeluaran.</p>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            <form className="flex items-center gap-2">
              <select name="month" defaultValue={targetMonth} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('id-ID', { month: 'long' })}</option>
                ))}
              </select>
              <select name="year" defaultValue={targetYear} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                {[targetYear - 1, targetYear, targetYear + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition">Tampilkan</button>
            </form>
            
            {/* Button print interaktif via Client Component */}
            <PrintButton />
          </div>
        </div>

        {/* Laporan Kertas (Printable Area) */}
        <div className="bg-white p-0 md:p-8 md:rounded-2xl md:shadow-sm md:border md:border-slate-200 print:shadow-none print:border-none print:p-0 mx-auto max-w-4xl text-slate-800">
          
          <div className="text-center mb-8 border-b-2 border-slate-800 pb-6">
            <h1 className="text-2xl font-bold uppercase tracking-wider">Laporan Keuangan Kas Perumahan</h1>
            <p className="text-lg mt-1 font-medium">Periode: {monthName} {targetYear}</p>
          </div>

          {/* Ringkasan Eksekutif */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl print:border-slate-300 print:bg-transparent">
              <p className="text-sm text-slate-500 font-semibold mb-1">TOTAL PEMASUKAN</p>
              <p className="text-2xl font-bold text-emerald-600 print:text-black">Rp {totalPemasukan.toLocaleString('id-ID')}</p>
              <ul className="mt-2 text-sm text-slate-600 space-y-1">
                <li>Iuran Warga: Rp {totalIuran.toLocaleString('id-ID')}</li>
                <li>Lainnya: Rp {totalPemasukanLain.toLocaleString('id-ID')}</li>
              </ul>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl print:border-slate-300 print:bg-transparent">
              <p className="text-sm text-slate-500 font-semibold mb-1">TOTAL PENGELUARAN</p>
              <p className="text-2xl font-bold text-rose-600 print:text-black">Rp {totalPengeluaran.toLocaleString('id-ID')}</p>
            </div>
          </div>

          <div className="flex justify-between items-center p-4 bg-blue-50 border border-blue-200 rounded-xl mb-8 print:bg-transparent print:border-slate-800">
            <span className="font-bold text-lg">SALDO BERSIH BULAN INI</span>
            <span className={`font-bold text-2xl ${saldoBersih >= 0 ? 'text-blue-700' : 'text-rose-600'} print:text-black`}>
              Rp {saldoBersih.toLocaleString('id-ID')}
            </span>
          </div>

          {/* Rincian Transaksi */}
          <h3 className="text-lg font-bold mb-4 border-b border-slate-200 pb-2">Rincian Mutasi Kas</h3>
          
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 print:bg-slate-200 border-y border-slate-300">
                <th className="p-3 font-semibold w-24">Tanggal</th>
                <th className="p-3 font-semibold">Uraian / Kategori</th>
                <th className="p-3 font-semibold text-right w-32">Pemasukan</th>
                <th className="p-3 font-semibold text-right w-32">Pengeluaran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {combinedLedger.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500 italic">Tidak ada transaksi tercatat di bulan ini.</td>
                </tr>
              ) : (
                combinedLedger.map((item, idx) => (
                  <tr key={idx} className="print:break-inside-avoid">
                    <td className="p-3 align-top whitespace-nowrap">{item.date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td className="p-3 align-top">{item.category}</td>
                    <td className="p-3 align-top text-right font-medium">
                      {item.type === 'INCOME' ? `Rp ${item.amount.toLocaleString('id-ID')}` : '-'}
                    </td>
                    <td className="p-3 align-top text-right font-medium">
                      {item.type === 'EXPENSE' ? `Rp ${item.amount.toLocaleString('id-ID')}` : '-'}
                    </td>
                  </tr>
                ))
              )}
              {/* Row Total Bawah */}
              {combinedLedger.length > 0 && (
                <tr className="bg-slate-50 print:bg-slate-100 border-y-2 border-slate-800 font-bold">
                  <td colSpan={2} className="p-3 text-right">TOTAL MUTASI</td>
                  <td className="p-3 text-right text-emerald-700 print:text-black">Rp {totalPemasukan.toLocaleString('id-ID')}</td>
                  <td className="p-3 text-right text-rose-700 print:text-black">Rp {totalPengeluaran.toLocaleString('id-ID')}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* TTD Area untuk Cetak */}
          <div className="mt-16 flex justify-end print:block hidden print:flex">
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
