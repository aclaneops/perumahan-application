import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

// Generate random pairing code
function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const code = generatePairingCode()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 mins

  // Invalidate any existing unused pairing codes for this profile
  await adminClient
    .from('telegram_pairings')
    .update({ used: true })
    .eq('profile_id', user.id)
    .eq('used', false)

  const { error } = await adminClient
    .from('telegram_pairings')
    .insert({
      profile_id: user.id,
      code,
      expires_at: expiresAt,
      used: false
    })

  if (error) {
    console.error('Error generating pairing code:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    code,
    expiresAt,
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'PerumahanBot'
  })
}

export async function DELETE(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createAdminClient()

  // Disconnect Telegram: clear telegram_chat_id & telegram_username
  const { error } = await adminClient
    .from('profiles')
    .update({
      telegram_chat_id: null,
      telegram_username: null
    })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
