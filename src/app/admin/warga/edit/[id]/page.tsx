import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function EditWargaPage({ params }: { params: { id: string } }) {
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

  const { data: warga } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!warga) {
    redirect('/admin/warga')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
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
          <Link href="/admin/warga" className="block px-4 py-3 rounded-lg bg-blue-600 text-white font-medium">Kelola Warga</Link>
          <Link href="/admin/pengaturan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Pengaturan Tagihan</Link>
          <Link href="/admin/notifikasi" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Kirim Notifikasi</Link>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <header className="mb-8 flex items-center gap-4">
          <Link href="/admin/warga" className="text-slate-500 hover:text-slate-800 transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <h1 className="text-3xl font-bold text-slate-800">Edit Data Warga</h1>
        </header>

        <div className="max-w-2xl bg-white rounded-xl shadow-sm border border-slate-100 p-8">
          <form action="/api/admin/warga/edit" method="post" className="space-y-6">
            <input type="hidden" name="user_id" value={warga.id} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nama Lengkap</label>
                <input type="text" name="full_name" defaultValue={warga.full_name} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Blok / Nomor Rumah</label>
                <input type="text" name="house_number" defaultValue={warga.house_number} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Nomor WhatsApp</label>
                <input type="text" name="phone_number" defaultValue={warga.phone_number || ''} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Jabatan</label>
                <select name="role" defaultValue={warga.role} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <option value="user">Warga (User)</option>
                  <option value="admin">Pengurus (Admin)</option>
                </select>
              </div>
            </div>
            <div className="pt-4">
              <button type="submit" className="w-full bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition">
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
