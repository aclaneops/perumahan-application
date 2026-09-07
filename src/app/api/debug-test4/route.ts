import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const adminClient = createAdminClient()
  const { data, error } = await adminClient.from('payments').select('id, profile_id').limit(1)
  return NextResponse.json({ data, error })
}
