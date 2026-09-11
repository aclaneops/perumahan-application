import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminClient = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await adminClient.from('transactions').insert({
    type: 'INCOME',
    category: 'Pembayaran Iuran',
    amount: 60000,
    description: 'Test manual script',
    created_by: 'cba863ba-0a85-4155-9b78-52f13f73c2e4',
    date: '2026-09-11'
  }).select()
  console.log('Result:', data)
  console.log('Error:', error)
}
run()
