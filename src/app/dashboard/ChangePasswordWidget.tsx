'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function ChangePasswordWidget() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok!')
      return
    }

    if (newPassword.length < 6) {
      setError('Password minimal 6 karakter.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    })

    setLoading(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mt-6">
      <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
        Ubah Password
      </h4>

      {success ? (
        <div className="p-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-medium flex items-center gap-2">
          ✅ Password berhasil diubah!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Password Baru</label>
            <input 
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder="Minimal 6 karakter"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Konfirmasi Password Baru</label>
            <input 
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder="Ketik ulang password baru"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-800 text-white font-bold text-sm py-2 rounded-lg hover:bg-slate-900 transition disabled:opacity-50"
          >
            {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
          </button>
        </form>
      )}
    </div>
  )
}
