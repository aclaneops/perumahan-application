import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/bills?select=id,profile_id,user_id,status,total_amount&limit=5&order=created_at.desc'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

fetch(url, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  .then(res => res.json())
  .then(data => console.log('BILLS:', data))

const payUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/payments?select=id,amount,bill_id&limit=5&order=created_at.desc'
fetch(payUrl, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  .then(res => res.json())
  .then(data => console.log('PAYMENTS:', data))

const txUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/transactions?select=category,amount,description&limit=5&order=created_at.desc'
fetch(txUrl, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  .then(res => res.json())
  .then(data => console.log('TX:', data))

