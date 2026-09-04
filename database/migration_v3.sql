-- Migration V3: Add Transactions (Pemasukan & Pengeluaran)

-- Enum for Transaction Types
create type transaction_type as enum ('INCOME', 'EXPENSE');

-- Transactions Table
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  type transaction_type not null,
  category text not null,
  amount numeric not null check (amount > 0),
  description text,
  date date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS (Row Level Security) Policies
alter table public.transactions enable row level security;

-- Only Admins can manage transactions
create policy "Admins can manage transactions" on public.transactions for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'))
);
