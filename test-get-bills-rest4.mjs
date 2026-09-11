import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1`

async function run() {
  const billsRes = await fetch(`${baseUrl}/bills?select=*`, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  const bills = await billsRes.json()
  const myBills = bills.filter(b => b.profile_id === '9815ba0c-e3c1-4241-bdc8-0aa84c0ce59f')
  console.log("ALL BILLS for a50:", myBills)
}
run()
