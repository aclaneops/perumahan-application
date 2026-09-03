import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PengaturanPage({
  searchParams
}: {
  searchParams: { success?: string; error?: string }
}) {
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

  // Fetch settings
  const { data: settings } = await adminClient
    .from('settings')
    .select('value')
    .eq('id', 'billing_fees')
    .maybeSingle()

  const fees = settings?.value || { water: 0, trash: 0, security: 0, treasury: 0 }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
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
          <Link href="/admin/warga" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Kelola Warga</Link>
          <Link href="/admin/pengaturan" className="block px-4 py-3 rounded-lg bg-blue-600 text-white font-medium">Pengaturan Tagihan</Link>
          <Link href="/admin/notifikasi" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Kirim Notifikasi</Link>
        </nav>
        <div className="p-4 border-t border-slate-700">
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="w-full text-left px-4 py-2 text-slate-300 hover:text-white transition">Log Out</button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Pengaturan Tagihan</h1>
          <p className="text-slate-500 mt-2">Atur nominal tagihan default untuk bulan ini.</p>
        </header>

        {searchParams?.success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            Perubahan berhasil disimpan.
          </div>
        )}
        {searchParams?.error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            Gagal menyimpan: {decodeURIComponent(searchParams.error)}. Kemungkinan tabel <code>settings</code> belum dibuat di database — jalankan <code>database/update_schema.sql</code> di Supabase SQL Editor kamu.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Edit Biaya */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8">
            <h2 className="text-xl font-semibold text-slate-800 mb-6">Nominal Biaya Bulanan</h2>
            <form action="/api/admin/settings" method="post" className="space-y-6">
              <input type="hidden" name="action" value="update_fees" />
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Biaya Keamanan (Rp)</label>
                <input type="number" name="security" defaultValue={fees.security} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Biaya Kebersihan / Sampah (Rp)</label>
                <input type="number" name="trash" defaultValue={fees.trash} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Biaya Air Bersih (Rp)</label>
                <input type="number" name="water" defaultValue={fees.water} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Uang Kas RT (Rp)</label>
                <input type="number" name="treasury" defaultValue={fees.treasury} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm shadow-blue-500/30">
                  Simpan Pengaturan
                </button>
              </div>
            </form>
          </div>

          {/* Form Buat Tagihan */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 h-fit">
            <h2 className="text-xl font-semibold text-slate-800 mb-6">Buat Tagihan Masal</h2>
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-6">
              <p className="font-medium text-sm">Tombol di bawah ini akan membuat tagihan baru untuk <strong>semua warga terdaftar</strong> pada bulan berjalan, menggunakan nominal biaya yang tersimpan di pengaturan.</p>
            </div>
            
            <form action="/api/admin/settings" method="post" className="space-y-6">
              <input type="hidden" name="action" value="generate_bills" />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Bulan</label>
                  <select name="month" defaultValue={new Date().getMonth() + 1} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('id-ID', { month: 'long' })}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tahun</label>
                  <input type="number" name="year" defaultValue={new Date().getFullYear()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg" />
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full bg-green-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-green-700 transition shadow-sm shadow-green-500/30">
                  Buat & Kirim Tagihan Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
