import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const adminClient = createAdminClient()
  
  // Verify admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url), { status: 302 })

  const formData = await request.formData()
  const action = formData.get('action') as string

  if (action === 'update_fees') {
    const security = Number(formData.get('security'))
    const trash = Number(formData.get('trash'))
    const water = Number(formData.get('water'))
    const treasury = Number(formData.get('treasury'))

    const { error: settingsError } = await adminClient.from('settings').upsert({
      id: 'billing_fees',
      value: { security, trash, water, treasury }
    })

    if (settingsError) {
      console.error('Failed to update fees:', settingsError)
      return NextResponse.redirect(
        new URL(`/admin/pengaturan?error=${encodeURIComponent(settingsError.message)}`, request.url),
        { status: 302 }
      )
    }

    return NextResponse.redirect(new URL('/admin/pengaturan?success=1', request.url), { status: 302 })
  }
  
  if (action === 'generate_bills') {
    const month = formData.get('month')
    const year = formData.get('year')
    const userIds = formData.getAll('userIds') as string[]
    
    // Delegate to /api/cron: it generates bills AND sends the
    // Telegram notifications (new bill, H-5, due date, overdue). This keeps
    // manual triggering and the scheduled cron in sync — one source of truth.
    const cronSecret = process.env.CRON_SECRET
    const cronUrl = new URL('/api/cron', request.url)
    if (month) cronUrl.searchParams.set('month', month.toString())
    if (year) cronUrl.searchParams.set('year', year.toString())
    if (userIds.length > 0) cronUrl.searchParams.set('userIds', userIds.join(','))

    const cronRes = await fetch(cronUrl, {
      headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}
    })
    const result = await cronRes.json().catch(() => null)

    if (!cronRes.ok || !result?.success) {
      const errMsg = result?.error || `Gagal memproses tagihan (status ${cronRes.status})`
      console.error('generate_bills via /api/cron failed:', errMsg)
      return NextResponse.redirect(
        new URL(`/admin/pengaturan?error=${encodeURIComponent(errMsg)}`, request.url),
        { status: 302 }
      )
    }

    return NextResponse.redirect(
      new URL(`/admin/pengaturan?success=1&sent=${result.summary?.sentCount ?? 0}`, request.url),
      { status: 302 }
    )
  }

  return NextResponse.redirect(new URL('/admin/dashboard', request.url), { status: 302 })
}
