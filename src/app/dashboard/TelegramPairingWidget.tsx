'use client'

import { useState } from 'react'

interface TelegramPairingWidgetProps {
  isTelegramConnected: boolean
  telegramUsername?: string | null
}

export default function TelegramPairingWidget({
  isTelegramConnected,
  telegramUsername
}: TelegramPairingWidgetProps) {
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerateCode() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/telegram/pairing', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Gagal membuat kode pairing')
      }
      setPairingCode(data.code)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    const confirmDisc = confirm('Yakin ingin memutuskan tautan akun Telegram Anda?')
    if (!confirmDisc) return

    setDisconnecting(true)
    setError('')
    try {
      const res = await fetch('/api/telegram/pairing', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Gagal memutuskan Telegram')
      }
      window.location.reload()
    } catch (err: any) {
      setError(err.message)
      setDisconnecting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <span>✈️</span> Notifikasi Telegram
        </h4>
        {isTelegramConnected ? (
          <span className="inline-flex items-center text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
            🟢 Terhubung
          </span>
        ) : (
          <span className="inline-flex items-center text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            ⚪ Belum Terhubung
          </span>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {isTelegramConnected ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Akun Telegram Anda {telegramUsername ? <strong>({telegramUsername})</strong> : ''} telah terhubung dengan sistem iuran perumahan. Anda akan menerima notifikasi tagihan secara otomatis.
          </p>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-xl text-xs transition border border-rose-200"
          >
            {disconnecting ? 'Memproses...' : 'Putuskan Telegram'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Hubungkan Telegram Anda agar mendapatkan notifikasi rincian iuran dan bukti pembayaran lunas secara otomatis tanpa terlewat.
          </p>

          {!pairingCode ? (
            <button
              onClick={handleGenerateCode}
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-blue-500/20"
            >
              {loading ? 'Membuat Kode...' : '🔗 Tautkan Telegram'}
            </button>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center space-y-3">
              <p className="text-xs text-blue-900 font-semibold">Kode Pairing Anda (Berlaku 15 Menit):</p>
              <div className="text-3xl font-extrabold tracking-widest text-blue-700 font-mono bg-white py-2 px-4 rounded-lg border border-blue-200 select-all">
                {pairingCode}
              </div>
              <ol className="text-xs text-slate-600 text-left space-y-1 bg-white/80 p-3 rounded-lg border border-blue-100">
                <li>1. Buka Telegram Bot <b>@PerumahanBot</b></li>
                <li>2. Kirim pesan: <code className="bg-slate-100 px-1 rounded font-bold">/start {pairingCode}</code></li>
                <li>3. Halaman ini akan otomatis terhubung!</li>
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
