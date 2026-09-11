import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1`

async function run() {
  const billsRes = await fetch(`${baseUrl}/bills?select=*`, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  const bills = await billsRes.json()
  const myBills = bills.filter(b => b.profile_id === '7e3f6b14-0a9f-44c1-8258-e42fa1afd7dc' || b.user_id === '7e3f6b14-0a9f-44c1-8258-e42fa1afd7dc')
  console.log("ALL BILLS for test4:", myBills)
}
run()
