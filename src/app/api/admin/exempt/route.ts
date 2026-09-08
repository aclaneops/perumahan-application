import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const formData = await request.formData()
  const billId = formData.get('billId') as string
  const reason = formData.get('reason') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url), { status: 302 })

  const adminClient = createAdminClient()

  // 1. Fetch the bill
  const { data: bill } = await adminClient
    .from('bills')
    .select('*')
    .eq('id', billId)
    .single()

  if (!bill) {
    return NextResponse.redirect(new URL('/admin/dashboard?error=Bill_Not_Found', request.url), { status: 302 })
  }

  // 2. Fetch all payments for this bill
  const { data: payments } = await adminClient
    .from('payments')
    .select('amount, covered_items')
    .eq('bill_id', billId)
    .not('validated_by', 'is', null)

  const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0

  // 3. Determine which items were covered
  // We'll merge covered items from all validated payments
  let coveredItems: any = {}
  let hasCoveredItems = false

  payments?.forEach(p => {
    if (p.covered_items) {
      hasCoveredItems = true
      Object.assign(coveredItems, p.covered_items)
    }
  })

  let newWater = Number(bill.water_fee)
  let newTrash = Number(bill.trash_fee)
  let newSecurity = Number(bill.security_fee)
  let newTreasury = Number(bill.treasury_fee)

  if (hasCoveredItems) {
    // Zero out items that are NOT covered
    if (!coveredItems.water) newWater = 0
    if (!coveredItems.trash) newTrash = 0
    if (!coveredItems.security) newSecurity = 0
    if (!coveredItems.treasury) newTreasury = 0
  } else {
    // Fallback if no covered_items JSON exists: just set water to totalPaid and rest to 0 to balance it
    newWater = totalPaid
    newTrash = 0
    newSecurity = 0
    newTreasury = 0
  }

  // 4. Update the bill with zeroed out fees and the exemption note
  await adminClient.from('bills').update({
    water_fee: newWater,
    trash_fee: newTrash,
    security_fee: newSecurity,
    treasury_fee: newTreasury,
    status: 'PAID', // It is now fully paid because total_amount will equal totalPaid
    notes: `Pengecualian: ${reason}`
  }).eq('id', billId)

  // Redirect back
  const referer = request.headers.get('referer')
  const redirectUrl = referer || '/admin/dashboard'
  
  return NextResponse.redirect(new URL(redirectUrl, request.url), { status: 302 })
}
