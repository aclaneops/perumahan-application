import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  sendTelegramMessage,
  formatPaymentAutoValidatedMessage,
  formatPaymentConfirmedMessage
} from '@/lib/telegram'
import { MONTH_NAMES } from '@/lib/dues'

// Auto-validate payments that have been pending for more than 15 minutes
// and have an amount >= the bill's total_amount.
// This endpoint is meant to be called by a cron job every 5 minutes.
export async function GET(request: Request) {
  // Authorization: same CRON_SECRET used in the main cron job
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const now = new Date()

  // Calculate the cutoff time: 15 minutes ago
  const cutoff = new Date(now.getTime() - 15 * 60 * 1000).toISOString()

  // Fetch all bills in PENDING_CONFIRMATION status that were updated > 15 minutes ago
  const { data: pendingBills, error: billsError } = await adminClient
    .from('bills')
    .select('id, profile_id, user_id, total_amount, period_month, period_year, updated_at')
    .eq('status', 'PENDING_CONFIRMATION')
    .lt('updated_at', cutoff)

  if (billsError) {
    console.error('Error fetching pending bills:', billsError)
    return NextResponse.json({ error: billsError.message }, { status: 500 })
  }

  if (!pendingBills || pendingBills.length === 0) {
    return NextResponse.json({ success: true, validated: 0, message: 'Tidak ada pembayaran menunggu validasi.' })
  }

  let validatedCount = 0
  const skipped: string[] = []
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID

  for (const bill of pendingBills) {
    const profileId = bill.profile_id || bill.user_id

    // Find the latest payment for this bill
    const { data: payment } = await adminClient
      .from('payments')
      .select('id, amount')
      .eq('bill_id', bill.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!payment) {
      skipped.push(bill.id)
      continue
    }

    const paidAmount = Number(payment.amount) || 0
    const totalAmount = Number(bill.total_amount) || 0

    // Only auto-validate if amount paid >= total bill amount
    if (paidAmount < totalAmount) {
      skipped.push(bill.id)
      continue
    }

    // Mark bill as PAID
    const { error: updateError } = await adminClient
      .from('bills')
      .update({ status: 'PAID' })
      .eq('id', bill.id)

    if (updateError) {
      console.error(`Failed to update bill ${bill.id}:`, updateError)
      skipped.push(bill.id)
      continue
    }

    validatedCount++

    // Fetch warga profile for notification
    const { data: profile } = await adminClient
      .from('profiles')
      .select('full_name, house_number, telegram_chat_id')
      .eq('id', profileId)
      .maybeSingle()

    const monthName = bill.period_month
      ? (MONTH_NAMES[bill.period_month - 1] || `Bulan ${bill.period_month}`)
      : '-'
    const year = bill.period_year || now.getFullYear()
    const name = profile?.full_name || 'Warga'
    const houseNumber = profile?.house_number || '-'
    const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

    // Notify warga via Telegram (LUNAS notification)
    if (profile?.telegram_chat_id) {
      const wargaMsg = formatPaymentConfirmedMessage(name, monthName, year, paidAmount, dateStr)
      await sendTelegramMessage(profile.telegram_chat_id, wargaMsg)
    }

    // Notify admin via Telegram (auto-validated info)
    if (adminChatId) {
      const adminMsg = formatPaymentAutoValidatedMessage(name, houseNumber, monthName, year, paidAmount)
      await sendTelegramMessage(adminChatId, adminMsg)
    }
  }

  return NextResponse.json({
    success: true,
    validated: validatedCount,
    skipped: skipped.length,
    message: `${validatedCount} pembayaran berhasil divalidasi otomatis.`
  })
}
