'use client'

import { useState } from 'react'

type Transaction = {
  id: string
  type: 'INCOME' | 'EXPENSE'
  category: string
  amount: number
  description: string | null
  date: string
  created_at: string
}

export default function KeuanganClient({ transactions }: { transactions: Transaction[] }) {
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = transactions.filter(t => {
    if (filterType !== 'ALL' && t.type !== filterType) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchCat = t.category.toLowerCase().includes(query)
      const matchDesc = t.description?.toLowerCase().includes(query)
      if (!matchCat && !matchDesc) return false
    }
    return true
  })

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filterType === 'ALL' ? 'bg-slate-800 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
            >
              Semua
            </button>
            <button
              onClick={() => setFilterType('INCOME')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filterType === 'INCOME' ? 'bg-emerald-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
            >
              Pemasukan
            </button>
            <button
              onClick={() => setFilterType('EXPENSE')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filterType === 'EXPENSE' ? 'bg-rose-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
            >
              Pengeluaran
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Cari transaksi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
            />
            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                <th className="p-4 font-medium">Tanggal</th>
                <th className="p-4 font-medium">Jenis</th>
                <th className="p-4 font-medium">Kategori</th>
                <th className="p-4 font-medium">Keterangan</th>
                <th className="p-4 font-medium text-right">Nominal (Rp)</th>
                <th className="p-4 font-medium text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Tidak ada transaksi ditemukan.
                  </td>
                </tr>
              ) : (
                filtered.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 align-top">
                      {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="p-4 align-top">
                      {t.type === 'INCOME' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-700">Pemasukan</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-rose-100 text-rose-700">Pengeluaran</span>
                      )}
                    </td>
                    <td className="p-4 align-top font-medium text-slate-800">
                      {t.category}
                    </td>
                    <td className="p-4 align-top text-slate-600 text-sm">
                      {t.description || '-'}
                    </td>
                    <td className={`p-4 align-top text-right font-bold ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === 'INCOME' ? '+' : '-'} Rp {t.amount.toLocaleString('id-ID')}
                    </td>
                    <td className="p-4 align-top text-center">
                      <form action="/api/admin/transactions" method="post" onSubmit={(e) => {
                        if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) e.preventDefault()
                      }}>
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="id" value={t.id} />
                        <button type="submit" className="text-rose-500 hover:text-rose-700 font-medium text-sm transition">
                          Hapus
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
