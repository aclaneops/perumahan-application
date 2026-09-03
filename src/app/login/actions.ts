'use server'

import { createAdminClient } from '@/utils/supabase/admin'

export async function createSuperAdminProfile(userId: string) {
  const adminClient = createAdminClient()
  
  const { error } = await adminClient
    .from('profiles')
    .upsert({
      id: userId,
      full_name: 'Bapak Ketua RT',
      house_number: 'A1',
      role: 'super_admin'
    })
    
  if (error) {
    return { error: error.message }
  }
  
  return { success: true }
}

export async function fetchUserRole(userId: string) {
  const adminClient = createAdminClient()
  
  const { data, error } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('fetchUserRole error:', error)
    return { role: null, error: error.message }
  }
  
  return { role: data?.role ?? null, error: null }
}
