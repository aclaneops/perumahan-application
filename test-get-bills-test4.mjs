import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1`

async function run() {
  const transRes = await fetch(`${baseUrl}/transactions?select=amount,description&order=created_at.desc&limit=5`, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  console.log("TRANSACTIONS:", await transRes.json())
}
run()
