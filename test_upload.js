const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('bills').update({ status: 'PENDING_CONFIRMATION' }).eq('id', '6f7b289d-bb45-4237-b68e-be3953111d7f').select();
  console.log("Updated:", data);
  console.log("Error:", error);
}
run();
