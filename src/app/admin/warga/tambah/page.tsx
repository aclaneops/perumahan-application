import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function TambahWargaPage() {
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
          <Link href="/admin/pengaturan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Pengaturan Tagihan</Link>
          <Link href="/admin/notifikasi" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Log Notifikasi</Link>
          <Link href="/admin/keuangan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Pembukuan</Link>
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
      <main className="flex-1 p-8">
        <header className="mb-8 flex items-center">
          <Link href="/admin/warga" className="text-slate-500 hover:text-slate-800 mr-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <h1 className="text-3xl font-bold text-slate-800">Tambah Warga Baru</h1>
        </header>

        <div className="max-w-2xl bg-white rounded-xl shadow-sm border border-slate-100 p-8">
          <form action="/api/admin/warga" method="post" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nama Lengkap</label>
                <input type="text" name="full_name" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="Contoh: Budi Santoso" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Blok / Nomor Rumah</label>
                <input type="text" name="house_number" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="Contoh: A1 atau B-05" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Nomor WhatsApp (Aktif)</label>
                <input type="text" name="phone_number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="Contoh: 08123456789" />
                <p className="text-xs text-slate-500 mt-1">Digunakan untuk mengirimkan notifikasi tagihan via WhatsApp.</p>
              </div>
              
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Jabatan</label>
                <select name="role" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">
                  <option value="user">Warga (User)</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div className="col-span-2 mt-4 pt-6 border-t border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Informasi Akun (Login)</h3>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email Warga</label>
                <input type="email" name="email" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="budi@email.com" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Password Sementara</label>
                <input type="text" name="password" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="Minimal 6 karakter" />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Link href="/admin/warga" className="px-6 py-3 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition mr-3">Batal</Link>
              <button type="submit" className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm shadow-blue-500/30">
                Daftarkan Warga
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
