import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DeleteWargaButton from './DeleteWargaButton'

export const dynamic = 'force-dynamic'

export default async function ManageWargaPage() {
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
    .order('house_number', { ascending: true })

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
          <Link href="/admin/warga" className="block px-4 py-3 rounded-lg bg-blue-600 text-white font-medium">Kelola Warga</Link>
          <Link href="/admin/pengaturan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Pengaturan Tagihan</Link>
          <Link href="/admin/notifikasi" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Log Notifikasi</Link>
          <Link href="/admin/keuangan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Pembukuan</Link>
          <Link href="/admin/laporan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Laporan Bulanan</Link>
        </nav>
        <div className="p-4 border-t border-slate-700">
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="w-full text-left px-4 py-2 text-slate-300 hover:text-white transition">Log Out</button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Daftar Warga</h1>
            <p className="text-slate-500 text-sm mt-1">Kelola data warga perumahan & status tautan Telegram</p>
          </div>
          <Link href="/admin/warga/tambah" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm text-sm">
            + Tambah Warga
          </Link>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3.5 px-6 font-semibold">Blok / No</th>
                  <th className="py-3.5 px-6 font-semibold">Nama Lengkap</th>
                  <th className="py-3.5 px-6 font-semibold">No. WhatsApp</th>
                  <th className="py-3.5 px-6 font-semibold">Status Telegram</th>
                  <th className="py-3.5 px-6 font-semibold">Role</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {warga?.map((w, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-4 px-6 font-bold text-slate-800">Blok {w.house_number}</td>
                    <td className="py-4 px-6 font-medium text-slate-800">
                      <Link href={`/admin/warga/${w.id}`} className="hover:text-blue-600 hover:underline">
                        {w.full_name}
                      </Link>
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-600">{w.phone_number || '-'}</td>
                    <td className="py-4 px-6">
                      {w.telegram_chat_id ? (
                        <span className="inline-flex items-center text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          🟢 Terhubung
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                          ⚪ Belum
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${w.role === 'admin' || w.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                        {w.role}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-3">
                      <Link href={`/admin/warga/${w.id}`} className="text-blue-600 hover:underline font-semibold text-xs">
                        Detail
                      </Link>
                      <Link href={`/admin/warga/edit/${w.id}`} className="text-slate-600 hover:underline font-medium text-xs">
                        Edit
                      </Link>
                      <DeleteWargaButton id={w.id} name={w.full_name} />
                    </td>
                  </tr>
                ))}
                {!warga || warga.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">Belum ada warga terdaftar.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
