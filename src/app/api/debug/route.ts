import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
export const dynamic = 'force-dynamic'

export async function GET() {
  const adminClient = createAdminClient()
  const { data: bills } = await adminClient.from('bills').select('*').order('created_at', { ascending: false }).limit(5)
  return NextResponse.json({ bills })
}
