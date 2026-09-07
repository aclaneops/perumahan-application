-- Migration V4: Tutup Buku Tahunan (Yearly Closing)

-- Tabel untuk menyimpan riwayat tutup buku per tahun
CREATE TABLE IF NOT EXISTS public.yearly_closings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  year integer NOT NULL UNIQUE,              -- Tahun yang ditutup (e.g., 2026)
  total_income numeric NOT NULL DEFAULT 0,   -- Total pemasukan (iuran + transaksi INCOME)
  total_expense numeric NOT NULL DEFAULT 0,  -- Total pengeluaran (transaksi EXPENSE)
  carry_forward numeric NOT NULL DEFAULT 0,  -- Saldo yang dibawa ke tahun berikutnya
  previous_carry_forward numeric NOT NULL DEFAULT 0, -- Saldo awal dari tutup buku tahun sebelumnya
  bills_deleted integer DEFAULT 0,           -- Jumlah tagihan PAID yang dihapus
  payments_deleted integer DEFAULT 0,        -- Jumlah pembayaran yang dihapus
  transactions_deleted integer DEFAULT 0,    -- Jumlah transaksi yang dihapus
  outstanding_bills integer DEFAULT 0,       -- Jumlah tunggakan yang masih tersisa (tidak dihapus)
  outstanding_amount numeric DEFAULT 0,      -- Total nominal tunggakan yang masih tersisa
  closed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  notes text
);

-- RLS
ALTER TABLE public.yearly_closings ENABLE ROW LEVEL SECURITY;

-- Hanya admin yang bisa melihat dan mengelola
CREATE POLICY "Admins can manage yearly_closings" ON public.yearly_closings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
