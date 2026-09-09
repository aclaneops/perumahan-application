import { createAdminClient } from './src/utils/supabase/admin'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function fixPratiwi() {
  const adminClient = createAdminClient()

  // Find Pratiwi
  const { data: profile } = await adminClient.from('profiles').select('*').ilike('full_name', '%Pratiwi%').single()
  if (!profile) {
    console.error("Pratiwi not found")
    return
  }

  // Find her bills
  const { data: bills } = await adminClient.from('bills').select('*').eq('user_id', profile.id)
  if (!bills) {
    console.error("No bills found")
    return
  }

  const bill9 = bills.find(b => b.period_month === 9 && b.period_year === 2026)
  const bill8 = bills.find(b => b.period_month === 8 && b.period_year === 2026)
  const bill7 = bills.find(b => b.period_month === 7 && b.period_year === 2026)

  if (!bill9 || !bill8 || !bill7) {
    console.error("Missing bills", { bill9, bill8, bill7 })
    return
  }

  // Find the payment for September
  const { data: payments } = await adminClient.from('payments').select('*').eq('bill_id', bill9.id)
  const payment9 = payments && payments.length > 0 ? payments[0] : null
  
  if (!payment9) {
    console.error("No payment found for September")
    return
  }

  console.log("Fixing payment:", payment9.id, "amount:", payment9.amount)

  // 1. Update September payment to 100,000
  await adminClient.from('payments').update({ amount: 100000 }).eq('id', payment9.id)

  // 2. Mark August and July as PAID
  await adminClient.from('bills').update({ status: 'PAID' }).in('id', [bill8.id, bill7.id])

  // 3. Create payments for August and July
  await adminClient.from('payments').insert([
    {
      bill_id: bill8.id,
      user_id: profile.id,
      profile_id: profile.id,
      amount: 100000,
      payment_proof_url: payment9.payment_proof_url || payment9.proof_url,
      status: 'VALIDATED',
      validated_by: payment9.validated_by,
      validated_at: payment9.validated_at,
      created_at: payment9.created_at,
      covered_items: payment9.covered_items
    },
    {
      bill_id: bill7.id,
      user_id: profile.id,
      profile_id: profile.id,
      amount: 100000,
      payment_proof_url: payment9.payment_proof_url || payment9.proof_url,
      status: 'VALIDATED',
      validated_by: payment9.validated_by,
      validated_at: payment9.validated_at,
      created_at: payment9.created_at,
      covered_items: payment9.covered_items
    }
  ])

  // Note: we don't need to insert transactions because Laporan reads from payments, 
  // but if the transactions table has a 'Pembayaran Iuran' for 300,000, we should fix it.
  const { data: txs } = await adminClient.from('transactions')
    .select('*')
    .eq('category', 'Pembayaran Iuran')
    .ilike('description', '%Pratiwi%')
    
  if (txs && txs.length > 0) {
    const tx300 = txs.find(t => Number(t.amount) === 300000)
    if (tx300) {
      await adminClient.from('transactions').update({ amount: 100000 }).eq('id', tx300.id)
      console.log("Fixed transaction:", tx300.id)
    }
  }

  console.log("DONE FIXING PRATIWI")
}

fixPratiwi()
