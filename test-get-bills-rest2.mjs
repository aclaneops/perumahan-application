import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1`

async function run() {
  const profRes = await fetch(`${baseUrl}/profiles?select=id,full_name,house_number`, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  const profiles = await profRes.json()
  console.log("PROFILES:", profiles)
}
run()
