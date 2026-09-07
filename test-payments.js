const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await adminClient.from('payments').select('id, amount, bill_id, created_at').order('created_at', { ascending: false }).limit(5);
  console.log("Payments:", JSON.stringify(data, null, 2));
  
  const { data: bills } = await adminClient.from('bills').select('id, period_month, period_year').in('id', data.map(p => p.bill_id));
  console.log("Bills:", JSON.stringify(bills, null, 2));
}
run();
