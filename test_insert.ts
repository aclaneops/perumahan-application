import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kdseosursjzyiyqrzojg.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const adminClient = createClient(SUPABASE_URL, SUPABASE_KEY.replace(/^"|"$/g, ''))

async function testInsert() {
  const { data, error } = await adminClient.from('transactions').insert({
    type: 'INCOME',
    category: 'Pembayaran Iuran',
    amount: 100000,
    description: `Pembayaran iuran bulan September 2026 dari Pratiwi (Item: Tagihan)`,
    created_by: 'cba863ba-0a85-4155-9b78-52f13f73c2e4', // Admin's id
    date: new Date().toISOString().split('T')[0]
  }).select()
  
  if (error) {
    console.error('Insert error:', error)
  } else {
    console.log('Insert success:', data)
  }
}
testInsert()
