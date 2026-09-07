const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: payments } = await supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("Recent Payments:");
  console.log(payments);
  
  if (payments && payments.length > 0) {
    const billId = payments[0].bill_id;
    const { data: bill } = await supabase.from('bills').select('*').eq('id', billId).single();
    console.log("Latest Payment Bill:");
    console.log(bill);
  }
}
run();
