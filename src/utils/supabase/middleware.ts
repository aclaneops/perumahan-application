import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Routing Auth Guard Logic
  const isLoginPage = request.nextUrl.pathname.startsWith('/login')
  const isAdminPage = request.nextUrl.pathname.startsWith('/admin')
  const isDashboardPage = request.nextUrl.pathname.startsWith('/dashboard')

  if (!user && (isAdminPage || isDashboardPage)) {
    // If not logged in and trying to access protected route, redirect to login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Helper: fetch role using service role key (bypasses RLS)
  async function getUserRole(userId: string): Promise<string | null> {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
    return profile?.role ?? null
  }

  if (user && isLoginPage) {
    // If logged in and trying to access login page, check role and redirect
    const role = await getUserRole(user.id)

    const url = request.nextUrl.clone()
    if (role === 'admin' || role === 'super_admin') {
      url.pathname = '/admin/dashboard'
    } else {
      url.pathname = '/dashboard'
    }
    return NextResponse.redirect(url)
  }

  if (user && isAdminPage) {
    // Check if user has admin rights
    const role = await getUserRole(user.id)

    if (role !== 'admin' && role !== 'super_admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
