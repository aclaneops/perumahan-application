import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/^"|"$/g, '')
  )
  const profileId = '5ca221a3-86ee-424c-8159-665b70e18f98'
  
  const { data: bills } = await adminClient.from('bills').select('*').eq('user_id', profileId)
  
  const bill9 = bills?.find((b: any) => b.period_month === 9 && b.period_year === 2026)
  const bill8 = bills?.find((b: any) => b.period_month === 8 && b.period_year === 2026)
  const bill7 = bills?.find((b: any) => b.period_month === 7 && b.period_year === 2026)

  const toReset = [bill7, bill8, bill9].filter(Boolean)
  
  for (const bill of toReset) {
    await adminClient.from('payments').delete().eq('bill_id', bill.id)
    await adminClient.from('bills').update({
      status: 'UNPAID',
      water_fee: 50000,
      trash_fee: 10000,
      security_fee: 30000,
      treasury_fee: 10000
    }).eq('id', bill.id)
  }

  // Remove the bad transactions
  await adminClient.from('transactions').delete().eq('category', 'Pembayaran Iuran').ilike('description', '%Pratiwi%')
  await adminClient.from('transactions').delete().eq('category', 'Pembayaran Iuran').ilike('description', '%Otomatis%')
  await adminClient.from('transactions').delete().eq('category', 'Lebih Bayar Tagihan').ilike('description', '%Pratiwi%')
  await adminClient.from('transactions').delete().eq('category', 'Pembayaran Iuran').ilike('description', '%Warga%')

  return NextResponse.json({ success: true, message: "Resetted Pratiwi data" })
}
