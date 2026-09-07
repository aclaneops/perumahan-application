import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function NotifikasiPage() {
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

  // Fetch notification logs
  const { data: logs } = await adminClient
    .from('notification_logs')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(100)

  // Fetch profiles map
  const { data: allProfiles } = await adminClient
    .from('profiles')
    .select('id, full_name, house_number')

  const profileMap: Record<string, { full_name: string; house_number: string }> = {}
  allProfiles?.forEach(p => { profileMap[p.id] = p })

  const sentCount = logs?.filter(l => l.status === 'SENT').length || 0
  const failedCount = logs?.filter(l => l.status === 'FAILED').length || 0
  const skippedCount = logs?.filter(l => l.status === 'SKIPPED').length || 0

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
          <Link href="/admin/dashboard" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Dasbor Utama</Link>
          <Link href="/admin/tunggakan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Kelola Tunggakan</Link>
          <Link href="/admin/warga" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Kelola Warga</Link>
          <Link href="/admin/pengaturan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Pengaturan Tagihan</Link>
          <Link href="/admin/notifikasi" className="block px-4 py-3 rounded-lg bg-blue-600 text-white font-medium">Log Notifikasi</Link>
          <Link href="/admin/keuangan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Pembukuan</Link>
          <Link href="/admin/laporan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Laporan Bulanan</Link>
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
            <h1 className="text-3xl font-bold text-slate-800">Log Notifikasi Telegram Bot</h1>
            <p className="text-slate-500 text-sm mt-1">Riwayat audit pengiriman notifikasi pengingat & konfirmasi ke warga</p>
          </div>

          <form action="/api/admin/trigger-notif" method="post">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl transition text-sm shadow-md">
              ⚡ Eksekusi Cron Notifikasi Manual
            </button>
          </form>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">TERKIRIM (SENT)</p>
            <h3 className="text-3xl font-extrabold text-emerald-600">{sentCount} Notifikasi</h3>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">GAGAL (FAILED)</p>
            <h3 className="text-3xl font-extrabold text-rose-600">{failedCount} Notifikasi</h3>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">DILEWATI (SKIPPED)</p>
            <h3 className="text-3xl font-extrabold text-slate-600">{skippedCount} Notifikasi</h3>
            <p className="text-xs text-slate-400 mt-1">Belum taut Telegram / Anti-Spam</p>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-800">Riwayat Pengiriman Notifikasi (100 Terakhir)</h3>
          </div>

          {!logs || logs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              Belum ada log pengiriman notifikasi yang dicatat.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3.5 px-6 font-semibold">Nama Warga</th>
                    <th className="py-3.5 px-6 font-semibold">Jenis Notifikasi</th>
                    <th className="py-3.5 px-6 font-semibold">Periode</th>
                    <th className="py-3.5 px-6 font-semibold">Telegram Chat ID</th>
                    <th className="py-3.5 px-6 font-semibold">Waktu Pengiriman</th>
                    <th className="py-3.5 px-6 font-semibold">Status</th>
                    <th className="py-3.5 px-6 font-semibold">Detail Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log: any) => {
                    const p = profileMap[log.profile_id]

                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="py-4 px-6 font-medium text-slate-800">
                          {p ? `${p.full_name} (Blok ${p.house_number})` : 'Sistem / Warga'}
                        </td>
                        <td className="py-4 px-6 font-bold text-slate-700">
                          {log.notification_type}
                        </td>
                        <td className="py-4 px-6 text-slate-600 font-mono text-xs">
                          {log.period_month}/{log.period_year}
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500">
                          {log.telegram_chat_id || '-'}
                        </td>
                        <td className="py-4 px-6 text-slate-600 text-xs">
                          {new Date(log.sent_at).toLocaleString('id-ID')}
                        </td>
                        <td className="py-4 px-6">
                          {log.status === 'SENT' && (
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md">
                              ✅ SENT
                            </span>
                          )}
                          {log.status === 'FAILED' && (
                            <span className="text-xs font-bold text-rose-800 bg-rose-100 px-2.5 py-1 rounded-md">
                              ❌ FAILED
                            </span>
                          )}
                          {log.status === 'SKIPPED' && (
                            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                              ⚪ SKIPPED
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-xs text-rose-600 max-w-xs truncate">
                          {log.error_message || '-'}
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
