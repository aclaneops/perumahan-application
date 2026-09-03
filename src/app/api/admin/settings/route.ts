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

    if (profiles && profiles.length > 0) {
      // Create bills for all
      const newBills = profiles.map(p => ({
        profile_id: p.id,
        user_id: p.id, // required NOT NULL column, was missing before
        period_month: month,
        period_year: year,
        water_fee: fees.water,
        trash_fee: fees.trash,
        security_fee: fees.security,
        treasury_fee: fees.treasury,
        status: 'UNPAID'
      }))

      // Upsert + ignoreDuplicates so clicking this twice for the same month never errors out
      const { error: billsError } = await adminClient
        .from('bills')
        .upsert(newBills, { onConflict: 'profile_id,period_month,period_year', ignoreDuplicates: true })

      if (billsError) {
        console.error('Failed to generate bills:', billsError)
        return NextResponse.redirect(new URL('/admin/pengaturan?error=1', request.url), { status: 302 })
      }
    }

    return NextResponse.redirect(new URL('/admin/dashboard?success=1', request.url), { status: 302 })
  }

  return NextResponse.redirect(new URL('/admin/dashboard', request.url), { status: 302 })
}
