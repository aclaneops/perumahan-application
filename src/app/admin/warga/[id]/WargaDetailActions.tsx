'use client'

import { useState } from 'react'

interface WargaDetailActionsProps {
  residentId: string
  residentName: string
  isTelegramConnected: boolean
  lastSentAt: string | null
}

export default function WargaDetailActions({
  residentId,
  residentName,
  isTelegramConnected,
  lastSentAt
}: WargaDetailActionsProps) {
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSendReminder() {
    if (!isTelegramConnected) {
      alert(`Warga ${residentName} belum menghubungkan akun Telegram! Notifikasi tidak dapat dikirim.`)
      return
    }

    // Anti-spam warning if sent within last 24h
    if (lastSentAt) {
      const lastDate = new Date(lastSentAt).getTime()
      const now = Date.now()
      const hoursAgo = (now - lastDate) / (1000 * 60 * 60)

      if (hoursAgo < 24) {
        const proceed = confirm(
          `Notifikasi terakhir telah dikirim ${Math.round(hoursAgo)} jam yang lalu.\n\nYakin ingin mengirim pengingat Telegram lagi ke ${residentName}?`
        )
        if (!proceed) return
      } else {
        const confirmSend = confirm(`Kirimkan pengingat iuran Telegram ke ${residentName}?`)
        if (!confirmSend) return
      }
    } else {
      const confirmSend = confirm(`Kirimkan pengingat iuran Telegram ke ${residentName}?`)
      if (!confirmSend) return
    }

    setLoading(true)
    setNotice(null)

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

      setNotice({
        type: 'success',
        text: `✅ Pengingat Telegram berhasil dikirimkan ke ${residentName}!`
      })
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: `❌ ${err.message}`
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {notice && (
        <div className={`p-2.5 px-4 rounded-lg text-xs font-semibold ${notice.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          {notice.text}
        </div>
      )}

      <button
        onClick={handleSendReminder}
        disabled={loading || !isTelegramConnected}
        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
      >
        {loading ? 'Mengirim...' : '📩 Kirim Pengingat Telegram'}
      </button>
    </div>
  )
}
