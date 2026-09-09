import { NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(request: Request) {
  const adminClient = createAdminClient()
  
  // Find a user with telegram_chat_id
  const { data: profiles } = await adminClient.from('profiles').select('telegram_chat_id').not('telegram_chat_id', 'is', null).limit(1)
  
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ error: 'No profile with telegram_chat_id found' })
  }
  
  const chatId = profiles[0].telegram_chat_id
  
  // Attempt to send the exact overpayment message
  let msg = `✅ <b>PEMBAYARAN DITERIMA & TUNGGAKAN LUNAS</b>\n\n`
  msg += `Halo Pratiwi,\n`
  msg += `Pembayaran sebesar <b>Rp 300.000</b> telah diverifikasi.\n\n`
  msg += `Dana ini telah memproses tagihan bulan:\n`
  msg += `- September 2026\n`
  msg += `- Agustus 2026\n`
  msg += `- Juli 2026\n`
  msg += `\n\nTerima kasih atas partisipasi Anda!`
  
  const result = await sendTelegramMessage(chatId, msg)
  
  return NextResponse.json({ result, chatId, msg })
}
