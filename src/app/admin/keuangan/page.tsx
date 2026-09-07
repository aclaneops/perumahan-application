import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import KeuanganClient from './KeuanganClient'

export const dynamic = 'force-dynamic'

export default async function KeuanganPage({ searchParams }: { searchParams: { success?: string, error?: string } }) {
  const supabase = createClient()
  const adminClient = createAdminClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  // Fetch transactions
  const { data: transactions } = await adminClient
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  // Kalkulasi summary bulan ini
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  let totalIncomeThisMonth = 0
  let totalExpenseThisMonth = 0
  let totalIuranThisMonth = 0

  transactions?.forEach(t => {
    const tDate = new Date(t.date)
    if (tDate.getMonth() + 1 === currentMonth && tDate.getFullYear() === currentYear) {
      if (t.type === 'INCOME') totalIncomeThisMonth += Number(t.amount)
      if (t.type === 'EXPENSE') totalExpenseThisMonth += Number(t.amount)
    }
  })

  // Fetch Iuran
  const { data: allPayments } = await adminClient
    .from('payments')
    .select('*, bills(*)')
    .not('validated_by', 'is', null)

  allPayments?.forEach(payment => {
    const pDate = new Date(payment.paid_at || payment.created_at)
    if (pDate.getMonth() + 1 === currentMonth && pDate.getFullYear() === currentYear) {
      totalIuranThisMonth += Number(payment.amount || payment.bills?.total_amount || 0)
    }
  })

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col flex-shrink-0">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-blue-400">Panel Admin</h2>
          <p className="text-sm text-slate-400 mt-1">Sistem Perumahan</p>
        </div>
        <div className="px-6 mb-6">
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Login sebagai:</p>
            <p className="font-semibold">{profile?.full_name}</p>
            <span className="inline-block mt-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md uppercase tracking-wider font-bold">
              {profile?.role}
            </span>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <Link href="/admin/dashboard" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Dasbor Utama</Link>
          <Link href="/admin/tunggakan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Kelola Tunggakan</Link>
          <Link href="/admin/warga" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Kelola Warga</Link>
          <Link href="/admin/pengaturan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Pengaturan Tagihan</Link>
          <Link href="/admin/notifikasi" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Log Notifikasi</Link>
          <Link href="/admin/keuangan" className="block px-4 py-3 rounded-lg bg-blue-600 text-white font-medium">Pembukuan</Link>
          <Link href="/admin/laporan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Laporan Bulanan</Link>
          <Link href="/admin/rekap-tahunan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Rekap Tahunan</Link>
          <Link href="/admin/tutup-buku" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Tutup Buku</Link>
        </nav>
        <div className="p-4 border-t border-slate-700">
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="w-full text-left px-4 py-2 text-slate-300 hover:text-white transition">Log Out</button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Pembukuan</h1>
          <p className="text-slate-500 mt-1">Kelola pencatatan pengeluaran operasional dan pemasukan lain-lain.</p>
        </header>

        {searchParams.success && (
          <div className="mb-6 bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-200">
            ✅ Transaksi berhasil disimpan/dihapus.
          </div>
        )}
        {searchParams.error && (
          <div className="mb-6 bg-rose-50 text-rose-700 p-4 rounded-xl border border-rose-200">
            ❌ {searchParams.error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-slate-500 font-medium mb-1">Total Pemasukan Iuran (Bulan Ini)</h3>
            <p className="text-3xl font-bold text-blue-600">Rp {totalIuranThisMonth.toLocaleString('id-ID')}</p>
            <p className="text-sm text-slate-400 mt-2">Otomatis dari tagihan warga.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-slate-500 font-medium mb-1">Total Pemasukan Lainnya (Bulan Ini)</h3>
            <p className="text-3xl font-bold text-emerald-600">Rp {totalIncomeThisMonth.toLocaleString('id-ID')}</p>
            <p className="text-sm text-slate-400 mt-2">Kas tambahan manual.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-slate-500 font-medium mb-1">Total Pengeluaran (Bulan Ini)</h3>
            <p className="text-3xl font-bold text-rose-600">Rp {totalExpenseThisMonth.toLocaleString('id-ID')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-8">
              <h2 className="text-xl font-bold text-slate-800 mb-6">Tambah Transaksi Baru</h2>
              
              <form action="/api/admin/transactions" method="post" className="space-y-4">
                <input type="hidden" name="action" value="create" />
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Transaksi</label>
                  <select name="type" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="EXPENSE">Pengeluaran (Uang Keluar)</option>
                    <option value="INCOME">Pemasukan Lain (Uang Masuk)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal</label>
                  <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
                  <select name="category" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="Biaya Keamanan / Security">Biaya Keamanan / Security</option>
                    <option value="Gaji Petugas Kebersihan">Gaji Petugas Kebersihan</option>
                    <option value="Pemeliharaan Air PAM">Pemeliharaan Air PAM</option>
                    <option value="Listrik Fasilitas Umum">Listrik Fasilitas Umum</option>
                    <option value="Perbaikan Infrastruktur">Perbaikan Infrastruktur</option>
                    <option value="Konsumsi Rapat/Kegiatan">Konsumsi Rapat/Kegiatan</option>
                    <option value="Sumbangan Warga">Sumbangan Warga (Masuk)</option>
                    <option value="Dana Bantuan">Dana Bantuan (Masuk)</option>
                    <option value="Lain-lain">Lain-lain</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nominal (Rp)</label>
                  <input type="number" name="amount" min="1" required placeholder="Contoh: 500000" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan (Opsional)</label>
                  <textarea name="description" rows={3} placeholder="Detail transaksi..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                </div>

                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-sm">
                  Simpan Transaksi
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <KeuanganClient transactions={transactions || []} />
          </div>
        </div>
      </main>
    </div>
  )
}
