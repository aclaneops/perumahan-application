import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

// GET: Preview ringkasan sebelum tutup buku
export async function GET(request: Request) {
  const supabase = createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Verify admin
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || '')

  if (!year || isNaN(year)) {
    return NextResponse.json({ error: 'Parameter year wajib diisi' }, { status: 400 })
  }

  const currentYear = new Date().getFullYear()
  if (year >= currentYear) {
    return NextResponse.json({ error: 'Hanya bisa tutup buku untuk tahun yang sudah lewat' }, { status: 400 })
  }

  // Cek apakah sudah pernah ditutup
  const { data: existingClosing } = await adminClient
    .from('yearly_closings')
    .select('*')
    .eq('year', year)
    .maybeSingle()

  if (existingClosing) {
    return NextResponse.json({ error: `Tahun ${year} sudah ditutup pada ${new Date(existingClosing.closed_at).toLocaleDateString('id-ID')}` }, { status: 400 })
  }

  // Ambil saldo awal dari tutup buku tahun sebelumnya
  const { data: prevClosing } = await adminClient
    .from('yearly_closings')
    .select('carry_forward')
    .eq('year', year - 1)
    .maybeSingle()

  const previousCarryForward = Number(prevClosing?.carry_forward || 0)

  // Hitung total iuran (bills PAID) di tahun tersebut
  const { data: paidBills } = await adminClient
    .from('bills')
    .select('id, total_amount, period_month, period_year, status')
    .eq('period_year', year)
    .eq('status', 'PAID')

  const totalIuran = paidBills?.reduce((sum, b) => sum + Number(b.total_amount || 0), 0) || 0
  const paidBillCount = paidBills?.length || 0

  // Hitung payments terkait bills PAID
  const paidBillIds = paidBills?.map(b => b.id) || []
  let paymentCount = 0
  if (paidBillIds.length > 0) {
    const { data: payments } = await adminClient
      .from('payments')
      .select('id')
      .in('bill_id', paidBillIds)
    paymentCount = payments?.length || 0
  }

  // Hitung transaksi INCOME & EXPENSE di tahun tersebut
  const { data: yearTransactions } = await adminClient
    .from('transactions')
    .select('id, type, amount, date')

  let totalIncomeTransactions = 0
  let totalExpenseTransactions = 0
  let transactionCount = 0

  yearTransactions?.forEach(t => {
    const tDate = new Date(t.date)
    if (tDate.getFullYear() === year) {
      transactionCount++
      if (t.type === 'INCOME') totalIncomeTransactions += Number(t.amount)
      if (t.type === 'EXPENSE') totalExpenseTransactions += Number(t.amount)
    }
  })

  // Hitung tunggakan (bills UNPAID/PENDING di tahun tersebut)
  const { data: unpaidBills } = await adminClient
    .from('bills')
    .select('id, total_amount, period_month, period_year, status')
    .eq('period_year', year)
    .neq('status', 'PAID')

  const outstandingCount = unpaidBills?.length || 0
  const outstandingAmount = unpaidBills?.reduce((sum, b) => sum + Number(b.total_amount || 0), 0) || 0

  // Hitung notification_logs di tahun tersebut
  const { data: notifLogs } = await adminClient
    .from('notification_logs')
    .select('id')
    .eq('period_year', year)

  const notifLogCount = notifLogs?.length || 0

  // Total
  const totalIncome = totalIuran + totalIncomeTransactions + previousCarryForward
  const totalExpense = totalExpenseTransactions
  const carryForward = totalIncome - totalExpense

  return NextResponse.json({
    year,
    previousCarryForward,
    totalIuran,
    totalIncomeTransactions,
    totalExpense,
    totalIncome,
    carryForward,
    paidBillCount,
    paymentCount,
    transactionCount,
    outstandingCount,
    outstandingAmount,
    notifLogCount,
    totalDataToDelete: paidBillCount + paymentCount + transactionCount + notifLogCount
  })
}

// POST: Eksekusi tutup buku
export async function POST(request: Request) {
  const supabase = createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Verify admin
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { year, confirmText } = body

    if (!year || isNaN(year)) {
      return NextResponse.json({ error: 'Parameter year wajib diisi' }, { status: 400 })
    }

    const currentYear = new Date().getFullYear()
    if (year >= currentYear) {
      return NextResponse.json({ error: 'Hanya bisa tutup buku untuk tahun yang sudah lewat' }, { status: 400 })
    }

    // Validasi konfirmasi
    const expectedConfirm = `TUTUP BUKU ${year}`
    if (confirmText !== expectedConfirm) {
      return NextResponse.json({ error: `Konfirmasi harus ketik tepat: "${expectedConfirm}"` }, { status: 400 })
    }

    // Cek apakah sudah pernah ditutup
    const { data: existingClosing } = await adminClient
      .from('yearly_closings')
      .select('id')
      .eq('year', year)
      .maybeSingle()

    if (existingClosing) {
      return NextResponse.json({ error: `Tahun ${year} sudah ditutup sebelumnya` }, { status: 400 })
    }

    // === HITUNG RINGKASAN ===

    // Saldo awal dari tahun sebelumnya
    const { data: prevClosing } = await adminClient
      .from('yearly_closings')
      .select('carry_forward')
      .eq('year', year - 1)
      .maybeSingle()

    const previousCarryForward = Number(prevClosing?.carry_forward || 0)

    // Bills PAID di tahun ini
    const { data: paidBills } = await adminClient
      .from('bills')
      .select('id, total_amount')
      .eq('period_year', year)
      .eq('status', 'PAID')

    const totalIuran = paidBills?.reduce((sum, b) => sum + Number(b.total_amount || 0), 0) || 0
    const paidBillIds = paidBills?.map(b => b.id) || []

    // Transaksi di tahun ini
    const { data: yearTransactions } = await adminClient
      .from('transactions')
      .select('id, type, amount, date')

    let totalIncomeTransactions = 0
    let totalExpenseTransactions = 0
    const transactionIdsToDelete: string[] = []

    yearTransactions?.forEach(t => {
      const tDate = new Date(t.date)
      if (tDate.getFullYear() === year) {
        transactionIdsToDelete.push(t.id)
        if (t.type === 'INCOME') totalIncomeTransactions += Number(t.amount)
        if (t.type === 'EXPENSE') totalExpenseTransactions += Number(t.amount)
      }
    })

    // Tunggakan yang TIDAK dihapus
    const { data: unpaidBills } = await adminClient
      .from('bills')
      .select('id, total_amount')
      .eq('period_year', year)
      .neq('status', 'PAID')

    const outstandingCount = unpaidBills?.length || 0
    const outstandingAmount = unpaidBills?.reduce((sum, b) => sum + Number(b.total_amount || 0), 0) || 0

    // === EKSEKUSI HAPUS ===

    // 1. Hapus foto bukti bayar dari storage
    let paymentsDeleted = 0
    if (paidBillIds.length > 0) {
      const { data: payments } = await adminClient
        .from('payments')
        .select('id, proof_url, payment_proof_url')
        .in('bill_id', paidBillIds)

      if (payments && payments.length > 0) {
        // Extract file names from URLs and delete from storage
        const fileNames: string[] = []
        payments.forEach(p => {
          const url = p.proof_url || p.payment_proof_url || ''
          if (url) {
            // URL format: .../storage/v1/object/public/payments/filename.ext
            const parts = url.split('/payments/')
            if (parts.length > 1) {
              fileNames.push(parts[parts.length - 1])
            }
          }
        })

        if (fileNames.length > 0) {
          await adminClient.storage.from('payments').remove(fileNames)
        }

        // 2. Hapus payments records
        await adminClient.from('payments').delete().in('bill_id', paidBillIds)
        paymentsDeleted = payments.length
      }
    }

    // 3. Hapus bills yang PAID
    let billsDeleted = 0
    if (paidBillIds.length > 0) {
      await adminClient.from('bills').delete().in('id', paidBillIds)
      billsDeleted = paidBillIds.length
    }

    // 4. Hapus transaksi di tahun tersebut
    let transactionsDeleted = 0
    if (transactionIdsToDelete.length > 0) {
      // Delete in batches of 50 to avoid query limits
      for (let i = 0; i < transactionIdsToDelete.length; i += 50) {
        const batch = transactionIdsToDelete.slice(i, i + 50)
        await adminClient.from('transactions').delete().in('id', batch)
      }
      transactionsDeleted = transactionIdsToDelete.length
    }

    // 5. Hapus notification_logs di tahun tersebut
    await adminClient.from('notification_logs').delete().eq('period_year', year)

    // === SIMPAN RECORD TUTUP BUKU ===
    const totalIncome = totalIuran + totalIncomeTransactions + previousCarryForward
    const totalExpense = totalExpenseTransactions
    const carryForward = totalIncome - totalExpense

    const { error: insertError } = await adminClient
      .from('yearly_closings')
      .insert({
        year,
        total_income: totalIncome,
        total_expense: totalExpense,
        carry_forward: carryForward,
        previous_carry_forward: previousCarryForward,
        bills_deleted: billsDeleted,
        payments_deleted: paymentsDeleted,
        transactions_deleted: transactionsDeleted,
        outstanding_bills: outstandingCount,
        outstanding_amount: outstandingAmount,
        closed_by: user.id,
        notes: `Tutup buku tahun ${year}. Saldo dibawa ke tahun ${year + 1}: Rp ${carryForward.toLocaleString('id-ID')}`
      })

    if (insertError) {
      console.error('Error saving yearly closing:', insertError)
      return NextResponse.json({ error: `Gagal menyimpan record tutup buku: ${insertError.message}` }, { status: 500 })
    }

    // Insert saldo awal (carry_forward) ke transactions untuk tahun berikutnya jika saldonya > 0
    if (carryForward > 0) {
      await adminClient.from('transactions').insert({
        type: 'INCOME',
        category: 'Saldo Awal Tahun',
        amount: carryForward,
        description: `Saldo sisa dari penutupan buku tahun ${year}`,
        date: `${year + 1}-01-01`,
        created_by: user.id
      })
    }

    return NextResponse.json({
      success: true,
      message: `Tutup buku tahun ${year} berhasil!`,
      summary: {
        totalIncome,
        totalExpense,
        carryForward,
        billsDeleted,
        paymentsDeleted,
        transactionsDeleted,
        outstandingBills: outstandingCount,
        outstandingAmount
      }
    })
  } catch (error: any) {
    console.error('Unexpected error in yearly closing:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
