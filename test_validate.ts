import { createAdminClient } from './src/utils/supabase/admin'

async function testValidate() {
  const adminClient = createAdminClient()
  const paymentId = '1e71eeec-d35e-450a-9d66-70eebbbbd7db' // Let's find the latest payment id
  
  const { data: payments } = await adminClient.from('payments').select('*').order('created_at', { ascending: false }).limit(1)
  console.log('Latest payment:', payments)
}
testValidate()
