import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  sendTelegramMessage,
  formatPaymentAutoValidatedMessage,
  formatPaymentConfirmedMessage,
  formatPaymentManualReviewRequiredMessage,
  formatPaymentAutoValidatedMultipleMessage,
  formatPaymentConfirmedMultipleMessage
} from '@/lib/telegram'
import { MONTH_NAMES } from '@/lib/dues'

// Initialize Supabase admin client
const adminClient = createAdminClient()

async function fetchImageAsBase64(url: string): Promise<{ mimeType: string, data: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const mimeType = res.headers.get('content-type') || 'image/jpeg'
    const base64 = Buffer.from(buffer).toString('base64')
    return { mimeType, data: base64 }
  } catch (err) {
    console.error('Error fetching image:', err)
    return null
  }
}

async function analyzeReceiptWithGemini(base64Data: string, mimeType: string) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const prompt = `Anda adalah asisten verifikasi keuangan yang sangat teliti.
Tugas Anda adalah membaca gambar struk bukti transfer/pembayaran ini dan mengekstrak informasi dengan tepat.
Jika gambar terlihat seperti editan Photoshop, manipulasi teks, atau BUKAN struk/bukti transfer asli (misalnya gambar pemandangan, selfie, atau layar kosong), set is_fake ke true.
Jawab HANYA dengan JSON murni tanpa markdown, dengan format:
{
  "nominal": 150000,
  "tanggal": "2024-03-05", 
  "is_fake": false,
  "alasan_fake": "penjelasan singkat jika fake, atau kosong"
}
Catatan:
- nominal adalah angka saja tanpa titik/koma (number). Jika tidak terbaca, set 0.
- tanggal gunakan format YYYY-MM-DD. Jika tidak terbaca/tidak ada, set null.
- is_fake boolean.`

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType, data: base64Data } }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  }

  // Use the fallback models
  const models = ['gemini-3.6-flash', 'gemini-3.5-flash-lite']
  let lastError = null

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!res.ok) {
        throw new Error(`Gemini API Error: ${res.status} ${res.statusText}`)
      }

      const data = await res.json()
      if (data.candidates && data.candidates.length > 0) {
        const text = data.candidates[0].content.parts[0].text
        const cleanJson = text.replace(/```json\\n/g, '').replace(/```/g, '').trim()
        return JSON.parse(cleanJson)
      }
    } catch (err: any) {
      console.warn(`Model ${model} failed:`, err.message)
      lastError = err
    }
  }

  throw lastError || new Error('All models failed')
}

// Auto-validate payments that have been pending for more than 15 minutes
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const cutoff = new Date(now.getTime() - 15 * 60 * 1000).toISOString()

  // Fetch all bills in PENDING status that were updated > 15 minutes ago
  const { data: pendingBills, error: billsError } = await adminClient
    .from('bills')
    .select('id, profile_id, user_id, total_amount, period_month, period_year, updated_at')
    .eq('status', 'PENDING')
    .lt('updated_at', cutoff)

  if (billsError) {
    console.error('Error fetching pending bills:', billsError)
    return NextResponse.json({ error: billsError.message }, { status: 500 })
  }

  if (!pendingBills || pendingBills.length === 0) {
    return NextResponse.json({ success: true, validated: 0, message: 'Tidak ada pembayaran menunggu validasi.' })
  }

  let validatedCount = 0
  const skipped: string[] = []
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID

  for (const bill of pendingBills) {
    const profileId = bill.profile_id || bill.user_id

    // Fetch warga profile
    const { data: profile } = await adminClient
      .from('profiles')
      .select('full_name, house_number, telegram_chat_id')
      .eq('id', profileId)
      .maybeSingle()
      
    const name = profile?.full_name || 'Warga'
    const houseNumber = profile?.house_number || '-'

    // Find the latest payment for this bill
    const { data: payment } = await adminClient
      .from('payments')
      .select('id, amount, proof_url')
      .eq('bill_id', bill.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!payment || !payment.proof_url) {
      skipped.push(bill.id)
      continue
    }
    
    // --- SECURITY CHECK (SERVER-SIDE OCR) ---
    let aiResult = null
    try {
      const imgData = await fetchImageAsBase64(payment.proof_url)
      if (imgData) {
        aiResult = await analyzeReceiptWithGemini(imgData.data, imgData.mimeType)
      }
    } catch (err) {
      console.error('AI Verification failed:', err)
      // If AI fails completely (network error), skip for now, retry next cron
      skipped.push(bill.id)
      continue
    }

    if (!aiResult) {
      skipped.push(bill.id)
      continue
    }

    const monthName = bill.period_month ? (MONTH_NAMES[bill.period_month - 1] || `Bulan ${bill.period_month}`) : '-'
    const year = bill.period_year || now.getFullYear()

    let rejectionReason = null
    if (aiResult.is_fake) {
      rejectionReason = `Indikasi palsu/editan: ${aiResult.alasan_fake || 'Gambar tidak valid'}`
    } else if (aiResult.tanggal) {
      const receiptDate = new Date(aiResult.tanggal)
      const diffDays = Math.floor((now.getTime() - receiptDate.getTime()) / (1000 * 3600 * 24))
      if (diffDays > 7) {
        rejectionReason = `Tanggal struk sudah kadaluarsa/lama (${aiResult.tanggal}, >7 hari)`
      }
    }

    // Nominal check
    const totalAmount = Number(bill.total_amount) || 0
    if (!rejectionReason && aiResult.nominal < totalAmount) {
      rejectionReason = `Nominal di struk (Rp ${aiResult.nominal}) kurang dari tagihan (Rp ${totalAmount})`
    }

    if (rejectionReason) {
      // Mark as MANUAL_REVIEW to stop cron from trying again
      await adminClient.from('bills').update({ status: 'MANUAL_REVIEW' }).eq('id', bill.id)
      
      if (adminChatId) {
        const adminMsg = formatPaymentManualReviewRequiredMessage(name, houseNumber, monthName, year, rejectionReason)
        await sendTelegramMessage(adminChatId, adminMsg)
      }
      skipped.push(bill.id)
      continue
    }

    // --- ARREARS SETTLEMENT (Sistem Tunggakan) ---
    const verifiedAmount = aiResult.nominal
    let remainingAmount = verifiedAmount - totalAmount
    const settledBills = [`${monthName} ${year}`]

    // Mark current bill as PAID
    await adminClient.from('bills').update({ status: 'PAID' }).eq('id', bill.id)

    // Mark original payment as validated and adjust its amount so we don't double count
    const amountForThisBill = remainingAmount > 0 ? totalAmount : verifiedAmount
    await adminClient.from('payments').update({
      validated_by: 'system_cron',
      validated_at: new Date().toISOString(),
      amount: amountForThisBill
    }).eq('id', payment.id)
    
    // If there is excess money, automatically pay off older UNPAID bills
    if (remainingAmount > 0) {
      const { data: unpaidBills } = await adminClient
        .from('bills')
        .select('id, period_month, period_year, total_amount')
        .eq('profile_id', profileId)
        .eq('status', 'UNPAID')
        .order('period_year', { ascending: true })
        .order('period_month', { ascending: true })

      if (unpaidBills && unpaidBills.length > 0) {
        for (const unpaid of unpaidBills) {
          const unpaidTotal = Number(unpaid.total_amount) || 0
          if (remainingAmount >= unpaidTotal) {
            // Pay it off!
            await adminClient.from('bills').update({ status: 'PAID' }).eq('id', unpaid.id)
            // Duplicate the payment record to link it to this bill for historical accuracy
            await adminClient.from('payments').insert({
              bill_id: unpaid.id,
              amount: unpaidTotal,
              proof_url: payment.proof_url
            })
            remainingAmount -= unpaidTotal
            const bMonth = unpaid.period_month ? MONTH_NAMES[unpaid.period_month - 1] : '-'
            settledBills.push(`${bMonth} ${unpaid.period_year}`)
          } else {
            break // Not enough remaining to pay the next bill fully
          }
        }
      }
      
      // If there's STILL money remaining, log it as "Lebih Bayar"
      if (remainingAmount > 0) {
        await adminClient.from('transactions').insert({
          type: 'INCOME',
          category: 'Lebih Bayar Tagihan',
          amount: remainingAmount,
          description: `Kelebihan bayar tagihan dari warga ${name} (${houseNumber})`,
          created_by: profileId
        })
      }
    }

    validatedCount++
    const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

    // Notifications
    if (profile?.telegram_chat_id) {
      if (settledBills.length > 1) {
        const wargaMsg = formatPaymentConfirmedMultipleMessage(name, settledBills, verifiedAmount, dateStr)
        await sendTelegramMessage(profile.telegram_chat_id, wargaMsg)
      } else {
        const wargaMsg = formatPaymentConfirmedMessage(name, monthName, year, totalAmount, dateStr)
        await sendTelegramMessage(profile.telegram_chat_id, wargaMsg)
      }
    }

    if (adminChatId) {
      if (settledBills.length > 1) {
        const adminMsg = formatPaymentAutoValidatedMultipleMessage(name, houseNumber, settledBills, verifiedAmount)
        await sendTelegramMessage(adminChatId, adminMsg)
      } else {
        const adminMsg = formatPaymentAutoValidatedMessage(name, houseNumber, monthName, year, totalAmount)
        await sendTelegramMessage(adminChatId, adminMsg)
      }
    }
  }

  return NextResponse.json({
    success: true,
    validated: validatedCount,
    skipped: skipped.length,
    message: `${validatedCount} pembayaran berhasil divalidasi otomatis.`
  })
}
