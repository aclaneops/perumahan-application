import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const url = process.env.NEXT_PUBLIC_SUPABASE_URL

async function run() {
  // We need to fetch the admin validate route
  // It's authenticated via Supabase auth, which makes it hard to hit via script
  console.log("Use browser to test")
}
run()
