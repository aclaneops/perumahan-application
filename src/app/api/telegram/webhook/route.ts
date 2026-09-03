import { createAdminClient } from '@/utils/supabase/admin'
import { sendTelegramMessage } from '@/lib/telegram'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const update = await request.json()
    const message = update?.message

    if (!message || !message.chat || !message.text) {
      return NextResponse.json({ ok: true })
    }

    const chatId = String(message.chat.id)
    const username = message.chat.username ? `@${message.chat.username}` : null
    const text = message.text.trim()

    // Extract code from "/start CODE" or "CODE"
    let code = text
    if (text.startsWith('/start')) {
      const parts = text.split(' ')
      if (parts.length > 1) {
        code = parts[1].trim()
      } else {
        await sendTelegramMessage(
          chatId,
          `Halo! 👋 Selamat datang di Telegram Bot Perumahan.\n\nUntuk menghubungkan akun Telegram Anda dengan akun warga:\n1. Login ke website perumahan\n2. Klik tombol <b>Tautkan Telegram</b>\n3. Kirimkan kode pairing 6-karakter ke bot ini atau klik tombol tautkan langsung.\n\nContoh: <code>/start ABC123</code>`
        )
        return NextResponse.json({ ok: true })
      }
    }

    code = code.toUpperCase()
    const adminClient = createAdminClient()

    // Lookup code in telegram_pairings
    const { data: pairing } = await adminClient
      .from('telegram_pairings')
      .select('*')
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (!pairing) {
      await sendTelegramMessage(
        chatId,
        `❌ Kode pairing <b>${code}</b> tidak valid, telah kadaluarsa (lebih dari 15 menit), atau sudah digunakan.\n\nSilakan buka website perumahan dan klik tombol <b>Tautkan Telegram</b> untuk mendapatkan kode baru.`
      )
      return NextResponse.json({ ok: true })
    }

    // Link profile with telegram_chat_id & telegram_username
    const { data: profile, error: updateError } = await adminClient
      .from('profiles')
      .update({
        telegram_chat_id: chatId,
        telegram_username: username
      })
      .eq('id', pairing.profile_id)
      .select('full_name, house_number')
      .single()

    if (updateError) {
      console.error('Error linking Telegram profile:', updateError)
      await sendTelegramMessage(chatId, `❌ Terjadi kesalahan saat menghubungkan akun. Silakan coba lagi.`)
      return NextResponse.json({ ok: true })
    }

    // Mark pairing as used
    await adminClient
      .from('telegram_pairings')
      .update({ used: true })
      .eq('id', pairing.id)

    // Send success confirmation message
    await sendTelegramMessage(
      chatId,
      `🟢 <b>Selamat! Telegram Terhubung</b>\n\nAkun Telegram Anda telah berhasil dihubungkan dengan data warga:\n\n👤 Nama: <b>${profile.full_name}</b>\n🏠 Rumah: <b>Blok ${profile.house_number}</b>\n\nSekarang Anda akan menerima notifikasi rincian tagihan, pengingat iuran, dan bukti konfirmasi pembayaran lunas secara otomatis via Telegram. Terima kasih! 🙏`
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Telegram Webhook Exception:', err)
    return NextResponse.json({ ok: true })
  }
}
