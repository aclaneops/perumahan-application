'use client'

import { useState } from 'react'

type ClosingRecord = {
  id: string
  year: number
  total_income: number
  total_expense: number
  carry_forward: number
  previous_carry_forward: number
  bills_deleted: number
  payments_deleted: number
  transactions_deleted: number
  outstanding_bills: number
  outstanding_amount: number
  closed_at: string
  notes: string
}

type PreviewData = {
  year: number
  previousCarryForward: number
  totalIuran: number
  totalIncomeTransactions: number
  totalExpense: number
  totalIncome: number
  carryForward: number
  paidBillCount: number
  paymentCount: number
  transactionCount: number
  outstandingCount: number
  outstandingAmount: number
  notifLogCount: number
  totalDataToDelete: number
}

export default function TutupBukuClient({ closingHistory }: { closingHistory: ClosingRecord[] }) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear - 1)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const closedYears = new Set(closingHistory.map(c => c.year))

  // Generate available years (last 5 years)
  const availableYears: number[] = []
  for (let y = currentYear - 1; y >= currentYear - 5; y--) {
    if (!closedYears.has(y)) {
      availableYears.push(y)
    }
  }

  const handlePreview = async () => {
    setLoading(true)
    setError('')
    setPreview(null)
    setSuccess('')

    try {
      const res = await fetch(`/api/admin/yearly-closing?year=${selectedYear}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Gagal memuat preview')
        return
      }
      setPreview(data)
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const handleExecute = async () => {
    const expected = `TUTUP BUKU ${selectedYear}`
    if (confirmText !== expected) {
      setError(`Ketik tepat: "${expected}" untuk konfirmasi`)
      return
    }

    setExecuting(true)
    setError('')

    try {
      const res = await fetch('/api/admin/yearly-closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear, confirmText })
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Gagal menjalankan tutup buku')
        return
      }

      setSuccess(`✅ ${data.message}`)
      setPreview(null)
      setConfirmText('')
      // Reload page to show updated history
      setTimeout(() => window.location.reload(), 2000)
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan')
    } finally {
      setExecuting(false)
    }
  }

  const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

  return (
    <div className="space-y-8">
      {/* Tutup Buku Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-indigo-950">
          <h2 className="text-xl font-bold text-white">📕 Tutup Buku Tahunan</h2>
          <p className="text-slate-300 text-sm mt-1">
            Hapus data transaksi tahun lalu dan bawa saldo bersih ke tahun berikutnya. Tunggakan tetap dipertahankan.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Year Selection */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Pilih Tahun</label>
              {availableYears.length > 0 ? (
                <select
                  value={selectedYear}
                  onChange={(e) => { setSelectedYear(Number(e.target.value)); setPreview(null); setError(''); setSuccess('') }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              ) : (
                <p className="text-slate-500 text-sm py-3">Tidak ada tahun yang bisa ditutup. Semua sudah di-closing.</p>
              )}
            </div>
            <button
              onClick={handlePreview}
              disabled={loading || availableYears.length === 0}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition shadow-md text-sm"
            >
              {loading ? '⏳ Memuat...' : '🔍 Lihat Ringkasan'}
            </button>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium">
              ❌ {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm font-medium">
              {success}
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <h3 className="text-lg font-bold text-blue-900 mb-4">📊 Ringkasan Tahun {preview.year}</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {preview.previousCarryForward > 0 && (
                    <div className="bg-white p-4 rounded-lg border border-blue-100">
                      <p className="text-xs text-slate-500 font-semibold uppercase">Saldo Awal (dari {preview.year - 1})</p>
                      <p className="text-xl font-bold text-blue-600 mt-1">{fmt(preview.previousCarryForward)}</p>
                    </div>
                  )}
                  <div className="bg-white p-4 rounded-lg border border-blue-100">
                    <p className="text-xs text-slate-500 font-semibold uppercase">Total Pemasukan</p>
                    <p className="text-xl font-bold text-emerald-600 mt-1">{fmt(preview.totalIncome)}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Iuran: {fmt(preview.totalIuran)} | Lainnya: {fmt(preview.totalIncomeTransactions)}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-blue-100">
                    <p className="text-xs text-slate-500 font-semibold uppercase">Total Pengeluaran</p>
                    <p className="text-xl font-bold text-rose-600 mt-1">{fmt(preview.totalExpense)}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-blue-100">
                    <p className="text-xs text-slate-500 font-semibold uppercase">Saldo Dibawa ke {preview.year + 1}</p>
                    <p className={`text-xl font-bold mt-1 ${preview.carryForward >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
                      {fmt(preview.carryForward)}
                    </p>
                  </div>
                </div>

                {/* Data yang akan dihapus */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="text-sm font-bold text-amber-800 mb-2">⚠️ Data yang akan DIHAPUS:</h4>
                  <ul className="text-sm text-amber-700 space-y-1">
                    <li>• {preview.paidBillCount} tagihan lunas</li>
                    <li>• {preview.paymentCount} bukti pembayaran (termasuk foto di storage)</li>
                    <li>• {preview.transactionCount} transaksi keuangan</li>
                    <li>• {preview.notifLogCount} log notifikasi</li>
                    <li className="font-bold pt-2 border-t border-amber-200">Total: {preview.totalDataToDelete} records dihapus</li>
                  </ul>
                </div>

                {/* Tunggakan yang dipertahankan */}
                {preview.outstandingCount > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mt-4">
                    <h4 className="text-sm font-bold text-rose-800 mb-1">🔒 Tunggakan yang TETAP ADA:</h4>
                    <p className="text-sm text-rose-700">
                      {preview.outstandingCount} tagihan belum lunas senilai <strong>{fmt(preview.outstandingAmount)}</strong> — akan tetap ada sampai dilunasi.
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Section */}
              <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-6">
                <h4 className="text-lg font-bold text-rose-800 mb-2">⚠️ PERHATIAN: Proses ini TIDAK BISA DIBATALKAN</h4>
                <p className="text-sm text-rose-700 mb-4">
                  Setelah tutup buku dijalankan, semua data yang terhapus tidak bisa dikembalikan.
                  Pastikan Anda sudah mencetak/mengunduh laporan tahunan sebelum melanjutkan.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-rose-700 mb-1">
                      Ketik "<span className="font-mono">TUTUP BUKU {selectedYear}</span>" untuk konfirmasi:
                    </label>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder={`TUTUP BUKU ${selectedYear}`}
                      className="w-full px-4 py-3 border-2 border-rose-300 rounded-lg font-mono text-lg bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    />
                  </div>
                  <button
                    onClick={handleExecute}
                    disabled={executing || confirmText !== `TUTUP BUKU ${selectedYear}`}
                    className="px-6 py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition shadow-md self-end text-sm whitespace-nowrap"
                  >
                    {executing ? '⏳ Memproses...' : '🔒 Jalankan Tutup Buku'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Riwayat Tutup Buku */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">📋 Riwayat Tutup Buku</h2>
          <p className="text-slate-500 text-sm mt-1">Daftar tutup buku yang sudah pernah dilakukan.</p>
        </div>

        {closingHistory.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-4xl mb-3">📭</p>
            <p>Belum pernah ada tutup buku.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">Tahun</th>
                  <th className="p-4 font-semibold">Total Pemasukan</th>
                  <th className="p-4 font-semibold">Total Pengeluaran</th>
                  <th className="p-4 font-semibold">Saldo Dibawa</th>
                  <th className="p-4 font-semibold">Data Dihapus</th>
                  <th className="p-4 font-semibold">Tunggakan Sisa</th>
                  <th className="p-4 font-semibold">Tanggal Closing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {closingHistory.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-bold text-slate-800 text-lg">{c.year}</td>
                    <td className="p-4 text-emerald-600 font-medium">{fmt(c.total_income)}</td>
                    <td className="p-4 text-rose-600 font-medium">{fmt(c.total_expense)}</td>
                    <td className={`p-4 font-bold ${c.carry_forward >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
                      {fmt(c.carry_forward)}
                    </td>
                    <td className="p-4 text-slate-600 text-sm">
                      {c.bills_deleted + c.payments_deleted + c.transactions_deleted} records
                    </td>
                    <td className="p-4">
                      {c.outstanding_bills > 0 ? (
                        <span className="text-amber-700 font-medium text-sm">
                          {c.outstanding_bills} tagihan ({fmt(c.outstanding_amount)})
                        </span>
                      ) : (
                        <span className="text-emerald-600 text-sm">Tidak ada</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500 text-sm">
                      {new Date(c.closed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
