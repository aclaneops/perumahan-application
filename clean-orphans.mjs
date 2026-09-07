import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function clean() {
  // Get all users in auth.users that do not have a profile
  const { data: users, error: uErr } = await supabase.auth.admin.listUsers()
  if (uErr) {
    console.error('Error fetching users:', uErr)
    return
  }

  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id')
  if (pErr) {
    console.error('Error fetching profiles:', pErr)
    return
  }

  const profileIds = new Set(profiles.map(p => p.id))
  
  for (const user of users.users) {
    if (!profileIds.has(user.id)) {
      console.log(`User ${user.email} (${user.id}) has no profile. Attempting to delete...`)
      const { error: delErr } = await supabase.auth.admin.deleteUser(user.id)
      if (delErr) {
        console.error(`Failed to delete ${user.email}:`, delErr.message)
      } else {
        console.log(`Successfully deleted orphaned user ${user.email}`)
      }
    }
  }
}

clean()
