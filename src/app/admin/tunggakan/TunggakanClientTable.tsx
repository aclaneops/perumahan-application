'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getLevelMetadata } from '@/lib/dues'

interface ResidentDuesItem {
  id: string
  name: string
  houseNumber: string
  phone?: string
  telegramChatId?: string | null
  telegramUsername?: string | null
  isTelegramConnected: boolean
  level: number
  levelLabel: string
  overdueMonthsCount: number
  totalOverdueAmount: number
  overduePeriods: {
    month: number
    year: number
    monthName: string
    amount: number
    status: string
  }[]
  lastNotificationStatus: string
  lastNotificationDate: string | null
}

export default function TunggakanClientTable({ initialData }: { initialData: ResidentDuesItem[] }) {
  const [filterLevel, setFilterLevel] = useState<string>('ALL')
  const [search, setSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<'AMOUNT_DESC' | 'MONTHS_DESC' | 'HOUSE_ASC'>('MONTHS_DESC')
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [messageNotice, setMessageNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Filter logic
  let filtered = initialData.filter(item => {
    // Search
    const matchSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.houseNumber.toLowerCase().includes(search.toLowerCase())

    if (!matchSearch) return false

    // Filter Level
    if (filterLevel === 'LEVEL_1') return item.level === 1
    if (filterLevel === 'LEVEL_2') return item.level === 2
    if (filterLevel === 'LEVEL_3') return item.level === 3
    if (filterLevel === 'LEVEL_4') return item.level >= 4

    return true
  })

  // Sort logic
  filtered.sort((a, b) => {
    if (sortBy === 'AMOUNT_DESC') return b.totalOverdueAmount - a.totalOverdueAmount
    if (sortBy === 'MONTHS_DESC') return b.overdueMonthsCount - a.overdueMonthsCount
    if (sortBy === 'HOUSE_ASC') return a.houseNumber.localeCompare(b.houseNumber, undefined, { numeric: true })
    return 0
  })

  // Single reminder send trigger
  async function handleSendReminder(residentId: string, residentName: string, isConnected: boolean) {
    if (!isConnected) {
      alert(`Warga ${residentName} belum menghubungkan akun Telegram! Notifikasi tidak dapat dikirim.`)
      return
    }

    const confirmSend = confirm(`Kirim notifikasi pengingat Telegram ke ${residentName}?`)
    if (!confirmSend) return

    setSendingId(residentId)
    setMessageNotice(null)

    try {
      const res = await fetch('/api/admin/remind-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residentId })
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Gagal mengirim pengingat.')
      }

      setMessageNotice({
        type: 'success',
        text: `✅ Pengingat Telegram berhasil terkirim ke ${residentName}!`
      })
    } catch (err: any) {
      setMessageNotice({
        type: 'error',
        text: `❌ Error: ${err.message}`
      })
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {messageNotice && (
        <div className={`p-4 rounded-xl font-medium text-sm border flex justify-between items-center ${messageNotice.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
          <span>{messageNotice.text}</span>
          <button onClick={() => setMessageNotice(null)} className="text-xs font-bold underline">Tutup</button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          {/* Level Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterLevel('ALL')}
              className={`px-4 py-2 rounded-lg font-semibold text-xs transition ${filterLevel === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Semua ({initialData.length})
            </button>
            <button
              onClick={() => setFilterLevel('LEVEL_1')}
              className={`px-4 py-2 rounded-lg font-semibold text-xs transition ${filterLevel === 'LEVEL_1' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100'}`}
            >
              🟡 1 Bulan ({initialData.filter(i => i.level === 1).length})
            </button>
            <button
              onClick={() => setFilterLevel('LEVEL_2')}
              className={`px-4 py-2 rounded-lg font-semibold text-xs transition ${filterLevel === 'LEVEL_2' ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'}`}
            >
              🟠 2 Bulan ({initialData.filter(i => i.level === 2).length})
            </button>
            <button
              onClick={() => setFilterLevel('LEVEL_3')}
              className={`px-4 py-2 rounded-lg font-semibold text-xs transition ${filterLevel === 'LEVEL_3' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'}`}
            >
              🔴 3 Bulan ({initialData.filter(i => i.level === 3).length})
            </button>
            <button
              onClick={() => setFilterLevel('LEVEL_4')}
              className={`px-4 py-2 rounded-lg font-semibold text-xs transition ${filterLevel === 'LEVEL_4' ? 'bg-rose-950 text-rose-200' : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'}`}
            >
              🔴 4+ Bulan ({initialData.filter(i => i.level >= 4).length})
            </button>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Cari nama atau no rumah..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px]"
            />

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="MONTHS_DESC">Urutkan: Tunggakan Terbanyak</option>
              <option value="AMOUNT_DESC">Urutkan: Nominal Terbesar</option>
              <option value="HOUSE_ASC">Urutkan: Nomor Rumah</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <span className="text-4xl block mb-2">🎉</span>
            Tidak ada warga yang sesuai dengan kriteria filter tunggakan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3.5 px-6 font-semibold">Rumah</th>
                  <th className="py-3.5 px-6 font-semibold">Nama Warga</th>
                  <th className="py-3.5 px-6 font-semibold">Jumlah Bulan</th>
                  <th className="py-3.5 px-6 font-semibold">Periode Tunggakan</th>
                  <th className="py-3.5 px-6 font-semibold">Total Nominal</th>
                  <th className="py-3.5 px-6 font-semibold">Klasifikasi Level</th>
                  <th className="py-3.5 px-6 font-semibold">Status Telegram</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {filtered.map(item => {
                  const meta = getLevelMetadata(item.level as any)
                  const periodsStr = item.overduePeriods.map(p => `${p.monthName.slice(0, 3)} ${p.year}`).join(', ')

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-4 px-6 font-bold text-slate-800 whitespace-nowrap">
                        Blok {item.houseNumber}
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-800">
                        <Link href={`/admin/warga/${item.id}`} className="hover:text-blue-600 hover:underline">
                          {item.name}
                        </Link>
                      </td>
                      <td className="py-4 px-6 font-bold text-slate-700 whitespace-nowrap">
                        {item.overdueMonthsCount} bulan
                      </td>
                      <td className="py-4 px-6 text-slate-600 max-w-xs truncate text-xs font-mono">
                        {periodsStr || '-'}
                      </td>
                      <td className="py-4 px-6 font-extrabold text-rose-600 whitespace-nowrap">
                        Rp {item.totalOverdueAmount.toLocaleString('id-ID')}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border ${meta.badgeBgClass}`}>
                          {meta.badgeText}
                        </span>
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        {item.isTelegramConnected ? (
                          <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                            🟢 Terhubung
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                            ⚪ Belum
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap space-x-2">
                        <Link
                          href={`/admin/warga/${item.id}`}
                          className="inline-block px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md font-medium text-xs transition"
                        >
                          Detail
                        </Link>
                        <button
                          onClick={() => handleSendReminder(item.id, item.name, item.isTelegramConnected)}
                          disabled={sendingId === item.id || !item.isTelegramConnected}
                          className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-md font-medium text-xs transition shadow-sm"
                        >
                          {sendingId === item.id ? 'Mengirim...' : '📩 Ingatkan TG'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
