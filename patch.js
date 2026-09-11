const fs = require('fs');
let code = fs.readFileSync('old_route.ts', 'utf8');

const aiBlock = `
async function fetchImageAsBase64(url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to fetch image')
    const buffer = await res.arrayBuffer()
    return {
      data: Buffer.from(buffer).toString('base64'),
      mimeType: res.headers.get('content-type') || 'image/jpeg'
    }
  } catch (e) {
    console.error('Error fetching image:', e)
    return null
  }
}

async function analyzeReceiptWithGemini(base64Data: string, mimeType: string) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const prompt = \`Anda adalah asisten verifikasi keuangan yang sangat teliti.
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
- is_fake boolean.\`

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

  const models = ['gemini-3.6-flash', 'gemini-3.5-flash-lite']
  let lastError = null

  for (const model of models) {
    try {
      const url = \`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent?key=\${apiKey}\`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!res.ok) {
        throw new Error(\`Gemini API Error: \${res.status} \${res.statusText}\`)
      }

      const data = await res.json()
      if (data.candidates && data.candidates.length > 0) {
        const text = data.candidates[0].content.parts[0].text
        const cleanJson = text.replace(/\`\`\`json\\n/g, '').replace(/\`\`\`/g, '').trim()
        return JSON.parse(cleanJson)
      }
    } catch (err: any) {
      console.warn(\`Model \${model} failed:\`, err.message)
      lastError = err
    }
  }

  throw lastError || new Error('All models failed')
}

export async function POST(request: Request) {
`;

code = code.replace('export async function POST(request: Request) {', aiBlock);

const approveBlock = `
  if (action === 'approve' || action === 'approve_exempt' || action === 'auto_verify') {
    // 1. Fetch the payment being approved
    const { data: payment } = await adminClient.from('payments').select('amount, payment_proof_url, covered_items, proof_url').eq('id', paymentId).single()
    const thisAmount = Number(payment?.amount || 0)

    if (action === 'auto_verify') {
      const proofUrl = payment?.payment_proof_url || payment?.proof_url
      if (!proofUrl) {
        return NextResponse.redirect(new URL(\`/admin/dashboard?msg=\${encodeURIComponent('Gagal: Bukti pembayaran tidak ditemukan.')}\`, request.url), { status: 302 })
      }
      
      try {
        const imgData = await fetchImageAsBase64(proofUrl)
        if (!imgData) {
          return NextResponse.redirect(new URL(\`/admin/dashboard?msg=\${encodeURIComponent('Gagal: Tidak dapat mengunduh gambar bukti pembayaran.')}\`, request.url), { status: 302 })
        }
        
        const aiResult = await analyzeReceiptWithGemini(imgData.data, imgData.mimeType)
        
        if (aiResult.is_fake) {
          return NextResponse.redirect(new URL(\`/admin/dashboard?msg=\${encodeURIComponent('Ditolak AI: Indikasi bukti palsu/editan. ' + (aiResult.alasan_fake || ''))}\`, request.url), { status: 302 })
        }
        
        if (aiResult.tanggal) {
          const receiptDate = new Date(aiResult.tanggal)
          const now = new Date()
          const diffDays = Math.floor((now.getTime() - receiptDate.getTime()) / (1000 * 3600 * 24))
          if (diffDays > 7) {
             return NextResponse.redirect(new URL(\`/admin/dashboard?msg=\${encodeURIComponent(\`Ditolak AI: Tanggal struk sudah kedaluwarsa/lama (\${aiResult.tanggal}, >7 hari). Mohon verifikasi manual.\`)}\`, request.url), { status: 302 })
          }
        }

        // Validate the nominal amount from AI vs the expected amount
        // Note: we fetch the bill to see if it makes sense.
        const { data: bill } = await adminClient.from('bills').select('water_fee, trash_fee, security_fee, treasury_fee').eq('id', billId).single()
        const billOriginalTotal = Number(bill?.water_fee || 0) + Number(bill?.trash_fee || 0) + Number(bill?.security_fee || 0) + Number(bill?.treasury_fee || 0)
        
        if (aiResult.nominal < billOriginalTotal && aiResult.nominal < thisAmount) {
           return NextResponse.redirect(new URL(\`/admin/dashboard?msg=\${encodeURIComponent(\`Ditolak AI: Nominal di struk (Rp \${aiResult.nominal.toLocaleString('id-ID')}) kurang dari tagihan/pembayaran.\`)}\`, request.url), { status: 302 })
        }

        // We DO NOT override thisAmount with aiResult.nominal! We keep thisAmount as what the user submitted, 
        // to avoid charging them for something the OCR got wrong.
      } catch (err: any) {
        return NextResponse.redirect(new URL(\`/admin/dashboard?msg=\${encodeURIComponent('Gagal verifikasi AI: ' + err.message)}\`, request.url), { status: 302 })
      }
    }
`;

code = code.replace(`  if (action === 'approve' || action === 'approve_exempt') {
    // 1. Fetch the payment being approved
    const { data: payment } = await adminClient.from('payments').select('amount, payment_proof_url, covered_items').eq('id', paymentId).single()
    const thisAmount = Number(payment?.amount || 0)`, approveBlock);

fs.writeFileSync('src/app/api/admin/validate/route.ts', code);
