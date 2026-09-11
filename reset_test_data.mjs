import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kdseosursjzyiyqrzojg.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = createClient(supabaseUrl, supabaseKey)

async function resetTestData() {
  console.log('=== RESET DATA TES ===\n')

  // 1. Cari profile test users
  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select('id, full_name, house_number')

  if (pErr) { console.error('Error fetch profiles:', pErr); return }
  
  console.log('Semua profil:')
  profiles.forEach(p => console.log(`  - ${p.full_name} (${p.house_number}) -> ${p.id}`))
  console.log('')

  // Cari user test (a50) dan test4 (a51)
  const testUsers = profiles.filter(p => 
    p.house_number === 'a50' || p.house_number === 'a51' ||
    (p.full_name && (p.full_name.toLowerCase().includes('test')))
  )

  if (testUsers.length === 0) {
    console.log('Tidak ada user test ditemukan. Cek manual.')
    return
  }

  console.log('User test yang ditemukan:')
  testUsers.forEach(p => console.log(`  - ${p.full_name} (${p.house_number}) -> ${p.id}`))
  console.log('')

  for (const user of testUsers) {
    const userId = user.id

    // Hapus payments untuk user ini
    const { data: payments, error: payErr } = await admin
      .from('payments')
      .select('id, bill_id, amount')
      .eq('profile_id', userId)

    if (payments && payments.length > 0) {
      console.log(`Menghapus ${payments.length} payment untuk ${user.full_name}...`)
      const { error: delPay } = await admin.from('payments').delete().eq('profile_id', userId)
      if (delPay) console.error('  Error hapus payments:', delPay)
      else console.log('  ✅ Payments dihapus')
    }

    // Hapus bills untuk user ini (cek profile_id dan user_id)
    const { data: bills1 } = await admin.from('bills').select('id').eq('profile_id', userId)
    const { data: bills2 } = await admin.from('bills').select('id').eq('user_id', userId)
    
    const allBillIds = new Set()
    bills1?.forEach(b => allBillIds.add(b.id))
    bills2?.forEach(b => allBillIds.add(b.id))

    if (allBillIds.size > 0) {
      console.log(`Menghapus ${allBillIds.size} bill untuk ${user.full_name}...`)
      const { error: delBill1 } = await admin.from('bills').delete().eq('profile_id', userId)
      const { error: delBill2 } = await admin.from('bills').delete().eq('user_id', userId)
      if (delBill1) console.error('  Error hapus bills (profile_id):', delBill1)
      if (delBill2) console.error('  Error hapus bills (user_id):', delBill2)
      console.log('  ✅ Bills dihapus')
    }
  }

  // Hapus transactions terkait test
  const { data: txns } = await admin
    .from('transactions')
    .select('id, description')
    .or('description.ilike.%test%,description.ilike.%a50%,description.ilike.%a51%')

  if (txns && txns.length > 0) {
    console.log(`\nMenghapus ${txns.length} transaksi terkait test users...`)
    for (const tx of txns) {
      console.log(`  Hapus: ${tx.description}`)
      await admin.from('transactions').delete().eq('id', tx.id)
    }
    console.log('  ✅ Transaksi dihapus')
  }

  console.log('\n=== RESET SELESAI ===')
  console.log('Silakan buat tagihan baru dari Pengaturan Tagihan di admin panel.')
}

resetTestData().catch(console.error)
