-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Enum for User Roles
create type user_role as enum ('super_admin', 'admin', 'user');

-- Enum for Bill Status
create type bill_status as enum ('UNPAID', 'PENDING_CONFIRMATION', 'PAID');

-- Profiles Table (Extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  role user_role default 'user'::user_role not null,
  full_name text not null,
  phone_number text,
  telegram_id text,
  house_number text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Bills Table (Tagihan Warga)
create table public.bills (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  period_month integer not null, -- 1 to 12
  period_year integer not null,  -- e.g., 2026
  water_fee numeric default 0 not null,
  trash_fee numeric default 0 not null,
  security_fee numeric default 0 not null,
  treasury_fee numeric default 0 not null,
  total_amount numeric generated always as (water_fee + trash_fee + security_fee + treasury_fee) stored,
  status bill_status default 'UNPAID'::bill_status not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Payments Table (Konfirmasi Pembayaran)
create table public.payments (
  id uuid default uuid_generate_v4() primary key,
  bill_id uuid references public.bills(id) on delete cascade not null,
  proof_url text not null,
  confirmed_by uuid references public.profiles(id), -- Admin who approved
  paid_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS (Row Level Security) Policies
alter table public.profiles enable row level security;
alter table public.bills enable row level security;
alter table public.payments enable row level security;

-- Profiles: Users can see their own profile, Admins can see all
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Admins can view all profiles" on public.profiles for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'))
);

-- Bills: Users can see own bills, Admins can see all
create policy "Users can view own bills" on public.bills for select using (auth.uid() = user_id);
create policy "Admins can view all bills" on public.bills for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'))
);

-- Payments: Users can insert for their bills, Admins can view/update all
create policy "Users can insert payments" on public.payments for insert with check (
  exists (select 1 from public.bills where id = bill_id and user_id = auth.uid())
);
create policy "Admins can manage payments" on public.payments for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'))
);
