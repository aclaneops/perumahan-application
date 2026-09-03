import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { calculateResidentDues } from '@/lib/dues'
import { sendTelegramMessage, formatOverdueMessage, formatOverdueMultipleMessage } from '@/lib/telegram'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  
  // Verify admin role
  const { data: adminProfile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (adminProfile?.role !== 'admin' && adminProfile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { residentId } = await request.json()
  if (!residentId) {
    return NextResponse.json({ error: 'residentId is required' }, { status: 400 })
  }

  // Fetch resident profile
  const { data: resident } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', residentId)
    .single()

  if (!resident) {
    return NextResponse.json({ error: 'Warga tidak ditemukan' }, { status: 404 })
  }

  if (!resident.telegram_chat_id) {
    return NextResponse.json({ error: 'Warga belum menghubungkan Telegram' }, { status: 400 })
  }

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  // Fetch resident bills
  const { data: residentBills } = await adminClient
    .from('bills')
    .select('*')
    .or(`profile_id.eq.${residentId},user_id.eq.${residentId}`)

  const dues = calculateResidentDues(residentBills || [], currentMonth, currentYear)

  let text = ''
  if (dues.overduePeriods.length === 0) {
    text = `Halo Pak/Bu <b>${resident.full_name}</b> 👋\n\nTerima kasih! Catatan iuran perumahan Anda saat ini sudah <b>LANCAR & LUNAS</b>. Semoga sehat selalu! 🙏`
  } else if (dues.overduePeriods.length === 1) {
    const period = dues.overduePeriods[0]
    text = formatOverdueMessage(resident.full_name, period.monthName, period.year, period.amount)
  } else {
    text = formatOverdueMultipleMessage(resident.full_name, dues.overduePeriods, dues.totalOverdueAmount)
  }

  // Send Telegram Message
  const tgResult = await sendTelegramMessage(resident.telegram_chat_id, text)

  const isSuccess = Boolean(tgResult && tgResult.ok)
  const status = isSuccess ? 'SENT' : 'FAILED'
  const errorMsg = isSuccess ? null : (tgResult?.description || 'Telegram API failure')

  // Log into notification_logs table
  await adminClient.from('notification_logs').insert({
    profile_id: residentId,
    notification_type: 'MANUAL_REMINDER',
    period_month: currentMonth,
    period_year: currentYear,
    telegram_chat_id: resident.telegram_chat_id,
    status,
    error_message: errorMsg
  })

  if (!isSuccess) {
    return NextResponse.json({ error: `Gagal mengirim ke Telegram: ${errorMsg}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
