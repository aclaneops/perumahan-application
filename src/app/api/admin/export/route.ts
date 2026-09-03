import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') || new Date().getMonth() + 1
  const year = searchParams.get('year') || new Date().getFullYear()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Double check admin role
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Fetch bills
  const { data: bills } = await adminClient
    .from('bills')
    .select('*')
    .eq('period_month', month)
    .eq('period_year', year)
    .order('created_at', { ascending: false })

  if (!bills) {
    return new NextResponse('No data', { status: 404 })
  }

  // Fetch profiles
  const { data: allProfiles } = await adminClient
    .from('profiles')
    .select('id, full_name, house_number')

  const profileMap: Record<string, { full_name: string, house_number: string }> = {}
  allProfiles?.forEach(p => { profileMap[p.id] = p })

  // Create CSV content
  const headers = ['Nama Warga', 'Blok / No', 'Bulan', 'Tahun', 'Status', 'Total Tagihan', 'Uang Air', 'Uang Sampah', 'Uang Keamanan', 'Kas RT']
  
  const rows = bills.map(bill => {
    const userProfile = profileMap[bill.profile_id]
    return [
      `"${userProfile?.full_name || 'Unknown'}"`,
      `"${userProfile?.house_number || '-'}"`,
      bill.period_month,
      bill.period_year,
      `"${bill.status}"`,
      bill.total_amount,
      bill.water_fee,
      bill.trash_fee,
      bill.security_fee,
      bill.treasury_fee
    ].join(',')
  })

  const csv = [headers.join(','), ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="laporan-pemasukan-${year}-${month}.csv"`
    }
  })
}
