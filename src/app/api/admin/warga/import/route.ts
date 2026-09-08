import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data } = body

    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    let successCount = 0

    for (const item of data) {
      const full_name = item.full_name
      const house_number = item.house_number
      const phone_number = item.phone_number || ''
      const role = 'user'

      if (!full_name || !house_number) {
        continue // Skip invalid rows
      }

      // Generate a dummy email and password since they don't have one from Excel
      const cleanName = full_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      const cleanHouse = house_number.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      const email = `${cleanName}${cleanHouse}@griyasartika.com`
      const password = `123456`

      // 1. Create user in auth schema using admin api
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true 
      })

      if (authError) {
        console.error(`Error creating auth user for ${full_name}:`, authError)
        continue // Skip if error and move to next
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
        console.error(`Error creating profile for ${full_name}:`, profileError)
        // Cleanup: delete the auth user if profile creation fails
        await adminClient.auth.admin.deleteUser(userId)
        continue
      }

      successCount++
    }

    return NextResponse.json({ success: true, count: successCount }, { status: 200 })
  } catch (error: any) {
    console.error('Unexpected error during import:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
