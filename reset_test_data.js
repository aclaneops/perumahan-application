// Simple fetch-based reset script - no Supabase SDK needed
const SUPABASE_URL = 'https://kdseosursjzyiyqrzojg.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
}

async function query(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers })
  return res.json()
}

async function del(table, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { 
    method: 'DELETE', 
    headers: { ...headers, 'Prefer': 'return=representation' }
  })
  return res.json()
}

async function main() {
  console.log('=== RESET DATA TES ===\n')

  // 1. Get all profiles
  const profiles = await query('profiles', 'select=id,full_name,house_number')
  console.log('Semua profil:')
  profiles.forEach(p => console.log(`  - ${p.full_name} (${p.house_number}) -> ${p.id}`))

  // 2. Find test users
  const testUsers = profiles.filter(p => 
    p.house_number === 'a50' || p.house_number === 'a51' ||
    (p.full_name && p.full_name.toLowerCase().includes('test'))
  )
  
  console.log('\nUser test:')
  testUsers.forEach(p => console.log(`  - ${p.full_name} (${p.house_number})`))

  for (const user of testUsers) {
    console.log(`\n--- Reset ${user.full_name} (${user.house_number}) ---`)

    // Get all bills for this user
    const bills1 = await query('bills', `select=id&profile_id=eq.${user.id}`)
    const bills2 = await query('bills', `select=id&user_id=eq.${user.id}`)
    const allBillIds = [...new Set([...bills1.map(b=>b.id), ...bills2.map(b=>b.id)])]
    
    console.log(`  Bills ditemukan: ${allBillIds.length}`)

    // Delete payments for each bill first
    for (const bid of allBillIds) {
      const deleted = await del('payments', `bill_id=eq.${bid}`)
      if (deleted.length > 0) console.log(`  Hapus ${deleted.length} payment untuk bill ${bid.substring(0,8)}`)
    }

    // Also delete payments by profile_id 
    const delPay = await del('payments', `profile_id=eq.${user.id}`)
    if (delPay.length > 0) console.log(`  Hapus ${delPay.length} payment by profile_id`)

    // Delete bills
    const delBill1 = await del('bills', `profile_id=eq.${user.id}`)
    const delBill2 = await del('bills', `user_id=eq.${user.id}`)
    console.log(`  Hapus ${delBill1.length + delBill2.length} bills`)

    console.log(`  ✅ Selesai untuk ${user.full_name}`)
  }

  // 3. Delete test-related transactions
  const txns = await query('transactions', 'select=id,description&description=ilike.*test*')
  const txns2 = await query('transactions', 'select=id,description&description=ilike.*a50*')
  const txns3 = await query('transactions', 'select=id,description&description=ilike.*a51*')
  
  const allTxIds = new Set()
  const allTxns = []
  for (const tx of [...txns, ...txns2, ...txns3]) {
    if (!allTxIds.has(tx.id)) {
      allTxIds.add(tx.id)
      allTxns.push(tx)
    }
  }

  if (allTxns.length > 0) {
    console.log(`\nMenghapus ${allTxns.length} transaksi terkait test:`)
    for (const tx of allTxns) {
      console.log(`  - ${tx.description}`)
      await del('transactions', `id=eq.${tx.id}`)
    }
    console.log('  ✅ Transaksi dihapus')
  }

  console.log('\n=== RESET SELESAI ===')
  console.log('\nLangkah selanjutnya:')
  console.log('1. Buka halaman admin -> Pengaturan Tagihan')
  console.log('2. Generate tagihan bulan September 2026 untuk user test')
  console.log('3. Generate tagihan bulan Agustus 2026 untuk user test (sebagai tunggakan)')
  console.log('4. Login sebagai warga, upload bukti bayar')
  console.log('5. Login sebagai admin, verifikasi manual (✅ Terima)')
}

main().catch(console.error)
