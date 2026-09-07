const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('transactions').insert({
  type: 'INCOME',
  category: 'Test',
  amount: 1,
  date: new Date().toISOString()
}).then(res => console.log(res));
