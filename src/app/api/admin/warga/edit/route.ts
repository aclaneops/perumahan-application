import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const adminClient = createAdminClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url), { status: 302 })

  const formData = await request.formData()
  const userId = formData.get('user_id') as string
  const full_name = formData.get('full_name') as string
  const house_number = formData.get('house_number') as string
  const phone_number = formData.get('phone_number') as string
  const role = formData.get('role') as string

  if (userId) {
    await adminClient.from('profiles').update({
      full_name,
      house_number,
      phone_number,
      role
    }).eq('id', userId)
  }

  return NextResponse.redirect(new URL('/admin/warga', request.url), { status: 302 })
}
