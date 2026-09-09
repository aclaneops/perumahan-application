import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'
import { sendTelegramMessage, formatPaymentConfirmedMessage, formatPaymentPartialMessage, formatPaymentRejectedMessage } from '@/lib/telegram'
import { MONTH_NAMES } from '@/lib/dues'

export async function POST(request: Request) {
  const supabase = createClient()
  const formData = await request.formData()
  const billId = formData.get('billId') as string
  const paymentId = formData.get('paymentId') as string
  const action = formData.get('action') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url), { status: 302 })

  const adminClient = createAdminClient()

  if (action === 'approve' || action === 'approve_exempt') {
    // 1. Fetch the payment being approved
    const { data: payment } = await adminClient.from('payments').select('amount, payment_proof_url, covered_items').eq('id', paymentId).single()
    const thisAmount = Number(payment?.amount || 0)

    // 2. Fetch bill info
    const { data: bill } = await adminClient.from('bills').select('*').eq('id', billId).single()
    const profileId = bill?.profile_id || bill?.user_id
    const billOriginalTotal = Number(bill.total_amount || 0)

    // 3. Calculate remaining money and deduct fees
    let remainingAmount = thisAmount
    let newWater = Number(bill.water_fee || 0)
    let newTrash = Number(bill.trash_fee || 0)
    let newSecurity = Number(bill.security_fee || 0)
    let newTreasury = Number(bill.treasury_fee || 0)
    let paidItemsStrArr: string[] = []

    if (payment?.covered_items) {
      if (payment.covered_items.water) { remainingAmount -= newWater; newWater = 0; paidItemsStrArr.push('Air') }
      if (payment.covered_items.trash) { remainingAmount -= newTrash; newTrash = 0; paidItemsStrArr.push('Sampah') }
      if (payment.covered_items.security) { remainingAmount -= newSecurity; newSecurity = 0; paidItemsStrArr.push('Keamanan') }
      if (payment.covered_items.treasury) { remainingAmount -= newTreasury; newTreasury = 0; paidItemsStrArr.push('Kas RT') }
    } else {
      remainingAmount -= billOriginalTotal
      newWater = 0; newTrash = 0; newSecurity = 0; newTreasury = 0;
      paidItemsStrArr.push('Tagihan Bulanan')
    }

    const itemsPaidStr = paidItemsStrArr.length > 0 ? paidItemsStrArr.join(', ') : 'Tagihan'

    const newTotalAmount = newWater + newTrash + newSecurity + newTreasury
    let newStatus = newTotalAmount <= 0 ? 'PAID' : 'PARTIAL'

    if (action === 'approve_exempt') {
      newWater = 0
      newTrash = 0
      newSecurity = 0
      newTreasury = 0
      newStatus = 'PAID'
    }

    // Update the bill with the remaining fees
    await adminClient.from('bills').update({
      water_fee: newWater,
      trash_fee: newTrash,
      security_fee: newSecurity,
      treasury_fee: newTreasury,
      status: newStatus
    }).eq('id', billId)


    // 4. Mark payment as validated
    const { error: valErr } = await adminClient.from('payments').update({ 
      validated_by: user.id,
      validated_at: new Date().toISOString()
    }).eq('id', paymentId)

    if (valErr) {
      await adminClient.from('payments').update({ 
        confirmed_by: user.id,
        paid_at: new Date().toISOString()
      }).eq('id', paymentId)
    }

    // Amount actually used for this primary bill (to fix reporting double-count)
    const amountUsedForPrimary = thisAmount - Math.max(0, remainingAmount)

    // Log primary transaction
    const { data: residentProfile } = await adminClient
      .from('profiles')
      .select('full_name, house_number, telegram_chat_id')
      .eq('id', profileId)
      .maybeSingle()

    const name = residentProfile?.full_name || 'Warga'
    const houseNumber = residentProfile?.house_number || '-'
    const monthName = bill?.period_month ? MONTH_NAMES[bill.period_month - 1] : '-'
    
    if (amountUsedForPrimary > 0) {
      let finalDescription = `Pembayaran iuran bulan ${monthName} ${bill?.period_year} dari ${name} (${houseNumber}) - Item: ${itemsPaidStr}`
      if (payment?.covered_items?.notes) {
        finalDescription += ` | Ket: ${payment.covered_items.notes}`
      }
      
      await adminClient.from('transactions').insert({
        type: 'INCOME',
        category: 'Pembayaran Iuran',
        amount: amountUsedForPrimary,
        description: finalDescription,
        created_by: user.id,
        date: new Date().toISOString().split('T')[0]
      })
    }

    // --- ARREARS SETTLEMENT LOGIC ---
    let excessMsg = ''
    const settledBills = [bill?.period_month ? `${MONTH_NAMES[bill.period_month - 1]} ${bill.period_year}` : '']

    if (remainingAmount > 0 && profileId) {
      // Adjust original payment amount so it only accounts for the primary bill in Laporan
      await adminClient.from('payments').update({ amount: amountUsedForPrimary }).eq('id', paymentId)
      
      const { data: unpaidBills } = await adminClient
        .from('bills')
        .select('id, period_month, period_year, total_amount, water_fee, trash_fee, security_fee, treasury_fee')
        .eq('user_id', profileId)
        .eq('status', 'UNPAID')
        .order('period_year', { ascending: true })
        .order('period_month', { ascending: true })

      if (unpaidBills && unpaidBills.length > 0) {
        for (const unpaid of unpaidBills) {
          const unpaidTotal = Number(unpaid.total_amount) || 0
          if (remainingAmount >= unpaidTotal && unpaidTotal > 0) {
            await adminClient.from('bills').update({ 
              status: 'PAID',
              water_fee: 0, trash_fee: 0, security_fee: 0, treasury_fee: 0
            }).eq('id', unpaid.id)
            
            // Create a new payment record for the settled bill
            const { error: pErr } = await adminClient.from('payments').insert({
              bill_id: unpaid.id,
              profile_id: profileId,
              amount: unpaidTotal,
              payment_proof_url: payment?.payment_proof_url || payment?.proof_url,
              validated_by: user.id,
              validated_at: new Date().toISOString()
            })
            if (pErr) console.error('Error inserting partial payment:', pErr)

            // Also log transaction for settled bill
            const bMonth = unpaid.period_month ? MONTH_NAMES[unpaid.period_month - 1] : '-'
            await adminClient.from('transactions').insert({
              type: 'INCOME',
              category: 'Pembayaran Iuran',
              amount: unpaidTotal,
              description: `Pembayaran iuran bulan ${bMonth} ${unpaid.period_year} dari ${name} (Otomatis dari Lebih Bayar)`,
              created_by: user.id,
              date: new Date().toISOString().split('T')[0]
            })

            remainingAmount -= unpaidTotal
            settledBills.push(`${bMonth} ${unpaid.period_year}`)
          } else if (remainingAmount > 0) {
            // Partial arrears settlement is possible, but to keep it simple, 
            // if remaining is not enough for the full bill, we just stop.
            break
          } else {
            break 
          }
        }
      }

      if (remainingAmount > 0) {
        await adminClient.from('transactions').insert({
          type: 'INCOME',
          category: 'Lebih Bayar Tagihan',
          amount: remainingAmount,
          description: `Kelebihan bayar tagihan dari ${name}`,
          created_by: user.id,
          date: new Date().toISOString().split('T')[0]
        })
        excessMsg = ` & Lebih bayar Rp ${remainingAmount.toLocaleString('id-ID')} masuk ke kas.`
      }
    }

    // 6. Notify resident via Telegram
    if (residentProfile?.telegram_chat_id) {
      const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      let msg = ''

      if (settledBills.length > 1) {
         msg = `✅ <b>PEMBAYARAN DITERIMA & TUNGGAKAN LUNAS</b>\n\n`
         msg += `Halo ${name},\n`
         msg += `Pembayaran sebesar <b>Rp ${thisAmount.toLocaleString('id-ID')}</b> telah diverifikasi.\n\n`
         msg += `Dana ini telah memproses tagihan bulan:\n`
         settledBills.forEach(b => msg += `- ${b}\n`)
         if (remainingAmount > 0) {
           msg += `\nTerdapat sisa dana (Lebih Bayar) sebesar <b>Rp ${remainingAmount.toLocaleString('id-ID')}</b> yang dimasukkan ke Kas.`
         }
         msg += `\n\nTerima kasih atas partisipasi Anda!`
      } else if (newStatus === 'PAID') {
        msg = formatPaymentConfirmedMessage(
          name,
          monthName,
          bill?.period_year || new Date().getFullYear(),
          amountUsedForPrimary,
          dateStr
        )
      } else {
        msg = formatPaymentPartialMessage(
          name,
          monthName,
          bill?.period_year || new Date().getFullYear(),
          amountUsedForPrimary,
          newTotalAmount,
          itemsPaidStr,
          dateStr
        )
      }
      await sendTelegramMessage(residentProfile.telegram_chat_id, msg)
    }
    
    let returnMsg = newStatus === 'PAID' 
      ? 'Pembayaran berhasil divalidasi. Tagihan lunas.'
      : 'Pembayaran sebagian berhasil divalidasi. Sisa tagihan ter-update.'
      
    if (settledBills.length > 1) {
      returnMsg = `Tagihan divalidasi. Berhasil melunasi ${settledBills.length} tagihan otomatis!${excessMsg}`
    }
    
    return NextResponse.redirect(new URL(`/admin/dashboard?msg=${encodeURIComponent(returnMsg)}`, request.url), { status: 302 })
  } else if (action === 'reject') {
    // Fetch bill info (for notification) + previous payments to see if there were any partial payments already
    const { data: billForReject } = await adminClient.from('bills').select('profile_id, user_id, period_month, period_year').eq('id', billId).single()
    const { data: otherPayments } = await adminClient.from('payments')
      .select('amount')
      .eq('bill_id', billId)
      .neq('id', paymentId)
      .not('validated_by', 'is', null)

    const previousPaid = otherPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
    
    // 1. Revert bill status to previous state
    const newStatus = previousPaid > 0 ? 'PARTIAL' : 'UNPAID'
    await adminClient.from('bills').update({ status: newStatus }).eq('id', billId)
    
    // 2. Delete rejected payment proof
    await adminClient.from('payments').delete().eq('id', paymentId)

    // 3. Notify resident via Telegram
    if (billForReject?.profile_id || billForReject?.user_id) {
      const { data: residentProfile } = await adminClient
        .from('profiles')
        .select('full_name, telegram_chat_id')
        .eq('id', billForReject.profile_id || billForReject.user_id)
        .maybeSingle()

      if (residentProfile?.telegram_chat_id) {
        const monthName = billForReject?.period_month ? (MONTH_NAMES[billForReject.period_month - 1] || `Bulan ${billForReject.period_month}`) : '-'
        const msg = formatPaymentRejectedMessage(
          residentProfile.full_name || 'Warga',
          monthName,
          billForReject?.period_year || new Date().getFullYear()
        )
        await sendTelegramMessage(residentProfile.telegram_chat_id, msg)
      }
    }
  }

  return NextResponse.redirect(new URL('/admin/dashboard', request.url), { status: 302 })
}
