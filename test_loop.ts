import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kdseosursjzyiyqrzojg.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const adminClient = createClient(SUPABASE_URL, SUPABASE_KEY.replace(/^"|"$/g, ''))

async function testLoop() {
  const profileId = '5ca221a3-86ee-424c-8159-665b70e18f98'
  let remainingAmount = 200000

  const { data: unpaidBills } = await adminClient
    .from('bills')
    .select('id, period_month, period_year, total_amount, water_fee, trash_fee, security_fee, treasury_fee')
    .eq('user_id', profileId)
    .eq('status', 'UNPAID')
    .order('period_year', { ascending: true })
    .order('period_month', { ascending: true })

  console.log('unpaidBills count:', unpaidBills?.length)

  if (unpaidBills && unpaidBills.length > 0) {
    for (const unpaid of unpaidBills) {
      console.log('Processing bill:', unpaid.id, 'Total:', unpaid.total_amount)
      const unpaidTotal = Number(unpaid.total_amount) || 0
      
      if (remainingAmount >= unpaidTotal && unpaidTotal > 0) {
        console.log('Entering block for bill', unpaid.id)
        
        const { error: bErr } = await adminClient.from('bills').update({ 
          status: 'PAID',
          water_fee: 0, trash_fee: 0, security_fee: 0, treasury_fee: 0
        }).eq('id', unpaid.id)
        if (bErr) console.error('Bills update error:', bErr)
        else console.log('Bills updated')

        const { error: pErr } = await adminClient.from('payments').insert({
          bill_id: unpaid.id,
          profile_id: profileId,
          amount: unpaidTotal,
          payment_proof_url: 'test',
          validated_by: 'cba863ba-0a85-4155-9b78-52f13f73c2e4',
          validated_at: new Date().toISOString()
        })
        if (pErr) console.error('Payments insert error:', pErr)
        else console.log('Payment inserted')

        const bMonth = 'TEST'
        const { error: tErr } = await adminClient.from('transactions').insert({
          type: 'INCOME',
          category: 'Pembayaran Iuran',
          amount: unpaidTotal,
          description: `Pembayaran iuran bulan TEST dari TEST (Otomatis dari Lebih Bayar)`,
          created_by: 'cba863ba-0a85-4155-9b78-52f13f73c2e4',
          date: new Date().toISOString().split('T')[0]
        })
        if (tErr) console.error('Transactions insert error:', tErr)
        else console.log('Transaction inserted')
        
        remainingAmount -= unpaidTotal
      }
    }
  }
}
testLoop()
