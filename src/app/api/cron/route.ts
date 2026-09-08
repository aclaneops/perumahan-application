import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { calculateResidentDues, MONTH_NAMES } from '@/lib/dues'
import {
  sendTelegramMessage,
  formatBillCreatedMessage,
  formatHMinus5Message,
  formatDueDateMessage,
  formatOverdueMessage,
  formatOverdueMultipleMessage,
  formatAdminSummaryReportMessage
} from '@/lib/telegram'

export async function GET(request: Request) {
  // Authorization verification for Vercel Cron or Manual Admin Trigger
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { searchParams } = new URL(request.url)
  const now = new Date()
  const currentMonth = searchParams.has('month') ? parseInt(searchParams.get('month')!) : now.getMonth() + 1
  const currentYear = searchParams.has('year') ? parseInt(searchParams.get('year')!) : now.getFullYear()
  const currentDateNum = now.getDate()
  const monthName = MONTH_NAMES[currentMonth - 1] || `Bulan ${currentMonth}`

  // 1. Idempotent Bill Generation for Current Month (if settings exist)
  const { data: settings } = await adminClient
    .from('settings')
    .select('value')
    .eq('id', 'billing_fees')
    .maybeSingle()

  const fees = settings?.value || { water: 50000, trash: 30000, security: 75000, treasury: 20000 }

  const { data: allWargaProfiles } = await adminClient
    .from('profiles')
    .select('*')
    .eq('role', 'user')

  const targetUserIds = searchParams.has('userIds') ? searchParams.get('userIds')!.split(',') : []
  
  // Filter for specific users if provided, otherwise use all users
  const wargaProfiles = targetUserIds.length > 0 
    ? allWargaProfiles?.filter(p => targetUserIds.includes(p.id)) 
    : allWargaProfiles

  if (wargaProfiles && wargaProfiles.length > 0) {
    const newBills = wargaProfiles.map(p => ({
      profile_id: p.id,
      user_id: p.id,
      period_month: currentMonth,
      period_year: currentYear,
      water_fee: fees.water,
      trash_fee: fees.trash,
      security_fee: fees.security,
      treasury_fee: fees.treasury,
      status: 'UNPAID'
    }))

    // Insert ignoring duplicates (unique constraint profile_id + period_month + period_year)
    await adminClient.from('bills').upsert(newBills, { onConflict: 'profile_id,period_month,period_year', ignoreDuplicates: true })
  }

  // 2. Fetch all bills and logs for notification engine
  const { data: allBills } = await adminClient.from('bills').select('*')
  const { data: allLogs } = await adminClient.from('notification_logs').select('*')

  let sentCount = 0
  let skippedCount = 0
  let failedCount = 0

  let lancarCount = 0
  let l1Count = 0
  let l2Count = 0
  let l3Count = 0
  let l4Count = 0
  let totalDiterima = 0
  let totalBelumTertagih = 0

  const totalWarga = wargaProfiles?.length || 0

  // 3. Process Staged Notifications & Statistics
  for (const warga of (wargaProfiles || [])) {
    const residentBills = allBills?.filter(b => b.profile_id === warga.id || b.user_id === warga.id) || []
    const dues = calculateResidentDues(residentBills, currentMonth, currentYear)

    // Calculate level stats
    if (dues.level === 0) lancarCount++
    else if (dues.level === 1) l1Count++
    else if (dues.level === 2) l2Count++
    else if (dues.level === 3) l3Count++
    else if (dues.level >= 4) l4Count++

    // Current month bill check
    const currentBill = residentBills.find(b => b.period_month === currentMonth && b.period_year === currentYear)
    if (currentBill) {
      if (currentBill.status === 'PAID') {
        totalDiterima += Number(currentBill.total_amount || 0)
      } else {
        totalBelumTertagih += Number(currentBill.total_amount || 0)
      }
    }

    // Determine Staged Notification Type
    let notificationType: string | null = null
    let messageText = ''

    if (!warga.telegram_chat_id) {
      // Record skipped log for audit
      await adminClient.from('notification_logs').insert({
        profile_id: warga.id,
        notification_type: 'CHECK_SKIPPED',
        period_month: currentMonth,
        period_year: currentYear,
        telegram_chat_id: null,
        status: 'SKIPPED',
        error_message: 'Telegram belum terhubung'
      })
      skippedCount++
      continue
    }

    // Check Stage:
    // NEW BILL JUST CREATED (highest priority — check once per period)
    const alreadyNotifiedCreated = allLogs?.find(l =>
      l.profile_id === warga.id &&
      l.notification_type === 'BILL_CREATED' &&
      l.period_month === currentMonth &&
      l.period_year === currentYear &&
      l.status === 'SENT'
    )
    if (currentBill && currentBill.status !== 'PAID' && !alreadyNotifiedCreated) {
      notificationType = 'BILL_CREATED'
      messageText = formatBillCreatedMessage(warga.full_name, monthName, currentYear, Number(currentBill.total_amount || 0))
    }
    // H-5 (Date 5 of month)
    else if (currentDateNum === 5 && currentBill && currentBill.status !== 'PAID') {
      notificationType = 'H_MINUS_5'
      messageText = formatHMinus5Message(warga.full_name, monthName, currentYear, Number(currentBill.total_amount || 0), `10 ${monthName} ${currentYear}`)
    }
    // DUE DATE (Date 10 of month)
    else if (currentDateNum === 10 && currentBill && currentBill.status !== 'PAID') {
      notificationType = 'DUE_DATE'
      messageText = formatDueDateMessage(warga.full_name, monthName, currentYear, Number(currentBill.total_amount || 0))
    }
    // OVERDUE 1 MONTH (Level 1)
    else if (dues.level === 1) {
      notificationType = 'OVERDUE_1M'
      messageText = formatOverdueMessage(warga.full_name, monthName, currentYear, dues.totalOverdueAmount)
    }
    // OVERDUE 2+ MONTHS (Level 2+)
    else if (dues.level >= 2) {
      notificationType = dues.level === 2 ? 'OVERDUE_2M' : 'OVERDUE_HEAVY'
      messageText = formatOverdueMultipleMessage(warga.full_name, dues.overduePeriods, dues.totalOverdueAmount)
    }

    if (!notificationType || !messageText) {
      continue
    }

    // Anti-Spam Check: Has notification of this type been sent in this period / within last 7 days?
    const existingLog = allLogs?.find(l =>
      l.profile_id === warga.id &&
      l.notification_type === notificationType &&
      l.period_month === currentMonth &&
      l.period_year === currentYear &&
      l.status === 'SENT'
    )

    if (existingLog) {
      skippedCount++
      continue
    }

    // Send Telegram Notification
    const tgRes = await sendTelegramMessage(warga.telegram_chat_id, messageText)
    const isOk = Boolean(tgRes && tgRes.ok)
    const status = isOk ? 'SENT' : 'FAILED'
    const errorMsg = isOk ? null : (tgRes?.description || 'Telegram API Error')

    await adminClient.from('notification_logs').insert({
      profile_id: warga.id,
      notification_type: notificationType,
      period_month: currentMonth,
      period_year: currentYear,
      telegram_chat_id: warga.telegram_chat_id,
      status,
      error_message: errorMsg
    })

    if (isOk) sentCount++
    else failedCount++
  }

  // 4. Send Summary Report to Admin Telegram Chat ID if configured
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (adminChatId && !searchParams.has('userIds')) {
    const sudahBayarCount = (wargaProfiles || []).filter(w => {
      const cb = allBills?.find(b => (b.profile_id === w.id || b.user_id === w.id) && b.period_month === currentMonth && b.period_year === currentYear)
      return cb?.status === 'PAID'
    }).length

    const belumBayarCount = totalWarga - sudahBayarCount

    const adminReportText = formatAdminSummaryReportMessage(monthName, currentYear, {
      totalWarga,
      sudahBayar: sudahBayarCount,
      belumBayar: belumBayarCount,
      totalDiterima,
      totalBelumTertagih,
      lancarCount,
      l1Count,
      l2Count,
      l3Count,
      l4Count
    })

    await sendTelegramMessage(adminChatId, adminReportText)
  }

  return NextResponse.json({
    success: true,
    summary: {
      totalWarga,
      sentCount,
      skippedCount,
      failedCount,
      monthName,
      year: currentYear
    }
  })
}
