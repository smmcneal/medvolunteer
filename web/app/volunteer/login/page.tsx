import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VolunteerLoginForm from './VolunteerLoginForm'

// ─── Server wrapper ────────────────────────────────────────────────────────────
// Checks auth + volunteer record server-side before rendering the form.
// This avoids the redirect loop that occurred when the middleware tried to
// bounce authenticated users from /volunteer/login.

export default async function VolunteerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // If they have a volunteer record, send them straight to the app
    const { data: volunteer } = await supabase
      .from('volunteers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (volunteer) redirect('/volunteer/home')
    // Authenticated but not a volunteer (admin) — fall through and show the
    // login form so they can sign in with their volunteer credentials instead.
  }

  const params = await searchParams
  return <VolunteerLoginForm errorParam={params.error} />
}
