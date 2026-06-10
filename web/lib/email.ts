/**
 * Shared Resend email helper.
 *
 * Unlike the old inline helpers, this one reports failures instead of
 * silently swallowing them — callers decide whether a failed send should
 * block (immediate compose) or be logged and retried (cron).
 */

export type SendResult =
  | { ok: true }
  | { ok: false; error: string; notConfigured?: boolean }

export async function sendEmail({ to, subject, body }: {
  to: string
  subject: string
  body: string
}): Promise<SendResult> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return { ok: false, error: 'RESEND_API_KEY not configured', notConfigured: true }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
        to,
        subject,
        text: body,
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText)
      return { ok: false, error: `Resend ${res.status}: ${detail}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

/**
 * Substitutes {{variable}} placeholders in message templates.
 * Unknown placeholders are left intact so typos are visible to admins.
 */
export function renderTemplate(text: string, vars: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = vars[key]
    return value != null && value !== '' ? value : match
  })
}
