import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { userId, action } = await request.json()

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (action === 'create_super_admin') {
    const { error } = await adminClient
      .from('profiles')
      .upsert({
        id: userId,
        full_name: 'Bapak Ketua RT',
        house_number: 'A1',
        role: 'super_admin'
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ role: 'super_admin' })
  }

  // Default: fetch role
  const { data, error } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ role: data?.role ?? null })
}
