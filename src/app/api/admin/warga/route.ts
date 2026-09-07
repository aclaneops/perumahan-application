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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    
    try {
      // First, delete transactions created by this user
      await adminClient.from('transactions').delete().eq('created_by', id)
      
      // Get all bills for this user
      const { data: bills } = await adminClient.from('bills').select('id').eq('user_id', id)
      if (bills && bills.length > 0) {
        const billIds = bills.map(b => b.id)
        // Delete all payments associated with these bills
        await adminClient.from('payments').delete().in('bill_id', billIds)
      }
      
      // If this user was an admin, they might have confirmed payments (which has a RESTRICT constraint)
      await adminClient.from('payments').update({ confirmed_by: null }).eq('confirmed_by', id)
      
      // Delete their bills
      await adminClient.from('bills').delete().eq('user_id', id)
      
      // Delete their telegram pairings and notification logs
      await adminClient.from('telegram_pairings').delete().eq('profile_id', id)
      await adminClient.from('notification_logs').delete().eq('profile_id', id)
      
      // Delete their profile
      await adminClient.from('profiles').delete().eq('id', id)
    } catch (cleanupError) {
      console.error('Error during pre-deletion cleanup:', cleanupError)
    }

    // Finally, delete auth user
    const { error: authError } = await adminClient.auth.admin.deleteUser(id)

    if (authError) {
      console.error('Error deleting auth user:', authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
