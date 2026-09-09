import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/^"|"$/g, '')
)

async function test() {
  const profileId = '5ca221a3-86ee-424c-8159-665b70e18f98'
  const paymentId = '8fc972d3-abe9-48f9-a491-cb90b05b6671'

  const { data: payment } = await adminClient.from('payments').select('*').eq('id', paymentId).single()
  console.log('payment:', payment)

  const { data: unpaidBills } = await adminClient
    .from('bills')
    .select('id, period_month, period_year, total_amount, water_fee, trash_fee, security_fee, treasury_fee')
    .eq('user_id', profileId)
    .eq('status', 'UNPAID')
    .order('period_year', { ascending: true })
    .order('period_month', { ascending: true })

  console.log('unpaidBills:', unpaidBills)
}

test()
