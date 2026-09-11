import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminClient = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: bills } = await adminClient.from('bills').select('*').limit(3).order('created_at', { ascending: false })
  console.log('Bills:', bills)
  
  const { data: payments } = await adminClient.from('payments').select('*').limit(3).order('created_at', { ascending: false })
  console.log('Payments:', payments)
}
run()
