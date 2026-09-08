-- Migration V5: Partial Payments and Exemptions

-- 1. Add covered_items to payments table to track which items a specific payment covers
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS covered_items jsonb;

-- 2. Add notes to bills table to track exemption reasons or admin notes
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS notes text;
