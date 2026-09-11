import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1`

async function run() {
  const profRes = await fetch(`${baseUrl}/profiles?select=id,full_name,house_number&house_number=eq.Blok a51`, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  const profiles = await profRes.json()
  
  if (profiles.length > 0) {
    const profileId = profiles[0].id
    const billsRes = await fetch(`${baseUrl}/bills?select=*&profile_id=eq.${profileId}`, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
    console.log("BILLS for a51:", await billsRes.json())
  }
}
run()
