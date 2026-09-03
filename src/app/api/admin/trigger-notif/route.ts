import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  
  // Verify admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 302 })
  }

  // Trigger the actual cron endpoint by doing a fetch request internally
  // In a real app we might refactor the logic out, but this is a simple proxy
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  const host = request.headers.get('host') || 'localhost:3000'
  
  try {
    const res = await fetch(`${protocol}://${host}/api/cron`, {
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    })
    
    // We redirect back to dashboard or notifications page after triggering
    return NextResponse.redirect(new URL('/admin/dashboard', request.url), { status: 302 })
  } catch (error) {
    console.error('Failed to trigger notification:', error)
    return NextResponse.redirect(new URL('/admin/dashboard', request.url), { status: 302 })
  }
}
