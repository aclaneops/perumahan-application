import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { MONTH_NAMES } from '@/lib/dues'

export async function GET(request: Request) {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/^"|"$/g, '')
  )
  
  const paymentId = "bc74d407-8ca1-4727-b3c1-6a06afabf2ea"
  const billId = "3b7650ff-1418-4d64-a905-3e707e7f010b"
  const userId = "cba863ba-0a85-4155-9b78-52f13f73c2e4" // admin id
  
  const logs = []
  
  try {
    const { data: payment } = await adminClient.from('payments').select('*').eq('id', paymentId).single()
    const thisAmount = Number(payment?.amount || 0)
    logs.push({ step: 'payment', thisAmount })

    const { data: bill } = await adminClient.from('bills').select('*').eq('id', billId).single()
    const profileId = bill?.profile_id || bill?.user_id
    const billOriginalTotal = Number(bill.total_amount || 0)
    logs.push({ step: 'bill', profileId, billOriginalTotal })

    let remainingAmount = thisAmount
    let newWater = Number(bill.water_fee || 0)
    let newTrash = Number(bill.trash_fee || 0)
    let newSecurity = Number(bill.security_fee || 0)
    let newTreasury = Number(bill.treasury_fee || 0)
    let paidItemsStrArr: string[] = []

    if (payment?.covered_items) {
      if (payment.covered_items.water) { remainingAmount -= newWater; newWater = 0; paidItemsStrArr.push('Air') }
      if (payment.covered_items.trash) { remainingAmount -= newTrash; newTrash = 0; paidItemsStrArr.push('Sampah') }
      if (payment.covered_items.security) { remainingAmount -= newSecurity; newSecurity = 0; paidItemsStrArr.push('Keamanan') }
      if (payment.covered_items.treasury) { remainingAmount -= newTreasury; newTreasury = 0; paidItemsStrArr.push('Kas RT') }
    } else {
      remainingAmount -= billOriginalTotal
      newWater = 0; newTrash = 0; newSecurity = 0; newTreasury = 0;
      paidItemsStrArr.push('Tagihan Bulanan')
    }

    const itemsPaidStr = paidItemsStrArr.length > 0 ? paidItemsStrArr.join(', ') : 'Tagihan'

    const amountUsedForPrimary = thisAmount - Math.max(0, remainingAmount)
    logs.push({ step: 'calc', remainingAmount, amountUsedForPrimary })

    // Simulate arrears logic
    let excessMsg = ''
    const settledBills = [bill?.period_month ? `${MONTH_NAMES[bill.period_month - 1]} ${bill.period_year}` : '']

    if (remainingAmount > 0 && profileId) {
      logs.push({ step: 'enter remainingAmount block' })
      
      const { data: unpaidBills, error: unpaidErr } = await adminClient
        .from('bills')
        .select('id, period_month, period_year, total_amount, water_fee, trash_fee, security_fee, treasury_fee')
        .eq('user_id', profileId)
        .eq('status', 'UNPAID')
        .order('period_year', { ascending: true })
        .order('period_month', { ascending: true })

      logs.push({ step: 'unpaid bills', count: unpaidBills?.length, error: unpaidErr })

      if (unpaidBills && unpaidBills.length > 0) {
        for (const unpaid of unpaidBills) {
          const unpaidTotal = Number(unpaid.total_amount) || 0
          logs.push({ step: 'eval unpaid', month: unpaid.period_month, unpaidTotal, remainingAmount })
          
          if (remainingAmount >= unpaidTotal && unpaidTotal > 0) {
            logs.push({ step: 'paying unpaid', month: unpaid.period_month })
            
            const { error: err1 } = await adminClient.from('bills').update({ 
              status: 'PAID',
              water_fee: 0, trash_fee: 0, security_fee: 0, treasury_fee: 0
            }).eq('id', unpaid.id)
            
            if (err1) logs.push({ step: 'error updating bill', err1 })
            
            const { error: err2 } = await adminClient.from('payments').insert({
              bill_id: unpaid.id,
              profile_id: profileId,
              user_id: profileId,
              amount: unpaidTotal,
              proof_url: payment?.proof_url || payment?.payment_proof_url,
              validated_by: userId,
              validated_at: new Date().toISOString()
            })
            
            if (err2) logs.push({ step: 'error inserting payment', err2 })

            const bMonth = unpaid.period_month ? MONTH_NAMES[unpaid.period_month - 1] : '-'
            const { error: err3 } = await adminClient.from('transactions').insert({
              type: 'INCOME',
              category: 'Pembayaran Iuran',
              amount: unpaidTotal,
              description: `Pembayaran iuran bulan ${bMonth} ${unpaid.period_year} dari Warga (Otomatis dari Lebih Bayar)`,
              created_by: userId,
              date: new Date().toISOString().split('T')[0]
            })
            
            if (err3) logs.push({ step: 'error inserting transaction', err3 })

            remainingAmount -= unpaidTotal
            settledBills.push(`${bMonth} ${unpaid.period_year}`)
          } else if (remainingAmount > 0) {
            logs.push({ step: 'breaking loop partial' })
            break
          } else {
            logs.push({ step: 'breaking loop empty' })
            break 
          }
        }
      }
      
      if (remainingAmount > 0) {
        logs.push({ step: 'excess remaining' })
      }
    }
    
    return NextResponse.json({ logs, remainingAmount })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack, logs })
  }
}
