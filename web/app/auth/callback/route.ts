import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Auth Callback ─────────────────────────────────────────────────────────────
// Handles the PKCE code exchange for:
//   - Volunteer invite magic links   (type=invite)
//   - Password reset links           (type=recovery)
//   - Email confirmation links       (type=signup)
//
// Supabase Auth redirects here after verifying the token:
//   /auth/callback?code=<pkce_code>[&next=<path>]
//
// Configure in Supabase Dashboard → Auth → URL Configuration:
//   Site URL:      http://localhost:3000          (dev)
//   Redirect URLs: http://localhost:3000/auth/callback
//                  https://yourdomain.com/auth/callback

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const code  = searchParams.get('code')
  // Only allow same-origin relative paths — anything else ("//evil.com",
  // "https://…", "@host") could turn this into an open redirect.
  const rawNext = searchParams.get('next') ?? '/volunteer/home'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//')
    ? rawNext
    : '/volunteer/home'
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Supabase can return an error param directly (e.g. expired link)
  if (error) {
    const msg = errorDescription ?? error
    return NextResponse.redirect(
      `${origin}/volunteer/login?error=${encodeURIComponent(msg)}`
    )
  }

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      // Respect x-forwarded-host in reverse-proxy / SiteGround deployments,
      // but skip it on localhost — Next.js dev server sets x-forwarded-host
      // to "localhost:3000" which would produce an https://localhost:3000 URL
      // and cause SSL_ERROR_RX_RECORD_TOO_LONG in the browser.
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalhost = origin.includes('localhost')
      const base = forwardedHost && !isLocalhost
        ? `https://${forwardedHost}`
        : origin
      return NextResponse.redirect(`${base}${next}`)
    }

    return NextResponse.redirect(
      `${origin}/volunteer/login?error=${encodeURIComponent(exchangeError.message)}`
    )
  }

  // No code — redirect to login with a generic error
  return NextResponse.redirect(`${origin}/volunteer/login?error=missing_code`)
}
