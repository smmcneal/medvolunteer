// Server-only Supabase client that uses the SERVICE ROLE key.
// Never import this in client components — it bypasses RLS.
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // Opt out of Next.js fetch caching so revalidatePath + router.refresh()
      // always returns fresh data from Supabase, not a stale cached response.
      global: {
        fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }),
      },
    }
  )
}
