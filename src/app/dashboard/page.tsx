import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { calculateResidentDues, getLevelMetadata } from '@/lib/dues'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TelegramPairingWidget from './TelegramPairingWidget'
import ChangePasswordWidget from './ChangePasswordWidget'

export const dynamic = 'force-dynamic'

export default async function UserDashboard() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const adminClient = createAdminClient()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const monthName = now.toLocaleString('id-ID', { month: 'long' })

  const [
    { data: profile },
    { data: residentBills },
    { data: residentPayments }
  ] = await Promise.all([
    adminClient.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    adminClient.from('bills').select('*, payments(*)').or(`profile_id.eq.${user.id},user_id.eq.${user.id}`).order('period_year', { ascending: false }).order('period_month', { ascending: false }),
    adminClient.from('payments').select('*').or(`profile_id.eq.${user.id},user_id.eq.${user.id}`).order('created_at', { ascending: false })
  ])

  // Current month bill
  const currentBill = residentBills?.find(b => b.period_month === currentMonth && b.period_year === currentYear)

  const isPaid = currentBill?.status === 'PAID'
  const isPending = currentBill?.status === 'PENDING_CONFIRMATION' || currentBill?.status === 'PENDING'
  const isPartial = currentBill?.status === 'PARTIAL'
  const isUnpaid = !currentBill || currentBill?.status === 'UNPAID'

  // Calculate dues
  const duesInfo = calculateResidentDues(residentBills || [], currentMonth, currentYear)
  const levelMeta = getLevelMetadata(duesInfo.level)

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Perumahan App</h1>
            <p className="text-xs text-slate-500 font-medium">Halo, {profile?.full_name} (Blok {profile?.house_number})</p>
          </div>
        </div>
        <form action="/api/auth/signout" method="post">
          <button type="submit" className="text-sm text-slate-600 hover:text-slate-900 font-medium px-4 py-2 hover:bg-slate-100 rounded-lg transition">
            Keluar
          </button>
        </form>
      </nav>

      <main className="max-w-4xl mx-auto p-4 md:p-6 mt-6 space-y-8">
        {/* STATUS IURAN BULAN INI */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-20 -mt-20"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h2 className="text-slate-500 font-medium mb-1 text-sm uppercase tracking-wider">TAGIHAN BULAN INI</h2>
              <p className="text-3xl font-bold text-slate-800">{monthName} {currentYear}</p>
            </div>
            
            <div className="text-right">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Status Pembayaran Bulan Ini</p>
              {isPaid && (
                <div className="inline-flex items-center px-4 py-2 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold text-sm border border-emerald-200 shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                  🟢 SUDAH DIBAYAR (LUNAS)
                </div>
              )}
              {isPending && (
                <div className="inline-flex items-center px-4 py-2 rounded-xl bg-amber-100 text-amber-800 font-extrabold text-sm border border-amber-200 shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-2 animate-pulse"></span>
                  ⏳ MENUNGGU VALIDASI ADMIN
                </div>
              )}
              {isPartial && (
                <div className="inline-flex items-center px-4 py-2 rounded-xl bg-orange-100 text-orange-800 font-extrabold text-sm border border-orange-200 shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 mr-2 animate-pulse"></span>
                  ⚠️ KURANG BAYAR
                </div>
              )}
              {isUnpaid && (
                <div className="inline-flex items-center px-4 py-2 rounded-xl bg-rose-100 text-rose-800 font-extrabold text-sm border border-rose-200 shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-2 animate-pulse"></span>
                  🔴 BELUM DIBAYAR
                </div>
              )}
            </div>
          </div>
        </div>

        {/* OVERDUE TUNGGAKAN WARNING CARD (IF ANY) */}
        {duesInfo.overdueMonthsCount > 0 && (
          <div className="bg-rose-50 border-l-4 border-rose-500 rounded-2xl p-6 shadow-sm border border-rose-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-rose-200 pb-4 mb-4">
              <div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border ${levelMeta.badgeBgClass} mb-2`}>
                  {levelMeta.badgeText}
                </span>
                <h3 className="text-xl font-bold text-rose-950">TUNGGAKAN IURAN ANDA: {duesInfo.overdueMonthsCount} BULAN</h3>
                <p className="text-xs text-rose-700 mt-0.5">Mohon dapat melunasi sisa iuran di bawah ini.</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-rose-600 font-semibold uppercase">Total Tunggakan</p>
                <p className="text-3xl font-black text-rose-700">Rp {duesInfo.totalOverdueAmount.toLocaleString('id-ID')}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-800">Rincian Periode Menunggak:</p>
              <div className="grid grid-cols-1 gap-3">
                {duesInfo.overduePeriods.map((p, idx) => {
                  const isPending = p.status === 'PENDING_CONFIRMATION' || p.status === 'PENDING'
                  const isPartial = p.status === 'PARTIAL'

                  return (
                    <div key={idx} className="bg-white/90 p-4 rounded-xl border border-rose-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-sm font-medium shadow-sm">
                      <div>
                        <div className="text-slate-800 font-bold text-base">{p.monthName} {p.year}</div>
                        <div className="text-rose-700 font-extrabold mt-0.5">Rp {p.amount.toLocaleString('id-ID')}</div>
                      </div>
                      
                      <Link 
                        href={`/dashboard/upload?billId=${p.billId}&total=${p.amount}`}
                        className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm
                          ${isPending 
                            ? 'bg-amber-100 text-amber-700 border border-amber-200 pointer-events-none cursor-not-allowed' 
                            : isPartial 
                            ? 'bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200' 
                            : 'bg-rose-600 text-white hover:bg-rose-700 hover:shadow-md'
                          }`}
                      >
                        {isPending 
                          ? '⏳ Menunggu Validasi' 
                          : isPartial 
                          ? '⚠️ Upload Sisa Pembayaran' 
                          : '📤 Upload Bukti Bayar'}
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* BILL DETAILS & UPLOAD CARD & TELEGRAM WIDGET */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Rincian Tagihan Bulan Ini */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                Rincian Tagihan Bulan Ini
              </h3>
            </div>
            
            {currentBill ? (
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-slate-600">💧 Uang Air</span>
                  <span className="font-semibold">Rp {Number(currentBill.water_fee || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-slate-600">🗑️ Uang Sampah</span>
                  <span className="font-semibold">Rp {Number(currentBill.trash_fee || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-slate-600">🔒 Uang Keamanan</span>
                  <span className="font-semibold">Rp {Number(currentBill.security_fee || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-slate-600">🏦 Kas RT</span>
                  <span className="font-semibold">Rp {Number(currentBill.treasury_fee || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center pt-4 mt-2">
                  <span className="text-lg font-bold text-slate-800">Total Tagihan</span>
                  <span className="text-2xl font-bold text-blue-600">Rp {Number(currentBill.total_amount || 0).toLocaleString('id-ID')}</span>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 text-sm">
                Tagihan untuk bulan ini belum diterbitkan oleh Admin.
              </div>
            )}
          </div>

          {/* Right: Upload Button & Telegram Widget */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-xl"></div>
              <h3 className="text-lg font-bold mb-2">Upload Bukti Pembayaran</h3>
              <p className="text-blue-100 text-xs mb-6">
                {!currentBill 
                  ? 'Admin belum menerbitkan tagihan bulan ini. Hubungi Admin untuk info lebih lanjut.'
                  : 'Silakan transfer ke rekening perumahan dan unggah buktinya di sini.'}
              </p>
              
              <Link 
                href={currentBill ? `/dashboard/upload?billId=${currentBill.id}&total=${currentBill.total_amount || 0}` : '#'} 
                className={`block w-full py-3.5 px-4 bg-white text-center text-blue-600 rounded-xl font-bold text-sm transition shadow-xl shadow-blue-900/20 hover:scale-[1.02] ${(!currentBill || isPaid || isPending) ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}`}
              >
                {!currentBill 
                  ? '🔒 Tagihan Belum Diterbitkan'
                  : isPaid 
                  ? '✅ Sudah Lunas' 
                  : isPending 
                  ? '⏳ Menunggu Validasi Admin' 
                  : isPartial 
                  ? '⚠️ Lunasi Sisa Tagihan' 
                  : '📤 Upload Bukti Sekarang'}
              </Link>
            </div>

            {/* Telegram Pairing Widget */}
            <TelegramPairingWidget
              isTelegramConnected={Boolean(profile?.telegram_chat_id)}
              telegramUsername={profile?.telegram_username}
            />

            {/* Rekening Info */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h4 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider">Informasi Rekening Transfer</h4>
              <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-12 h-12 bg-white rounded-lg shadow-sm flex items-center justify-center font-bold text-blue-600 text-xl border border-slate-100 flex-shrink-0">
                  BCA
                </div>
                <div>
                  <p className="text-xs text-slate-500">Bank Central Asia</p>
                  <p className="font-bold text-slate-800 tracking-wider">1234 5678 90</p>
                  <p className="text-xs text-slate-500">a/n Paguyuban Perumahan</p>
                </div>
              </div>
            </div>

            {/* Change Password Widget */}
            <ChangePasswordWidget />
          </div>
        </div>

        {/* RIWAYAT PEMBAYARAN WARGA */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">Riwayat Pembayaran Anda</h3>
          </div>
          {!residentPayments || residentPayments.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Belum ada riwayat pembayaran yang Anda unggah.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-6 font-semibold">Tanggal Upload</th>
                    <th className="py-3 px-6 font-semibold">Nominal Transfer</th>
                    <th className="py-3 px-6 font-semibold">Bukti Pembayaran</th>
                    <th className="py-3 px-6 font-semibold">Status Validasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {residentPayments.map((p: any) => {
                    const proofUrl = p.payment_proof_url || p.proof_url || p.proofUrl
                    const isValidated = Boolean(p.validated_by || p.confirmed_by)

                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-4 px-6 text-slate-700 font-medium">
                          {new Date(p.created_at || p.paid_at).toLocaleString('id-ID')}
                        </td>
                        <td className="py-4 px-6 font-bold text-emerald-600">
                          Rp {Number(p.amount || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="py-4 px-6">
                          {proofUrl ? (
                            <a href={proofUrl} target="_blank" className="text-blue-600 hover:underline font-medium">Lihat Bukti 🖼️</a>
                          ) : (
                            <span className="text-slate-400 text-xs">Tidak ada file</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {isValidated ? (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded">
                              ✅ Divalidasi Admin
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded">
                              ⏳ Menunggu Validasi
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
