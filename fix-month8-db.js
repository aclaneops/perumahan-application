const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: profile } = await adminClient.from('profiles').select('id').eq('full_name', 'test3').maybeSingle();
  const { data: bills } = await adminClient.from('bills').select('id').eq('period_month', 8).eq('profile_id', profile.id);
  
  if (bills && bills.length > 0) {
    const { error } = await adminClient.from('payments').insert({
      bill_id: bills[0].id,
      amount: 100000,
      validated_by: profile.id, // placeholder
      validated_at: new Date().toISOString()
    });
    if (!error) console.log("Successfully inserted missing Month 8 payment!");
    else console.error("Failed to insert:", error);
  }
}
run();
