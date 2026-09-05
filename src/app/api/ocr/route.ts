import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 })
    }

    // Convert file to base64 for Gemini
    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    
    // Determine mime type
    const mimeType = file.type || 'image/jpeg'

    const prompt = `Kamu adalah sistem OCR untuk membaca bukti transfer bank Indonesia.
Dari gambar bukti transfer/pembayaran ini, cari NOMINAL UTAMA yang ditransfer.

Aturan:
1. Cari angka yang merupakan nominal transfer utama (bukan biaya admin, bukan saldo).
2. Pada bukti transfer bank biasanya tertulis "Nominal", "Jumlah", "Total Transaksi", atau "Amount".
3. Abaikan biaya admin bank atau biaya layanan.
4. Jika ada dari ShopeePay, OVO, GoPay, Dana - cari nominal pembayaran utamanya.
5. Jika dari Livin Mandiri, BCA Mobile, BNI Mobile, BRI Mobile - cari "Total Transaksi" atau "Nominal".

Kembalikan HANYA angka saja tanpa titik, koma, Rp, atau spasi.
Contoh: jika nominal Rp 300.000 maka kembalikan: 300000
Contoh: jika nominal Rp 1.500.000 maka kembalikan: 1500000

Jika tidak bisa menemukan nominal, kembalikan: 0`

    // Try multiple model names in order of preference
    const models = ['gemini-3.6-flash', 'gemini-3.5-flash-lite']
    
    let lastError = null
    
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
        
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64Data
                  }
                }
              ]
            }]
          })
        })

        const data = await res.json()
        
        if (!res.ok) {
          console.error(`Model ${model} failed:`, data.error?.message || JSON.stringify(data))
          lastError = data.error?.message || `HTTP ${res.status}`
          continue // Try next model
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        console.log(`OCR result from ${model}:`, text)
        
        // Clean up the text to extract just the numbers
        const cleanNumber = text.replace(/[^0-9]/g, '')
        
        return NextResponse.json({ nominal: cleanNumber ? parseInt(cleanNumber, 10) : 0 })
        
      } catch (err: any) {
        console.error(`Model ${model} exception:`, err.message)
        lastError = err.message
        continue
      }
    }
    
    // All models failed
    return NextResponse.json({ error: lastError || 'Semua model gagal' }, { status: 500 })
    
  } catch (error: any) {
    console.error('OCR Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to process image' }, { status: 500 })
  }
}
