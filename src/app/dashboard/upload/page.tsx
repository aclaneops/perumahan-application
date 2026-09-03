'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'

function UploadForm() {
  const [amountPaid, setAmountPaid] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const billId = searchParams.get('billId')
  const totalParam = searchParams.get('total')

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !billId) return

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('billId', billId)
      formData.append('amountPaid', amountPaid)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengupload file')
      }

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
      setUploading(false)
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Upload Bukti Transfer</h1>
      <p className="text-slate-500 mb-6">Silakan masukkan nominal transfer dan upload bukti pembayaran tagihan Anda.</p>
      
      {totalParam && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-6">
          <p className="font-medium text-sm">Total Tagihan: Rp {Number(totalParam).toLocaleString('id-ID')}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-100 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleUpload} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Nominal Transfer (Rp)</label>
          <input 
            type="number" 
            required 
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            placeholder="Contoh: 150000"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
          />
          <p className="text-xs text-slate-500 mt-1">Anda bisa membayar sebagian dari total tagihan.</p>
        </div>
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition cursor-pointer relative">
          <input 
            type="file" 
            accept="image/*,application/pdf"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
          />
          {file ? (
            <div className="text-green-600 font-medium overflow-hidden text-ellipsis whitespace-nowrap">
              ✅ {file.name}
            </div>
          ) : (
            <div>
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              </div>
              <p className="text-slate-600 font-medium">Klik atau seret file ke sini</p>
              <p className="text-slate-400 text-sm mt-1">Mendukung file JPG, PNG, PDF (Maks 5MB)</p>
            </div>
          )}
        </div>

        <div className="flex space-x-3">
          <button 
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition"
          >
            Batal
          </button>
          <button 
            type="submit"
            disabled={!file || uploading}
            className="flex-1 py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Mengupload...' : 'Kirim Bukti'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function UploadPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Suspense fallback={<div className="text-slate-500 font-medium">Memuat form upload...</div>}>
        <UploadForm />
      </Suspense>
    </div>
  )
}
