import { createClient } from '@supabase/supabase-js'

global.fetch = async (url, options) => {
  console.log("FETCH URL:", url)
  return {
    ok: true,
    json: async () => ([])
  }
}

const supabase = createClient('https://example.com', 'key')

async function run() {
  await supabase
    .from('bills')
    .select('id, period_month, period_year, total_amount, water_fee, trash_fee, security_fee, treasury_fee')
    .or(`profile_id.eq.123,user_id.eq.123`)
    .in('status', ['UNPAID', 'PARTIAL', 'PENDING', 'PENDING_CONFIRMATION'])
}
run()
