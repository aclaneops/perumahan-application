import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET() {
  const adminClient = createAdminClient()
  const paymentId = '44c867ea-8f01-47cf-9216-1b1c4c3b8cd4'
  
  const { data: payment } = await adminClient.from('payments').select('*').eq('id', paymentId).single()
  const billId = payment.bill_id
  const { data: bill } = await adminClient.from('bills').select('*').eq('id', billId).single()
  
  const profileId = bill.profile_id || bill.user_id
  
  const { data: allBills } = await adminClient
    .from('bills')
    .select('id, period_month, period_year, total_amount, water_fee, trash_fee, security_fee, treasury_fee, status')
    .eq('user_id', profileId)
    .order('period_year', { ascending: true })
    .order('period_month', { ascending: true })
    
  const { data: allPayments } = await adminClient
    .from('payments')
    .select('*')
    .eq('profile_id', profileId)
    
  return NextResponse.json({ payment, bill, allBills, allPayments })
}
