import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

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
    const { data: bill } = await adminClient.from('bills').select('total_amount').eq('id', billId).single()
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
  } else if (action === 'reject') {
    // Fetch previous payments to see if there were any partial payments already
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
  }

  return NextResponse.redirect(new URL('/admin/dashboard', request.url), { status: 302 })
}
