-- Update Enum Bill Status (add PARTIAL if not exists, though it's complex to alter enums, we'll try)
ALTER TYPE bill_status ADD VALUE IF NOT EXISTS 'PARTIAL';

-- Add amount column to payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount numeric not null default 0;

-- Create Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
  id text primary key,
  value jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage settings" ON public.settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- Insert default billing settings
INSERT INTO public.settings (id, value) 
VALUES (
  'billing_fees', 
  '{"water": 50000, "trash": 30000, "security": 75000, "treasury": 20000}'
) ON CONFLICT (id) DO NOTHING;
