import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1`

async function run() {
  const profileId = '9815ba0c-e3c1-4241-bdc8-0aa84c0ce59f'
  const billsRes = await fetch(`${baseUrl}/bills?select=*&profile_id=eq.${profileId}`, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  console.log("BILLS for a50:", await billsRes.json())
}
run()
