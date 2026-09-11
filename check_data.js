// Check what's actually in the payments table
const SUPABASE_URL = 'https://kdseosursjzyiyqrzojg.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
}

async function main() {
  // Get recent payments
  const res = await fetch(`${SUPABASE_URL}/rest/v1/payments?select=*&order=created_at.desc&limit=5`, { headers })
  const payments = await res.json()
  
  console.log('=== 5 PAYMENT TERBARU ===\n')
  for (const p of payments) {
    console.log(`ID: ${p.id}`)
    console.log(`  bill_id: ${p.bill_id}`)
    console.log(`  profile_id: ${p.profile_id}`)
    console.log(`  amount: ${p.amount} (type: ${typeof p.amount})`)
    console.log(`  covered_items: ${JSON.stringify(p.covered_items)}`)
    console.log(`  payment_proof_url: ${p.payment_proof_url}`)
    console.log(`  proof_url: ${p.proof_url}`)
    console.log(`  validated_by: ${p.validated_by}`)
    console.log(`  ALL COLUMNS:`, JSON.stringify(p, null, 2))
    console.log('')
  }

  // Also check bills
  const res2 = await fetch(`${SUPABASE_URL}/rest/v1/bills?select=*&order=created_at.desc&limit=5`, { headers })
  const bills = await res2.json()
  
  console.log('=== 5 BILL TERBARU ===\n')
  for (const b of bills) {
    console.log(`ID: ${b.id}`)
    console.log(`  profile_id: ${b.profile_id}, user_id: ${b.user_id}`)
    console.log(`  period: ${b.period_month}/${b.period_year}`)
    console.log(`  total_amount: ${b.total_amount}`)
    console.log(`  water_fee: ${b.water_fee}, trash_fee: ${b.trash_fee}, security_fee: ${b.security_fee}, treasury_fee: ${b.treasury_fee}`)
    console.log(`  status: ${b.status}`)
    console.log('')
  }
}

main().catch(console.error)
