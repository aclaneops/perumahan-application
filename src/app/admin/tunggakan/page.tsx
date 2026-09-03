import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { calculateResidentDues, OverdueLevel } from '@/lib/dues'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TunggakanClientTable from './TunggakanClientTable'

export const dynamic = 'force-dynamic'

export default async function TunggakanPage() {
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
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  // Fetch all warga profiles
  const { data: wargaProfiles } = await adminClient
    .from('profiles')
    .select('*')
    .eq('role', 'user')
    .order('house_number', { ascending: true })

  // Fetch all bills
  const { data: allBills } = await adminClient
    .from('bills')
    .select('*')

  // Fetch recent notification logs
  const { data: notificationLogs } = await adminClient
    .from('notification_logs')
    .select('*')
    .order('sent_at', { ascending: false })

  // Map each resident with overdue info
  const residentDuesList = (wargaProfiles || []).map(warga => {
    const residentBills = allBills?.filter(b => b.profile_id === warga.id || b.user_id === warga.id) || []
    const dues = calculateResidentDues(residentBills, currentMonth, currentYear)

    // Find latest notification sent to this resident
    const lastLog = notificationLogs?.find(l => l.profile_id === warga.id)

    return {
      id: warga.id,
      name: warga.full_name,
      houseNumber: warga.house_number,
      phone: warga.phone_number,
      telegramChatId: warga.telegram_chat_id,
      telegramUsername: warga.telegram_username,
      isTelegramConnected: Boolean(warga.telegram_chat_id),
      level: dues.level,
      levelLabel: dues.levelLabel,
      overdueMonthsCount: dues.overdueMonthsCount,
      totalOverdueAmount: dues.totalOverdueAmount,
      overduePeriods: dues.overduePeriods,
      lastNotificationStatus: lastLog ? lastLog.status : 'BELUM_DIKIRIM',
      lastNotificationDate: lastLog ? lastLog.sent_at : null
    }
  })

  // Filter only overdue residents (level > 0)
  const overdueResidentsOnly = residentDuesList.filter(r => r.level > 0)

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
          <Link href="/admin/tunggakan" className="flex items-center justify-between px-4 py-3 rounded-lg bg-blue-600 text-white font-medium">
            <span>Kelola Tunggakan</span>
            <span className="inline-flex items-center justify-center px-2 py-0.5 bg-rose-500 text-white rounded-full text-xs font-bold">
              {overdueResidentsOnly.length}
            </span>
          </Link>
          <Link href="/admin/warga" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Kelola Warga</Link>
          <Link href="/admin/notifikasi" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Log Notifikasi</Link>
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
            <h1 className="text-3xl font-bold text-slate-800">Daftar Tunggakan Warga</h1>
            <p className="text-slate-500 text-sm mt-1">Kelola dan pantau seluruh daftar warga yang memiliki tunggakan iuran</p>
          </div>
        </header>

        <TunggakanClientTable initialData={overdueResidentsOnly} />
      </main>
    </div>
  )
}
