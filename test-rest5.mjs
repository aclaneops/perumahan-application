import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const billId = '1f8515ee-25d3-4dd6-87b4-5e497db498b5' // From previous logs

const url = process.env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1/bills?id=eq.${billId}&select=profile_id,user_id`
fetch(url, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  .then(res => res.json())
  .then(data => console.log('BILL:', data))

