import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { sendTelegramMessage, formatNewPaymentSubmittedMessage } from '@/lib/telegram'
import { MONTH_NAMES } from '@/lib/dues'

export async function POST(request: Request) {
  const supabase = createClient()
  const adminClient = createAdminClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const billId = formData.get('billId') as string
    const amountPaid = formData.get('amountPaid') as string

    if (!file || !billId) {
      return NextResponse.json({ error: 'File and billId are required' }, { status: 400 })
    }

    // Ensure bucket exists (ignore error if it already exists)
    await adminClient.storage.createBucket('payments', { public: true })

    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    
    // Upload file using admin client to bypass Storage RLS
    const { error: uploadError } = await adminClient.storage
      .from('payments')
      .upload(fileName, file)

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Gagal mengupload file ke storage' }, { status: 500 })
    }

    const { data: { publicUrl } } = adminClient.storage
      .from('payments')
      .getPublicUrl(fileName)

    // Fetch the bill for reference
    const { data: bill } = await adminClient
      .from('bills')
      .select('total_amount, period_month, period_year')
      .eq('id', billId)
      .single()

    // Insert record into payments table (supporting all column variations)
    let insertError = null
    
    // Try inserting with proof_url
    const try1 = await adminClient
      .from('payments')
      .insert({
        bill_id: billId,
        profile_id: user.id,
        user_id: user.id,
        amount: Number(amountPaid) || bill?.total_amount || 0,
        proof_url: publicUrl,
        payment_proof_url: publicUrl
      })

    if (try1.error) {
      // Fallback 1: proof_url only
      const try2 = await adminClient
        .from('payments')
        .insert({
          bill_id: billId,
          profile_id: user.id,
          amount: Number(amountPaid) || bill?.total_amount || 0,
          proof_url: publicUrl
        })
      
      if (try2.error) {
        // Fallback 2: payment_proof_url only
        const try3 = await adminClient
          .from('payments')
          .insert({
            bill_id: billId,
            profile_id: user.id,
            amount: Number(amountPaid) || bill?.total_amount || 0,
            payment_proof_url: publicUrl
          })
        insertError = try3.error
      }
    }

    if (insertError) {
      console.error('Insert payment error details:', JSON.stringify(insertError))
      return NextResponse.json({ error: `Gagal menyimpan data pembayaran: ${insertError.message}` }, { status: 500 })
    }

    // Update bill status to PENDING_CONFIRMATION
    await adminClient
      .from('bills')
      .update({ status: 'PENDING_CONFIRMATION' })
      .eq('id', billId)

    // Notify admin via Telegram
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
    if (adminChatId) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('full_name, house_number')
        .eq('id', user.id)
        .maybeSingle()

      const monthName = bill?.period_month ? (MONTH_NAMES[bill.period_month - 1] || `Bulan ${bill.period_month}`) : '-'
      const msg = formatNewPaymentSubmittedMessage(
        profile?.full_name || 'Warga',
        profile?.house_number || '-',
        monthName,
        bill?.period_year || new Date().getFullYear(),
        Number(amountPaid) || Number(bill?.total_amount) || 0
      )
      await sendTelegramMessage(adminChatId, msg)
    }

    return NextResponse.json({ success: true, url: publicUrl })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
