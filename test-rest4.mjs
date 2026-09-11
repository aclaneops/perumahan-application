import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const key = process.env.SUPABASE_SERVICE_ROLE_KEY

const payUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/payments?select=id,amount,bill_id,created_at&limit=20&order=created_at.desc'
fetch(payUrl, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  .then(res => res.json())
  .then(data => console.log('PAYMENTS:', data))

