import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const url = process.env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1/transactions`
fetch(url, { 
    method: 'POST',
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({
        type: 'INCOME',
        category: 'Pembayaran Iuran',
        amount: 60000,
        description: 'Test manual script',
        created_by: 'cba863ba-0a85-4155-9b78-52f13f73c2e4',
        date: '2026-09-11'
    })
})
  .then(async res => console.log('STATUS:', res.status, await res.text()))

