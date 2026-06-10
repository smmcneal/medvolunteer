import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Dev-only auto-login endpoint for authenticated QA.
 * Usage:
 *   GET /api/dev/login?role=admin      → signs in as DEV_ADMIN_EMAIL
 *   GET /api/dev/login?role=volunteer  → signs in as DEV_VOLUNTEER_EMAIL
 *
 * Credentials come exclusively from env vars — never from the query string,
 * so passwords don't end up in request logs or browser history.
 * After sign-in, redirects to ?redirect (default: /)
 * Blocked entirely in production.
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role')
  const rawRedirect = searchParams.get('redirect') ?? '/'
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/'

  let email: string | null = null
  let password: string | null = null

  if (role === 'admin') {
    email = process.env.DEV_ADMIN_EMAIL ?? null
    password = process.env.DEV_ADMIN_PASSWORD ?? null
  } else if (role === 'volunteer') {
    email = process.env.DEV_VOLUNTEER_EMAIL ?? null
    password = process.env.DEV_VOLUNTEER_PASSWORD ?? null
  }

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Provide ?role=admin|volunteer (credentials come from DEV_* env vars)' },
      { status: 400 }
    )
  }

  const response = NextResponse.redirect(new URL(redirectTo, req.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  return response
}
