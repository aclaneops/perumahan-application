import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kdseosursjzyiyqrzojg.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const adminClient = createClient(SUPABASE_URL, SUPABASE_KEY.replace(/^"|"$/g, ''))

async function testE2E() {
  const profileId = '5ca221a3-86ee-424c-8159-665b70e18f98'
  const billId = '0ffaed83-6b5c-4166-8395-9ebec392a755' // Month 9

  // 1. Create a payment for 300,000
  const { data: payment, error: pErr } = await adminClient.from('payments').insert({
    bill_id: billId,
    profile_id: profileId,
    amount: 300000,
    payment_proof_url: 'https://example.com/proof.jpg',
    covered_items: { water: true, trash: true, security: true, treasury: true }
  }).select().single()

  if (pErr) { console.error('Payment insert error:', pErr); return; }

  console.log('Created payment:', payment.id)

  // 2. Call validate route
  const res = await fetch('http://localhost:3000/api/admin/validate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': `sb-kdseosursjzyiyqrzojg-auth-token=${process.env.ADMIN_COOKIE || ''}`
    },
    body: `payment_id=${payment.id}&action=approve`
  })

  // We won't have the cookie easily, so let's just do it in a Next.js API route!
}

testE2E()
