-- Migration V2: System Upgrade for Dues & Telegram Notifications

-- 1. Extend profiles table for Telegram & Auth mapping
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_chat_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_username text;

CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id ON public.profiles(telegram_chat_id);

-- 2. Add Unique constraint on bills to prevent duplicate bills per month
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS due_date date DEFAULT (CURRENT_DATE + INTERVAL '10 days');

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_bill_per_profile_period'
    ) THEN
        ALTER TABLE public.bills 
        ADD CONSTRAINT unique_bill_per_profile_period UNIQUE (profile_id, period_month, period_year);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bills_profile_id ON public.bills(profile_id);
CREATE INDEX IF NOT EXISTS idx_bills_period ON public.bills(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(status);

-- 3. Create telegram_pairings table for secure pairing
CREATE TABLE IF NOT EXISTS public.telegram_pairings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  code text UNIQUE NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telegram_pairings_code ON public.telegram_pairings(code);
CREATE INDEX IF NOT EXISTS idx_telegram_pairings_profile_id ON public.telegram_pairings(profile_id);

ALTER TABLE public.telegram_pairings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own telegram pairings" ON public.telegram_pairings
  FOR ALL USING (auth.uid() = profile_id);

CREATE POLICY "Admins can manage all telegram pairings" ON public.telegram_pairings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- 4. Create notification_logs table for anti-spam & auditing
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  notification_type text NOT NULL, -- H_MINUS_5, DUE_DATE, OVERDUE_1M, OVERDUE_2M, OVERDUE_HEAVY, PAYMENT_CONFIRMED, MANUAL_REMINDER, ADMIN_REPORT
  period_month integer NOT NULL,
  period_year integer NOT NULL,
  telegram_chat_id text,
  status text NOT NULL, -- SENT, FAILED, SKIPPED
  error_message text,
  sent_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_profile ON public.notification_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_period ON public.notification_logs(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON public.notification_logs(notification_type);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification logs" ON public.notification_logs
  FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Admins can view all notification logs" ON public.notification_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
