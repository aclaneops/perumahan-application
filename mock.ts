import { createAdminClient } from './src/utils/supabase/admin'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function mockValidation() {
  const adminClient = createAdminClient()
  const paymentId = '44c867ea-8f01-47cf-9216-1b1c4c3b8cd4'
  
  const { data: payment } = await adminClient.from('payments').select('*').eq('id', paymentId).single()
  console.log("Payment:", payment)
  
  const billId = payment.bill_id
  const { data: bill } = await adminClient.from('bills').select('*').eq('id', billId).single()
  console.log("Bill:", bill)
  
  const profileId = bill.profile_id || bill.user_id
  console.log("ProfileId:", profileId)
  
  const { data: unpaidBills } = await adminClient
    .from('bills')
    .select('id, period_month, period_year, total_amount, water_fee, trash_fee, security_fee, treasury_fee')
    .eq('user_id', profileId)
    .in('status', ['UNPAID', 'PARTIAL'])
    .order('period_year', { ascending: true })
    .order('period_month', { ascending: true })
    
  console.log("Unpaid Bills Count:", unpaidBills?.length)
  console.log("Unpaid Bills:", unpaidBills)
}

mockValidation()
