import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const url = process.env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1/bills?id=eq.1f8515ee-25d3-4dd6-87b4-5e497db498b5`
fetch(url, { 
  method: 'PATCH',
  headers: { 
    'apikey': key, 
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({ status: 'PARTIAL' })
})
  .then(res => res.json())
  .then(data => console.log('PATCH DATA:', data))

