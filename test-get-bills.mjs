import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function run() {
  const { data: profile } = await supabase.from('profiles').select('id').eq('house_number', 'a50').single()
  if (profile) {
    const { data: bills } = await supabase.from('bills').select('*').eq('profile_id', profile.id)
    console.log("BILLS for a50:", bills)
    
    const { data: payments } = await supabase.from('payments').select('*').eq('profile_id', profile.id)
    console.log("PAYMENTS for a50:", payments)
  }
}
run()
