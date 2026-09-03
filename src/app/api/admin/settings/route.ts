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

    await adminClient.from('settings').upsert({
      id: 'billing_fees',
      value: { security, trash, water, treasury }
    })
    
    return NextResponse.redirect(new URL('/admin/pengaturan?success=1', request.url), { status: 302 })
  }
  
  if (action === 'generate_bills') {
    const month = Number(formData.get('month'))
    const year = Number(formData.get('year'))

    // Get current fees
    const { data: settings } = await adminClient
      .from('settings')
      .select('value')
      .eq('id', 'billing_fees')
      .single()

    const fees = settings?.value || { water: 0, trash: 0, security: 0, treasury: 0 }

    // Get all warga biasa (role = user) only
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('role', 'user')

    console.log('Profiles for billing:', profiles, profilesError)

    if (profiles) {
      // Create bills for all
      const newBills = profiles.map(p => ({
        profile_id: p.id,
        period_month: month,
        period_year: year,
        water_fee: fees.water,
        trash_fee: fees.trash,
        security_fee: fees.security,
        treasury_fee: fees.treasury,
        status: 'UNPAID'
      }))

      // Ignore duplicates if there's a unique constraint on (user_id, period_month, period_year)
      await adminClient.from('bills').insert(newBills)
    }

    return NextResponse.redirect(new URL('/admin/dashboard?success=1', request.url), { status: 302 })
  }

  return NextResponse.redirect(new URL('/admin/dashboard', request.url), { status: 302 })
}
