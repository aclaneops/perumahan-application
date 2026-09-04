import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { calculateResidentDues, getLevelMetadata, MONTH_NAMES } from '@/lib/dues'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import WargaDetailActions from './WargaDetailActions'

export const dynamic = 'force-dynamic'

export default async function WargaDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const adminClient = createAdminClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: adminProfile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  // Fetch resident profile
  const { data: wargaProfile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!wargaProfile) {
    notFound()
  }

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  // Fetch resident bills
  const { data: residentBills } = await adminClient
    .from('bills')
    .select('*')
    .or(`profile_id.eq.${params.id},user_id.eq.${params.id}`)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })

  // Fetch resident payment history
  const { data: paymentHistory } = await adminClient
    .from('payments')
    .select('*')
    .or(`profile_id.eq.${params.id},user_id.eq.${params.id}`)
    .order('created_at', { ascending: false })

  // Fetch notification logs for this resident
  const { data: logs } = await adminClient
    .from('notification_logs')
    .select('*')
    .eq('profile_id', params.id)
    .order('sent_at', { ascending: false })

  // Calculate overdue status
  const duesInfo = calculateResidentDues(residentBills || [], currentMonth, currentYear)
  const meta = getLevelMetadata(duesInfo.level)

  const isTelegramConnected = Boolean(wargaProfile.telegram_chat_id)
  const lastLog = logs && logs.length > 0 ? logs[0] : null

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
            <p className="font-semibold">{adminProfile?.full_name}</p>
            <span className="inline-block mt-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md uppercase tracking-wider font-bold">
              {adminProfile?.role}
            </span>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <Link href="/admin/dashboard" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Dasbor Utama</Link>
          <Link href="/admin/tunggakan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Kelola Tunggakan</Link>
          <Link href="/admin/pengaturan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Pengaturan Tagihan</Link>
          <Link href="/admin/notifikasi" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Log Notifikasi</Link>
          <Link href="/admin/keuangan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Pembukuan</Link>
          <Link href="/admin/laporan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Laporan Bulanan</Link>
        </nav>
        <div className="p-4 border-t border-slate-700">
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="w-full text-left px-4 py-2 text-slate-300 hover:text-white transition">Log Out</button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/warga" className="p-2 bg-white rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
              ← Kembali
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Detail Warga: {wargaProfile.full_name}</h1>
              <p className="text-slate-500 text-sm">Rumah Blok {wargaProfile.house_number}</p>
            </div>
          </div>

          <WargaDetailActions
            residentId={wargaProfile.id}
            residentName={wargaProfile.full_name}
            isTelegramConnected={isTelegramConnected}
            lastSentAt={lastLog ? lastLog.sent_at : null}
          />
        </header>

        {/* TOP INFO & OVERDUE STATUS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: Informasi Warga */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">INFORMASI WARGA</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Nama Lengkap</p>
                <p className="font-bold text-slate-800">{wargaProfile.full_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Blok / Nomor Rumah</p>
                <p className="font-bold text-slate-800">Blok {wargaProfile.house_number}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Nomor WhatsApp</p>
                <p className="font-medium text-slate-700">{wargaProfile.phone_number || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Status Telegram</p>
                {isTelegramConnected ? (
                  <span className="inline-flex items-center text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                    🟢 Terhubung ({wargaProfile.telegram_username || 'Chat ID Available'})
                  </span>
                ) : (
                  <span className="inline-flex items-center text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                    ⚪ Belum Terhubung
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Status Iuran & Klasifikasi */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">STATUS IURAN & LEVEL</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Klasifikasi Level</p>
                <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-extrabold border ${meta.badgeBgClass}`}>
                  {meta.badgeText}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400">Jumlah Bulan Tunggakan</p>
                <p className="text-2xl font-extrabold text-slate-800">{duesInfo.overdueMonthsCount} bulan</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Nominal Tunggakan</p>
                <p className="text-2xl font-extrabold text-rose-600">Rp {duesInfo.totalOverdueAmount.toLocaleString('id-ID')}</p>
              </div>
            </div>
          </div>

          {/* Card 3: Status Log Notifikasi Terakhir */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">LOG NOTIFIKASI TERAKHIR</h3>
            {lastLog ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Jenis Notifikasi</p>
                  <p className="font-bold text-slate-800">{lastLog.notification_type}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Waktu Terkirim</p>
                  <p className="font-medium text-slate-700">{new Date(lastLog.sent_at).toLocaleString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Status</p>
                  <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${lastLog.status === 'SENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {lastLog.status}
                  </span>
                </div>
                {lastLog.error_message && (
                  <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded border border-rose-100">{lastLog.error_message}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Belum ada riwayat pengiriman notifikasi ke warga ini.</p>
            )}
          </div>
        </div>

        {/* RINCIAN TAGIHAN BULANAN */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Rincian Tagihan Per Periode</h3>
          {!residentBills || residentBills.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">Belum ada data tagihan yang diterbitkan untuk warga ini.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {residentBills.map((b: any) => {
                const isPaid = b.status === 'PAID'
                const isPending = b.status === 'PENDING_CONFIRMATION' || b.status === 'PENDING'
                const monthNameStr = MONTH_NAMES[b.period_month - 1] || `Bulan ${b.period_month}`

                return (
                  <div key={b.id} className={`p-4 rounded-xl border flex justify-between items-center ${isPaid ? 'bg-emerald-50/60 border-emerald-200' : isPending ? 'bg-yellow-50/60 border-yellow-200' : 'bg-rose-50/60 border-rose-200'}`}>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{monthNameStr} {b.period_year}</p>
                      <p className="text-xs text-slate-600 font-semibold mt-0.5">Rp {Number(b.total_amount || 0).toLocaleString('id-ID')}</p>
                    </div>
                    <div>
                      {isPaid ? (
                        <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md">
                          ✅ LUNAS
                        </span>
                      ) : isPending ? (
                        <span className="text-xs font-extrabold text-yellow-800 bg-yellow-100 px-2.5 py-1 rounded-md">
                          ⏳ VALIDASI
                        </span>
                      ) : (
                        <span className="text-xs font-extrabold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-md">
                          ❌ BELUM
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RIWAYAT PEMBAYARAN */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-800">Riwayat Pembayaran Complete</h3>
          </div>
          {!paymentHistory || paymentHistory.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Belum ada riwayat pembayaran yang diunggah oleh warga ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-6 font-semibold">Waktu Pembayaran</th>
                    <th className="py-3 px-6 font-semibold">Nominal Dikonfirmasi</th>
                    <th className="py-3 px-6 font-semibold">Bukti Pembayaran</th>
                    <th className="py-3 px-6 font-semibold">Status Validasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentHistory.map((p: any) => {
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
                            <a href={proofUrl} target="_blank" className="text-blue-600 hover:underline font-medium">Lihat Foto 🖼️</a>
                          ) : (
                            <span className="text-slate-400 text-xs">Tidak ada file</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {isValidated ? (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                              ✅ Divalidasi
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                              ⏳ Menunggu Admin
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
