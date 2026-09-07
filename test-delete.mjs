import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function testDelete() {
  // Let's get the user ID for "test"
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, full_name').eq('full_name', 'test')
  if (pErr || !profiles.length) {
    console.log('No user "test" found')
    return
  }
  const userId = profiles[0].id
  console.log('Found user:', userId)
  
  // Try to delete auth user
  const { data, error } = await supabase.auth.admin.deleteUser(userId)
  console.log('Delete result:', error ? error.message : 'Success')
}
testDelete()
