import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const url = process.env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1/bills?select=*&or=(profile_id.eq.9815ba0c-e3c1-4241-bdc8-0aa84c0ce59f,user_id.eq.9815ba0c-e3c1-4241-bdc8-0aa84c0ce59f)&status=in.(UNPAID,PARTIAL,PENDING,PENDING_CONFIRMATION)`
fetch(url, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  .then(res => res.json())
  .then(data => console.log('BILLS OR IN:', data.length))

