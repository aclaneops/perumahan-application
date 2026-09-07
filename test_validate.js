const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: bills } = await supabase.from('bills').select('*').order('created_at', { ascending: false }).limit(10);
  console.log("Recent Bills:", JSON.stringify(bills, null, 2));
  
  const { data: payments } = await supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("Recent Payments:", JSON.stringify(payments, null, 2));

  const { data: transactions } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("Recent Transactions:", JSON.stringify(transactions, null, 2));
}
run();
