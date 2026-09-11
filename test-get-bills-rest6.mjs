import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1`

async function run() {
  const billsRes = await fetch(`${baseUrl}/bills?select=id,profile_id,user_id,status,water_fee,trash_fee,security_fee,treasury_fee,total_amount`, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  console.log("ALL BILLS:", await billsRes.json())
}
run()
