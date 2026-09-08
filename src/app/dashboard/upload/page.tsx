'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'

function UploadForm() {
  const [amountPaid, setAmountPaid] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [ocrMessage, setOcrMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const billId = searchParams.get('billId')
  const totalParam = searchParams.get('total')
  
  // Fee parameters passed from dashboard
  const waterFee = Number(searchParams.get('water')) || 0
  const trashFee = Number(searchParams.get('trash')) || 0
  const secFee = Number(searchParams.get('sec')) || 0
  const treaFee = Number(searchParams.get('trea')) || 0

  const [coveredItems, setCoveredItems] = useState({
    water: false,
    trash: false,
    security: false,
    treasury: false
  })

  // Calculate sum of selected items
  const selectedSum = 
    (coveredItems.water ? waterFee : 0) +
    (coveredItems.trash ? trashFee : 0) +
    (coveredItems.security ? secFee : 0) +
    (coveredItems.treasury ? treaFee : 0)

  const isPartial = Number(amountPaid) > 0 && Number(amountPaid) < Number(totalParam)
  const isSelectedSumValid = selectedSum === Number(amountPaid)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] || null
    setFile(selectedFile)
    
    if (selectedFile) {
      setScanning(true)
      setOcrMessage('Mendeteksi nominal transfer...')
      try {
        const formData = new FormData()
        formData.append('file', selectedFile)
        
        const res = await fetch('/api/ocr', {
          method: 'POST',
          body: formData
        })
        
        if (res.ok) {
          const data = await res.json()
          if (data.nominal && data.nominal > 0) {
            setAmountPaid(data.nominal.toString())
            setOcrMessage(`Nominal terdeteksi otomatis: Rp ${data.nominal.toLocaleString('id-ID')}`)
            setTimeout(() => setOcrMessage(''), 5000)
          } else {
            setOcrMessage('Gagal mendeteksi nominal. Silakan isi manual.')
          }
        } else {
          setOcrMessage('Gagal membaca gambar. Silakan isi manual.')
        }
      } catch (err) {
        console.error(err)
        setOcrMessage('Terjadi kesalahan saat memproses gambar.')
      } finally {
        setScanning(false)
      }
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !billId) return

    if (isPartial && !isSelectedSumValid) {
      setError(`Total item yang dipilih (Rp ${selectedSum.toLocaleString('id-ID')}) tidak sama dengan nominal transfer (Rp ${Number(amountPaid).toLocaleString('id-ID')}). Harap sesuaikan centang item.`)
      return
    }

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('billId', billId)
      formData.append('amountPaid', amountPaid)
      
      if (isPartial) {
        formData.append('coveredItems', JSON.stringify(coveredItems))
      } else {
        // If paid in full (or more), all items are considered covered
        formData.append('coveredItems', JSON.stringify({
          water: true, trash: true, security: true, treasury: true
        }))
      }

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
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-6 flex justify-between items-center">
          <p className="font-medium text-sm">Total Tagihan:</p>
          <p className="font-bold text-lg">Rp {Number(totalParam).toLocaleString('id-ID')}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-100 text-sm">
          {error}
        </div>
      )}

      {ocrMessage && (
        <div className={`p-4 rounded-lg mb-6 border text-sm ${ocrMessage.includes('Gagal') || ocrMessage.includes('kesalahan') ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
          {ocrMessage}
        </div>
      )}

      <form onSubmit={handleUpload} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Nominal Transfer (Rp)</label>
          <input 
            type="number" 
            required 
            value={amountPaid}
            onChange={(e) => {
              setAmountPaid(e.target.value)
              setError('') // Clear error on change
            }}
            placeholder="Contoh: 150000"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
          />
        </div>

        {isPartial && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-sm font-bold text-slate-700 mb-2">Pilih Item yang Dibayar:</h4>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Karena nominal transfer kurang dari total tagihan, silakan centang item mana saja yang dibayar sesuai nominal.
            </p>
            
            <div className="space-y-2 text-sm">
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition">
                <div className="flex items-center space-x-3">
                  <input type="checkbox" checked={coveredItems.security} onChange={(e) => setCoveredItems({...coveredItems, security: e.target.checked})} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                  <span className="font-medium text-slate-700">🔒 Keamanan</span>
                </div>
                <span className="text-slate-600">Rp {secFee.toLocaleString('id-ID')}</span>
              </label>
              
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition">
                <div className="flex items-center space-x-3">
                  <input type="checkbox" checked={coveredItems.trash} onChange={(e) => setCoveredItems({...coveredItems, trash: e.target.checked})} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                  <span className="font-medium text-slate-700">🗑️ Kebersihan</span>
                </div>
                <span className="text-slate-600">Rp {trashFee.toLocaleString('id-ID')}</span>
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition">
                <div className="flex items-center space-x-3">
                  <input type="checkbox" checked={coveredItems.water} onChange={(e) => setCoveredItems({...coveredItems, water: e.target.checked})} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                  <span className="font-medium text-slate-700">💧 Air</span>
                </div>
                <span className="text-slate-600">Rp {waterFee.toLocaleString('id-ID')}</span>
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition">
                <div className="flex items-center space-x-3">
                  <input type="checkbox" checked={coveredItems.treasury} onChange={(e) => setCoveredItems({...coveredItems, treasury: e.target.checked})} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                  <span className="font-medium text-slate-700">🏦 Kas</span>
                </div>
                <span className="text-slate-600">Rp {treaFee.toLocaleString('id-ID')}</span>
              </label>
            </div>
            
            <div className={`mt-4 pt-3 border-t flex justify-between items-center text-sm font-bold ${isSelectedSumValid ? 'text-emerald-600' : 'text-rose-600'}`}>
              <span>Total Dipilih:</span>
              <span>Rp {selectedSum.toLocaleString('id-ID')}</span>
            </div>
          </div>
        )}

        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition cursor-pointer relative">
          <input 
            type="file" 
            accept="image/*,application/pdf"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            onChange={handleFileChange}
            disabled={scanning}
            required
          />
          {scanning ? (
            <div className="text-blue-600 font-medium">
              ⏳ Memproses gambar...
            </div>
          ) : file ? (
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
            disabled={!file || uploading || (isPartial && !isSelectedSumValid)}
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
