import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const adminClient = createAdminClient()
  
  // Verify admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url), { status: 302 })

  const formData = await request.formData()
  const action = formData.get('action') as string

  if (action === 'create') {
    const type = formData.get('type') as string
    const category = formData.get('category') as string
    const amount = Number(formData.get('amount'))
    const date = formData.get('date') as string
    const description = formData.get('description') as string

    if (!type || !category || !amount || !date) {
      return NextResponse.redirect(
        new URL('/admin/keuangan?error=Semua kolom wajib diisi', request.url),
        { status: 302 }
      )
    }

    const { error } = await adminClient.from('transactions').insert({
      type,
      category,
      amount,
      date,
      description,
      created_by: user.id
    })

    if (error) {
      console.error('Failed to create transaction:', error)
      return NextResponse.redirect(
        new URL(`/admin/keuangan?error=${encodeURIComponent(error.message)}`, request.url),
        { status: 302 }
      )
    }

    return NextResponse.redirect(new URL('/admin/keuangan?success=1', request.url), { status: 302 })
  }

  if (action === 'delete') {
    const id = formData.get('id') as string
    if (!id) {
      return NextResponse.redirect(
        new URL('/admin/keuangan?error=ID transaksi tidak ditemukan', request.url),
        { status: 302 }
      )
    }

    const { error } = await adminClient.from('transactions').delete().eq('id', id)

    if (error) {
      console.error('Failed to delete transaction:', error)
      return NextResponse.redirect(
        new URL(`/admin/keuangan?error=${encodeURIComponent(error.message)}`, request.url),
        { status: 302 }
      )
    }

    return NextResponse.redirect(new URL('/admin/keuangan?success=1', request.url), { status: 302 })
  }

  return NextResponse.redirect(new URL('/admin/dashboard', request.url), { status: 302 })
}
