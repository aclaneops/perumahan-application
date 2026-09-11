import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const url = process.env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1/bills?select=id,status,water_fee,trash_fee,security_fee,treasury_fee&limit=10&order=created_at.desc`
fetch(url, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  .then(res => res.json())
  .then(data => console.log('BILLS STATUS:', data))

