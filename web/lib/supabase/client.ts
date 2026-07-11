import { createBrowserClient } from '@supabase/ssr'

// NEXT_PUBLIC_* vars are inlined at build time. If they're missing from the
// build environment (e.g. not set in the Vercel project for the Production
// target), they are `undefined` here and createBrowserClient throws — which,
// if uncaught, leaves the caller's loading state stuck forever.
//
// Fail fast with an actionable message instead of the opaque
// "@supabase/ssr: Your project's URL and API key are required" error.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    const missing = [
      !url && 'NEXT_PUBLIC_SUPABASE_URL',
      !anonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]
      .filter(Boolean)
      .join(', ')

    throw new Error(
      `Supabase is not configured: ${missing} missing from this build. ` +
        `Set it in the Vercel project (Settings → Environment Variables, ` +
        `Production scope) and redeploy.`
    )
  }

  return createBrowserClient(url, anonKey)
}
