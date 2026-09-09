import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET() {
  const adminClient = createAdminClient()
  const profileId = '5ca221a3-86ee-424c-8159-665b70e18f98'
  let remainingAmount = 200000
  let results = []

  const { data: unpaidBills, error: fetchErr } = await adminClient
    .from('bills')
    .select('id, period_month, period_year, total_amount, water_fee, trash_fee, security_fee, treasury_fee')
    .eq('user_id', profileId)
    .eq('status', 'UNPAID')
    .order('period_year', { ascending: true })
    .order('period_month', { ascending: true })

  results.push({ action: 'fetch bills', unpaidBills, fetchErr })

  if (unpaidBills && unpaidBills.length > 0) {
    for (const unpaid of unpaidBills) {
      const unpaidTotal = Number(unpaid.total_amount) || 0
      results.push({ action: 'processing bill', unpaid, unpaidTotal, remainingAmount })
      
      if (remainingAmount >= unpaidTotal && unpaidTotal > 0) {
        const { error: bErr } = await adminClient.from('bills').update({ 
          status: 'PAID',
          water_fee: 0, trash_fee: 0, security_fee: 0, treasury_fee: 0
        }).eq('id', unpaid.id)
        results.push({ action: 'update bill', billId: unpaid.id, bErr })

        const { error: pErr } = await adminClient.from('payments').insert({
          bill_id: unpaid.id,
          profile_id: profileId,
          amount: unpaidTotal,
          payment_proof_url: 'test',
          validated_by: 'cba863ba-0a85-4155-9b78-52f13f73c2e4',
          validated_at: new Date().toISOString()
        })
        results.push({ action: 'insert payment', pErr })

        const { error: tErr } = await adminClient.from('transactions').insert({
          type: 'INCOME',
          category: 'Pembayaran Iuran',
          amount: unpaidTotal,
          description: `TEST iuran otomatis dari Lebih Bayar`,
          created_by: 'cba863ba-0a85-4155-9b78-52f13f73c2e4',
          date: new Date().toISOString().split('T')[0]
        })
        results.push({ action: 'insert transaction', tErr })
        
        remainingAmount -= unpaidTotal
      }
    }
  }
  return NextResponse.json(results)
}
