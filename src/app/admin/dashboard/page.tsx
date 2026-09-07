import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { calculateResidentDues, getLevelMetadata } from '@/lib/dues'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const supabase = createClient()
  const adminClient = createAdminClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get current admin profile
  const { data: profile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const monthName = now.toLocaleString('id-ID', { month: 'long' })

  // Fetch all data in parallel to avoid waterfalls
  const [
    { data: allProfiles },
    { data: currentMonthBills },
    { data: allUnpaidBills }, // For calculating overdue levels
    { data: unvalidatedPayments }
  ] = await Promise.all([
    adminClient.from('profiles').select('id, full_name, house_number, role').limit(5000),
    adminClient.from('bills').select('id, total_amount, status').eq('period_month', currentMonth).eq('period_year', currentYear).limit(5000),
    adminClient.from('bills').select('id, profile_id, user_id, status, period_month, period_year, total_amount').limit(10000),
    adminClient.from('payments').select('*').is('validated_by', null).order('created_at', { ascending: false }).limit(5000)
  ])

  const wargaProfiles = allProfiles?.filter(p => p.role === 'user') || []
  const allBills = allUnpaidBills // Rename logically for the rest of the code
  const totalWarga = wargaProfiles.length

  const profileMap: Record<string, any> = {}
  allProfiles?.forEach(p => { profileMap[p.id] = p })

  // Calculate current month statistics
  let totalCurrentTagihanNominal = 0
  let sudahBayarCount = 0
  let belumBayarCount = 0
  let totalUangDiterima = 0
  let totalUangBelumTertagih = 0

  currentMonthBills?.forEach(b => {
    totalCurrentTagihanNominal += Number(b.total_amount || 0)
    if (b.status === 'PAID') {
      sudahBayarCount++
      totalUangDiterima += Number(b.total_amount || 0)
    } else {
      belumBayarCount++
      totalUangBelumTertagih += Number(b.total_amount || 0)
    }
  })

  const persentasePembayaran = totalCurrentTagihanNominal > 0
    ? Math.round((totalUangDiterima / totalCurrentTagihanNominal) * 100)
    : 0

  // Calculate Overdue Breakdown across all residents
  let lancarCount = 0
  let l1Count = 0
  let l2Count = 0
  let l3Count = 0
  let l4Count = 0
  let totalWargaMenunggakCount = 0
  let grandTotalTunggakan = 0

  // Group ALL bills by profile_id for faster O(1) lookup
  const residentBillsMap: Record<string, any[]> = {}
  allBills?.forEach(b => {
    const pId = b.profile_id || b.user_id
    if (!residentBillsMap[pId]) residentBillsMap[pId] = []
    residentBillsMap[pId].push(b)
  })

  wargaProfiles.forEach(warga => {
    // Only pass unpaid bills. `calculateResidentDues` might not see the current month bill if it's PAID,
    // but if it's PAID it doesn't affect dues level anyway.
    const residentBills = residentBillsMap[warga.id] || []
    const dues = calculateResidentDues(residentBills, currentMonth, currentYear)

    if (dues.level === 0) lancarCount++
    else if (dues.level === 1) l1Count++
    else if (dues.level === 2) l2Count++
    else if (dues.level === 3) l3Count++
    else if (dues.level === 4) l4Count++

    if (dues.level > 0) {
      totalWargaMenunggakCount++
      grandTotalTunggakan += dues.totalOverdueAmount
    }
  })

  const pendingValidations: any[] = []
  const processedBillIds = new Set<string>()

  const unvalPayments = unvalidatedPayments || []

  // To avoid fetching ALL bills for unvalidated payments, we can query them dynamically if not in allUnpaidBills
  // But wait, unvalidated payments are likely for bills that are PENDING or UNPAID, which are ALREADY in allUnpaidBills!
  const unpaidBillsMap: Record<string, any> = {}
  allUnpaidBills?.forEach(b => { unpaidBillsMap[b.id] = b })

  unvalPayments.forEach((payment: any) => {
    const bill = unpaidBillsMap[payment.bill_id]
    if (bill && bill.status !== 'PAID') {
      const profileId = bill.profile_id || bill.user_id || payment.profile_id || payment.user_id
      const pProfile = profileMap[profileId]
      const proofUrl = payment.payment_proof_url || payment.proof_url || payment.proofUrl

      pendingValidations.push({
        billId: bill.id,
        paymentId: payment.id,
        name: pProfile?.full_name || 'Warga (Tidak diketahui)',
        house: pProfile?.house_number || '-',
        amount: payment.amount || bill.total_amount,
        totalBill: bill.total_amount,
        proofUrl: proofUrl || null,
        date: payment.created_at || payment.paid_at || bill.updated_at || bill.created_at
      })
      processedBillIds.add(bill.id)
    }
  })

  allUnpaidBills?.forEach((bill: any) => {
    if (!processedBillIds.has(bill.id) && (bill.status === 'PENDING' || bill.status === 'PENDING_CONFIRMATION')) {
      const profileId = bill.profile_id || bill.user_id
      const pProfile = profileMap[profileId]
      const paymentsForBill = unvalPayments?.filter((p: any) => p.bill_id === bill.id) || []
      const payment = paymentsForBill.sort((a: any, b: any) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )[0]
      const proofUrl = payment?.payment_proof_url || payment?.proof_url || payment?.proofUrl

      if (payment) {
        pendingValidations.push({
          billId: bill.id,
          paymentId: payment.id,
          name: pProfile?.full_name || 'Warga (Tidak diketahui)',
          house: pProfile?.house_number || '-',
          amount: payment.amount || bill.total_amount,
          totalBill: bill.total_amount,
          proofUrl: proofUrl || null,
          date: payment.created_at || payment.paid_at || bill.updated_at || bill.created_at
        })
      }
    }
  })

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col flex-shrink-0">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-blue-400">Panel Admin</h2>
          <p className="text-sm text-slate-400 mt-1">Sistem Perumahan</p>
        </div>
        <div className="px-6 mb-6">
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Login sebagai:</p>
            <p className="font-semibold">{profile?.full_name}</p>
            <span className="inline-block mt-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md uppercase tracking-wider font-bold">
              {profile?.role}
            </span>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <Link href="/admin/dashboard" className="flex items-center justify-between px-4 py-3 rounded-lg bg-blue-600 text-white font-medium">
            <span>Dasbor Utama</span>
            {pendingValidations.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-400 text-amber-900 rounded-full text-xs font-bold">
                {pendingValidations.length}
              </span>
            )}
          </Link>
          <Link href="/admin/tunggakan" className="flex items-center justify-between px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">
            <span>Kelola Tunggakan</span>
            {totalWargaMenunggakCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 bg-rose-500 text-white rounded-full text-xs font-bold">
                {totalWargaMenunggakCount}
              </span>
            )}
          </Link>
          <Link href="/admin/warga" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Kelola Warga</Link>
          <Link href="/admin/pengaturan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Pengaturan Tagihan</Link>
          <Link href="/admin/notifikasi" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Log Notifikasi</Link>
          <Link href="/admin/keuangan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Pembukuan</Link>
          <Link href="/admin/laporan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Laporan Bulanan</Link>
          <Link href="/admin/rekap-tahunan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Rekap Tahunan</Link>
          <Link href="/admin/tutup-buku" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Tutup Buku</Link>
        </nav>
        <div className="p-4 border-t border-slate-700">
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="w-full text-left px-4 py-2 text-slate-300 hover:text-white transition">Log Out</button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Ringkasan Bulan Ini ({monthName} {currentYear})</h1>
            <p className="text-slate-500 text-sm mt-1">Sistem Pemantauan Iuran & Tunggakan Otomatis</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/admin/export?month=${currentMonth}&year=${currentYear}`} className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition shadow-sm text-sm inline-flex items-center gap-1.5">
              <span>↓</span> Export Laporan
            </a>
            <Link href="/admin/warga/tambah" className="bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm text-sm inline-flex items-center gap-1.5">
              <span>+</span> Tambah Warga
            </Link>
          </div>
        </header>

        {/* APPROVAL RESULT BANNER */}
        {searchParams.msg && (
          <div className="mb-6 bg-emerald-50 border-l-4 border-emerald-500 rounded-xl p-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                ✅
              </div>
              <div>
                <p className="font-bold text-emerald-800 text-lg">
                  Validasi Berhasil
                </p>
                <p className="text-emerald-700 text-sm mt-0.5 font-medium">
                  {searchParams.msg}
                </p>
              </div>
            </div>
            <Link
              href="/admin/dashboard"
              className="ml-4 flex-shrink-0 text-emerald-600 hover:text-emerald-800 font-bold px-3 py-1 transition text-sm"
            >
              ✕ Tutup
            </Link>
          </div>
        )}

        {/* APPROVAL ALERT BANNER */}
        {pendingValidations.length > 0 && (
          <div className="mb-6 bg-amber-50 border-l-4 border-amber-400 rounded-xl p-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                🔔
              </div>
              <div>
                <p className="font-bold text-amber-800 text-lg">
                  {pendingValidations.length} Pembayaran Menunggu Persetujuan
                </p>
                <p className="text-amber-600 text-sm mt-0.5">
                  Warga telah mengirimkan bukti pembayaran. Silakan periksa dan setujui atau tolak di tabel di bawah.
                </p>
              </div>
            </div>
            <a
              href="#pending-table"
              className="ml-4 flex-shrink-0 bg-amber-400 hover:bg-amber-500 text-amber-900 font-bold px-4 py-2 rounded-lg transition text-sm"
            >
              Lihat Sekarang ↓
            </a>
          </div>
        )}

        {/* NOTICE BANNER IF NO BILLS FOR THIS MONTH */}
        {(!currentMonthBills || currentMonthBills.length === 0) && (
          <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 rounded-xl p-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                💡
              </div>
              <div>
                <p className="font-bold text-blue-900 text-lg">
                  Tagihan {monthName} {currentYear} Belum Diterbitkan
                </p>
                <p className="text-blue-700 text-sm mt-0.5">
                  Klik tombol di samping untuk menerbitkan tagihan bulan ini agar warga dapat melihat dan membayar tagihan.
                </p>
              </div>
            </div>
            <Link
              href="/admin/pengaturan"
              className="ml-4 flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-lg transition text-sm"
            >
              Terbitkan Tagihan →
            </Link>
          </div>
        )}

        {/* STATS UTAMA (8 CARDS GRID) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">TOTAL WARGA</p>
            <h3 className="text-3xl font-extrabold text-slate-800">{totalWarga}</h3>
            <p className="text-xs text-slate-500 mt-1">Terdaftar dalam sistem</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">SUDAH BAYAR</p>
            <h3 className="text-3xl font-extrabold text-emerald-600">{sudahBayarCount}</h3>
            <p className="text-xs text-emerald-600 font-medium mt-1">{persentasePembayaran}% Pembayaran lunas</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">BELUM BAYAR (BLN INI)</p>
            <h3 className="text-3xl font-extrabold text-rose-600">{belumBayarCount}</h3>
            <p className="text-xs text-rose-500 mt-1">Rumah belum melunasi</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">TOTAL WARGA MENUNGGAK</p>
            <h3 className="text-3xl font-extrabold text-amber-600">{totalWargaMenunggakCount}</h3>
            <p className="text-xs text-amber-600 font-medium mt-1">Ada tunggakan 1+ bulan</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">UANG DITERIMA (BLN INI)</p>
            <h3 className="text-xl font-extrabold text-emerald-600">Rp {totalUangDiterima.toLocaleString('id-ID')}</h3>
            <p className="text-xs text-slate-500 mt-1">Dari tagihan bulan ini</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">BELUM TERTAGIH (BLN INI)</p>
            <h3 className="text-xl font-extrabold text-slate-700">Rp {totalUangBelumTertagih.toLocaleString('id-ID')}</h3>
            <p className="text-xs text-slate-500 mt-1">Sisa tagihan bulan ini</p>
          </div>

          <div className="col-span-2 bg-gradient-to-r from-slate-900 to-indigo-950 p-5 rounded-xl text-white shadow-md flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">TOTAL NOMINAL TUNGGAKAN</p>
              <h3 className="text-2xl font-extrabold text-amber-400">Rp {grandTotalTunggakan.toLocaleString('id-ID')}</h3>
              <p className="text-xs text-slate-300 mt-1">Akumulasi seluruh tunggakan warga</p>
            </div>
            <Link href="/admin/tunggakan" className="bg-amber-400 hover:bg-amber-500 text-slate-900 px-4 py-2 rounded-lg font-bold text-xs transition">
              Kelola Tunggakan →
            </Link>
          </div>
        </div>

        {/* STATISTIK TUNGGAKAN PER LEVEL */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800">Statistik Klasifikasi Level Tunggakan</h3>
            <Link href="/admin/tunggakan" className="text-sm font-semibold text-blue-600 hover:underline">
              Lihat Daftar Tunggakan →
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
              <span className="text-2xl">🟢</span>
              <p className="text-xs font-bold text-emerald-800 uppercase mt-1">Lancar (0 Bln)</p>
              <p className="text-2xl font-extrabold text-emerald-700 mt-1">{lancarCount} Warga</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
              <span className="text-2xl">🟡</span>
              <p className="text-xs font-bold text-yellow-800 uppercase mt-1">1 Bulan</p>
              <p className="text-2xl font-extrabold text-yellow-700 mt-1">{l1Count} Warga</p>
            </div>

            <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl">
              <span className="text-2xl">🟠</span>
              <p className="text-xs font-bold text-orange-800 uppercase mt-1">2 Bulan</p>
              <p className="text-2xl font-extrabold text-orange-700 mt-1">{l2Count} Warga</p>
            </div>

            <div className="bg-red-50 border border-red-200 p-4 rounded-xl">
              <span className="text-2xl">🔴</span>
              <p className="text-xs font-bold text-red-800 uppercase mt-1">3 Bulan</p>
              <p className="text-2xl font-extrabold text-red-700 mt-1">{l3Count} Warga</p>
            </div>

            <div className="bg-rose-100 border border-rose-300 p-4 rounded-xl col-span-2 md:col-span-1">
              <span className="text-2xl">🔴</span>
              <p className="text-xs font-bold text-rose-900 uppercase mt-1">4+ Bulan</p>
              <p className="text-2xl font-extrabold text-rose-800 mt-1">{l4Count} Warga</p>
            </div>
          </div>
        </div>

        {/* Action Table: Menunggu Validasi Admin */}
        <div id="pending-table" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-800">
              Menunggu Validasi Admin
              {pendingValidations.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 bg-amber-400 text-amber-900 rounded-full text-xs font-bold">
                  {pendingValidations.length}
                </span>
              )}
            </h3>
          </div>
          
          {pendingValidations.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              Tidak ada pembayaran yang menunggu validasi saat ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="py-3 px-6 font-semibold">Nama Warga</th>
                    <th className="py-3 px-6 font-semibold">Blok / No</th>
                    <th className="py-3 px-6 font-semibold">Jumlah</th>
                    <th className="py-3 px-6 font-semibold">Waktu Upload</th>
                    <th className="py-3 px-6 font-semibold">Bukti</th>
                    <th className="py-3 px-6 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-100">
                  {pendingValidations.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-4 px-6 font-medium text-slate-800">{item.name}</td>
                      <td className="py-4 px-6 text-slate-600">{item.house}</td>
                      <td className="py-4 px-6 font-medium">
                        <div className="text-blue-600">Bayar: Rp {Number(item.amount).toLocaleString('id-ID')}</div>
                        <div className="text-xs text-slate-500">Tagihan: Rp {Number(item.totalBill).toLocaleString('id-ID')}</div>
                      </td>
                      <td className="py-4 px-6 text-slate-500">{new Date(item.date).toLocaleString('id-ID')}</td>
                      <td className="py-4 px-6">
                        {item.proofUrl
                          ? <a href={item.proofUrl} target="_blank" className="text-blue-600 hover:underline font-medium inline-flex items-center gap-1">Lihat Foto 🖼️</a>
                          : <span className="text-slate-400 text-xs">Belum ada bukti</span>
                        }
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        {item.paymentId ? (
                          <>
                            <form action="/api/admin/validate" method="POST" className="inline-block">
                              <input type="hidden" name="billId" value={item.billId} />
                              <input type="hidden" name="paymentId" value={item.paymentId} />
                              <input type="hidden" name="action" value="approve" />
                              <button type="submit" className="bg-green-100 text-green-700 px-3 py-1.5 rounded-md hover:bg-green-200 transition font-medium text-xs">✅ Terima</button>
                            </form>
                            <form action="/api/admin/validate" method="POST" className="inline-block">
                              <input type="hidden" name="billId" value={item.billId} />
                              <input type="hidden" name="paymentId" value={item.paymentId} />
                              <input type="hidden" name="action" value="reject" />
                              <button type="submit" className="bg-red-100 text-red-700 px-3 py-1.5 rounded-md hover:bg-red-200 transition font-medium text-xs">❌ Tolak</button>
                            </form>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Menunggu bukti</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
