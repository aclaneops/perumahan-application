'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

export default function ImportWargaModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successCount, setSuccessCount] = useState<number | null>(null)
  const router = useRouter()

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)
    setSuccessCount(null)

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        
        // Convert to JSON array of arrays
        const json = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 })
        
        // Skip header row and filter empty rows
        const rows = json.slice(1).filter(row => row.length > 0 && row[0])

        // Map to our expected format
        // Assuming Excel columns: [Blok/No, Nama, No WA]
        const parsedData = rows.map((row: any) => ({
          house_number: String(row[0] || '').trim(),
          full_name: String(row[1] || '').trim(),
          phone_number: String(row[2] || '').trim(),
        })).filter(row => row.house_number && row.full_name)

        if (parsedData.length === 0) {
          throw new Error('Tidak ada data valid yang ditemukan. Pastikan format kolom: [Blok, Nama, No WA]')
        }

        // Send to API
        const res = await fetch('/api/admin/warga/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: parsedData })
        })

        const result = await res.json()

        if (!res.ok) {
          throw new Error(result.error || 'Gagal mengimport data')
        }

        setSuccessCount(result.count)
        router.refresh()
        
        setTimeout(() => {
          setIsOpen(false)
          setSuccessCount(null)
        }, 3000)

      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    reader.onerror = () => {
      setError('Gagal membaca file Excel.')
      setLoading(false)
    }

    reader.readAsBinaryString(file)
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition shadow-sm text-sm"
      >
        Import Excel
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-800 mb-2">Import Data Warga</h2>
              <p className="text-sm text-slate-500 mb-6">
                Upload file Excel (.xlsx/.xls) dengan format kolom berurutan: <br/>
                <strong>1. Blok/No Rumah</strong> | <strong>2. Nama Lengkap</strong> | <strong>3. No WhatsApp</strong> (Opsional)
              </p>

              {error && (
                <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
                  {error}
                </div>
              )}

              {successCount !== null && (
                <div className="mb-4 bg-green-50 text-green-700 text-sm p-3 rounded-lg border border-green-100">
                  Berhasil mengimport {successCount} data warga!
                </div>
              )}

              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50 relative hover:bg-slate-100 transition">
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                />
                <div className="text-slate-400 mb-2">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-700">
                  {loading ? 'Sedang memproses...' : 'Klik atau seret file Excel ke sini'}
                </p>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
