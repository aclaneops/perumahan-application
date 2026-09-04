import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'
import { sendTelegramMessage, formatPaymentConfirmedMessage, formatPaymentRejectedMessage } from '@/lib/telegram'
import { MONTH_NAMES } from '@/lib/dues'

export async function POST(request: Request) {
  const supabase = createClient()
  const formData = await request.formData()
  const billId = formData.get('billId')
  const paymentId = formData.get('paymentId')
  const action = formData.get('action')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url), { status: 302 })

  const adminClient = createAdminClient()

  if (action === 'approve') {
    // 1. Fetch the payment being approved
    const { data: payment } = await adminClient.from('payments').select('amount').eq('id', paymentId).single()
    const thisAmount = Number(payment?.amount || 0)

    // 2. Fetch all OTHER validated payments for this bill
    const { data: otherPayments } = await adminClient.from('payments')
      .select('amount')
      .eq('bill_id', billId)
      .not('validated_by', 'is', null)

    const previousPaid = otherPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
    const totalPaidNow = previousPaid + thisAmount

    // 3. Fetch bill total amount
    const { data: bill } = await adminClient.from('bills').select('total_amount, profile_id, user_id, period_month, period_year').eq('id', billId).single()
    const billTotal = Number(bill?.total_amount || 0)

    // 4. Update bill status
    const newStatus = totalPaidNow >= billTotal ? 'PAID' : 'PARTIAL'
    await adminClient.from('bills').update({ status: newStatus }).eq('id', billId)

    // 5. Mark payment as validated (supporting both validated_by and confirmed_by)
    const { error: valErr } = await adminClient.from('payments').update({ 
      validated_by: user.id,
      validated_at: new Date().toISOString()
    }).eq('id', paymentId)

    if (valErr) {
      await adminClient.from('payments').update({ 
        confirmed_by: user.id,
        paid_at: new Date().toISOString()
      }).eq('id', paymentId)
    }

    // Notify resident via Telegram (only when the bill is now fully PAID)
    if (newStatus === 'PAID' && (bill?.profile_id || bill?.user_id)) {
      const { data: residentProfile } = await adminClient
        .from('profiles')
        .select('full_name, telegram_chat_id')
        .eq('id', bill.profile_id || bill.user_id)
        .maybeSingle()

      if (residentProfile?.telegram_chat_id) {
        const monthName = bill?.period_month ? (MONTH_NAMES[bill.period_month - 1] || `Bulan ${bill.period_month}`) : '-'
        const msg = formatPaymentConfirmedMessage(
          residentProfile.full_name || 'Warga',
          monthName,
          bill?.period_year || new Date().getFullYear(),
          totalPaidNow,
          new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        )
        await sendTelegramMessage(residentProfile.telegram_chat_id, msg)
      }
    }
  } else if (action === 'reject') {
    // Fetch bill info (for notification) + previous payments to see if there were any partial payments already
    const { data: billForReject } = await adminClient.from('bills').select('profile_id, user_id, period_month, period_year').eq('id', billId).single()
    const { data: otherPayments } = await adminClient.from('payments')
      .select('amount')
      .eq('bill_id', billId)
      .neq('id', paymentId)
      .not('validated_by', 'is', null)

    const previousPaid = otherPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
    
    // 1. Revert bill status to previous state
    const newStatus = previousPaid > 0 ? 'PARTIAL' : 'UNPAID'
    await adminClient.from('bills').update({ status: newStatus }).eq('id', billId)
    
    // 2. Delete rejected payment proof
    await adminClient.from('payments').delete().eq('id', paymentId)

    // 3. Notify resident via Telegram
    if (billForReject?.profile_id || billForReject?.user_id) {
      const { data: residentProfile } = await adminClient
        .from('profiles')
        .select('full_name, telegram_chat_id')
        .eq('id', billForReject.profile_id || billForReject.user_id)
        .maybeSingle()

      if (residentProfile?.telegram_chat_id) {
        const monthName = billForReject?.period_month ? (MONTH_NAMES[billForReject.period_month - 1] || `Bulan ${billForReject.period_month}`) : '-'
        const msg = formatPaymentRejectedMessage(
          residentProfile.full_name || 'Warga',
          monthName,
          billForReject?.period_year || new Date().getFullYear()
        )
        await sendTelegramMessage(residentProfile.telegram_chat_id, msg)
      }
    }
  }

  return NextResponse.redirect(new URL('/admin/dashboard', request.url), { status: 302 })
}
