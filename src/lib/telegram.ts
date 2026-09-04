export async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN is not configured.')
    return { ok: false, description: 'TELEGRAM_BOT_TOKEN not configured' }
  }

  if (!chatId) {
    return { ok: false, description: 'No telegram_chat_id provided' }
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    })

    const data = await res.json()
    if (!res.ok || !data.ok) {
      console.error('Telegram API Response Error:', data)
    }
    return data
  } catch (err: any) {
    console.error('Telegram Fetch Exception:', err)
    return { ok: false, description: err.message || 'Network exception' }
  }
}

export function formatBillCreatedMessage(name: string, monthName: string, year: number, amount: number) {
  return `Halo Pak/Bu <b>${name}</b> 👋\n\nTagihan iuran warga bulan <b>${monthName} ${year}</b> telah terbit:\n<b>Rp ${amount.toLocaleString('id-ID')}</b>\n\nSilakan cek rincian dan lakukan pembayaran melalui aplikasi. Terima kasih. 🙏`
}

export function formatHMinus5Message(name: string, monthName: string, year: number, amount: number, dueDateStr: string) {
  return `Halo Pak/Bu <b>${name}</b> 👋\n\nMengingatkan bahwa iuran warga bulan <b>${monthName} ${year}</b> sebesar:\n<b>Rp ${amount.toLocaleString('id-ID')}</b>\n\nakan jatuh tempo pada:\n<b>${dueDateStr}</b>.\n\nTerima kasih. 🙏`
}

export function formatDueDateMessage(name: string, monthName: string, year: number, amount: number) {
  return `Halo Pak/Bu <b>${name}</b> 👋\n\nIuran warga bulan <b>${monthName} ${year}</b> sebesar <b>Rp ${amount.toLocaleString('id-ID')}</b> jatuh tempo hari ini.\n\nMohon dapat melakukan pembayaran apabila belum dilakukan. Terima kasih! 🙏`
}

export function formatOverdueMessage(name: string, monthName: string, year: number, amount: number) {
  return `Halo Pak/Bu <b>${name}</b> 👋\n\nPembayaran iuran bulan <b>${monthName} ${year}</b> sebesar <b>Rp ${amount.toLocaleString('id-ID')}</b> belum tercatat.\n\nMohon melakukan pembayaran apabila belum dilakukan. Jika pembayaran sudah dilakukan, silakan abaikan pesan ini. Terima kasih.`
}

export function formatOverdueMultipleMessage(name: string, overduePeriods: { monthName: string; year: number; amount: number }[], totalAmount: number) {
  const list = overduePeriods.map(p => `• ${p.monthName} ${p.year} — Rp ${p.amount.toLocaleString('id-ID')}`).join('\n')
  return `Halo Pak/Bu <b>${name}</b> 👋\n\nBerdasarkan catatan pembayaran, saat ini terdapat tunggakan iuran:\n\n${list}\n\n<b>Total Tunggakan: Rp ${totalAmount.toLocaleString('id-ID')}</b>\n\nMohon dapat melakukan pembayaran. Jika pembayaran sudah dilakukan namun belum tercatat, silakan hubungi pengurus perumahan. Terima kasih! 🙏`
}

export function formatPaymentConfirmedMessage(name: string, monthName: string, year: number, amount: number, dateStr: string) {
  return `Halo Pak/Bu <b>${name}</b> 👋\n\nPembayaran iuran telah berhasil dicatat & divalidasi.\n\nPeriode: <b>${monthName} ${year}</b>\nNominal: <b>Rp ${amount.toLocaleString('id-ID')}</b>\nTanggal: <b>${dateStr}</b>\nStatus: <b>✅ LUNAS</b>\n\nTerima kasih atas partisipasinya! 🙏`
}

export function formatPaymentRejectedMessage(name: string, monthName: string, year: number) {
  return `Halo Pak/Bu <b>${name}</b> 👋\n\nMohon maaf, bukti pembayaran iuran periode <b>${monthName} ${year}</b> yang Anda kirim <b>belum dapat divalidasi</b> oleh admin.\n\nSilakan cek kembali bukti transfer dan upload ulang, atau hubungi pengurus perumahan untuk info lebih lanjut. Terima kasih 🙏`
}

export function formatNewPaymentSubmittedMessage(name: string, houseNumber: string, monthName: string, year: number, amount: number) {
  return `📥 <b>Bukti Pembayaran Baru</b>\n\nWarga: <b>${name}</b> (${houseNumber})\nPeriode: <b>${monthName} ${year}</b>\nNominal: <b>Rp ${amount.toLocaleString('id-ID')}</b>\n\nMohon segera dicek & divalidasi di panel admin.`
}

export function formatAdminSummaryReportMessage(monthName: string, year: number, stats: {
  totalWarga: number
  sudahBayar: number
  belumBayar: number
  totalDiterima: number
  totalBelumTertagih: number
  lancarCount: number
  l1Count: number
  l2Count: number
  l3Count: number
  l4Count: number
}) {
  return `📊 <b>LAPORAN IURAN PERUMAHAN</b>\nPeriode: <b>${monthName} ${year}</b>\n\n` +
    `Total Warga: <b>${stats.totalWarga}</b>\n` +
    `Sudah Bayar: <b>${stats.sudahBayar}</b>\n` +
    `Belum Bayar: <b>${stats.belumBayar}</b>\n\n` +
    `Total Diterima: <b>Rp ${stats.totalDiterima.toLocaleString('id-ID')}</b>\n` +
    `Total Belum Tertagih: <b>Rp ${stats.totalBelumTertagih.toLocaleString('id-ID')}</b>\n\n` +
    `<b>Statistik Tunggakan:</b>\n` +
    `🟢 Lancar: ${stats.lancarCount} warga\n` +
    `🟡 1 Bulan: ${stats.l1Count} warga\n` +
    `🟠 2 Bulan: ${stats.l2Count} warga\n` +
    `🔴 3 Bulan: ${stats.l3Count} warga\n` +
    `🔴 4+ Bulan: ${stats.l4Count} warga`
}
