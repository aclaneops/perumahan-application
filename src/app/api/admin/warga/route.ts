import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const full_name = formData.get('full_name') as string
    const house_number = formData.get('house_number') as string
    const phone_number = formData.get('phone_number') as string
    const role = formData.get('role') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email || !password || !full_name || !house_number) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 1. Create user in auth schema using admin api
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true // auto confirm email
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    const userId = authData.user.id

    // 2. Insert into profiles table
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: userId,
        full_name,
        house_number,
        phone_number,
        role
      })

    if (profileError) {
      console.error('Error creating profile:', profileError)
      // Cleanup: delete the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.redirect(new URL('/admin/warga', request.url), { status: 302 })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
