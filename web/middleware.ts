import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Pass through assets and public pages that never need auth checks
  if (
    path.startsWith('/icons') ||
    path === '/manifest.json' ||
    path === '/sw.js' ||
    path === '/favicon.ico' ||
    path.startsWith('/apply')
  ) {
    return NextResponse.next()
  }

  // Check for a Supabase session cookie (sb-*-auth-token)
  // Avoids importing @supabase/ssr which uses Node.js globals incompatible with Edge runtime
  const hasSession = request.cookies.getAll().some(
    c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )

  // ─── Admin dashboard ────────────────────────────────────────────────────────
  if (path.startsWith('/dashboard') && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ─── Volunteer PWA ──────────────────────────────────────────────────────────
  if (path.startsWith('/volunteer') && path !== '/volunteer/login' && !hasSession) {
    return NextResponse.redirect(new URL('/volunteer/login', request.url))
  }

  // ─── Redirect already-authenticated users away from admin login ─────────────
  if (hasSession && path === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
