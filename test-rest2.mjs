import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/bills?profile_id=eq.7e3f6b14-0a9f-44c1-8258-e42fa1afd7dc&select=id,status,total_amount,period_month,period_year"
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

fetch(url, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  .then(res => res.json())
  .then(data => console.log('PRATIWI BILLS:', data))

