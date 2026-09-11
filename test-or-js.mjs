import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const profileId = '9815ba0c-e3c1-4241-bdc8-0aa84c0ce59f'

async function run() {
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .or(`profile_id.eq.${profileId},user_id.eq.${profileId}`)
    .in('status', ['UNPAID'])
  console.log('Error:', error)
  console.log('Data length:', data?.length)
}
run()
