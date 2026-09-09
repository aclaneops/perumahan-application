import { createAdminClient } from './src/utils/supabase/admin'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function checkBills() {
  const adminClient = createAdminClient()
  const { data, error } = await adminClient.from('bills').select('*').limit(1)
  console.log("Bills schema:", Object.keys(data?.[0] || {}))
}

checkBills()
