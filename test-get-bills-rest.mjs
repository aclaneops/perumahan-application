import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1`

async function run() {
  const profRes = await fetch(`${baseUrl}/profiles?select=id&house_number=eq.a50`, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  const profiles = await profRes.json()
  
  if (profiles.length > 0) {
    const profileId = profiles[0].id
    const billsRes = await fetch(`${baseUrl}/bills?select=*&profile_id=eq.${profileId}`, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
    console.log("BILLS for a50:", await billsRes.json())
    
    const payRes = await fetch(`${baseUrl}/payments?select=*&profile_id=eq.${profileId}`, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
    console.log("PAYMENTS for a50:", await payRes.json())
  }
}
run()
