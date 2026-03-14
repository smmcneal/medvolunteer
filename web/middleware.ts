import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Pass through assets that never need auth checks
  if (
    path.startsWith('/icons') ||
    path === '/manifest.json' ||
    path === '/sw.js' ||
    path === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not add logic between createServerClient and getUser()
  const { data: { user } } = await supabase.auth.getUser()

  // ─── Admin dashboard ────────────────────────────────────────────────────────
  if (path.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ─── Volunteer PWA ──────────────────────────────────────────────────────────
  const isVolunteerLogin = path === '/volunteer/login'
  if (path.startsWith('/volunteer') && !isVolunteerLogin && !user) {
    return NextResponse.redirect(new URL('/volunteer/login', request.url))
  }

  // ─── Redirect already-authenticated users away from login pages ─────────────
  if (user && path === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  if (user && isVolunteerLogin) {
    return NextResponse.redirect(new URL('/volunteer/home', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
