'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOwner } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { AdminRole } from '@/types/database'

export async function inviteAdminUser(input: {
  email: string
  first_name: string
  last_name: string
  role: AdminRole
}): Promise<{ error?: string }> {
  if (!input.email.trim()) return { error: 'Email is required.' }
  if (!input.first_name.trim() || !input.last_name.trim()) return { error: 'First and last name are required.' }

  const owner = await requireAdminOwner()
  const admin = createAdminClient()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email: input.email.trim(),
    options: {
      data: { first_name: input.first_name.trim(), last_name: input.last_name.trim() },
      redirectTo: `${siteUrl}/auth/callback?next=/set-password`,
    },
  })

  let newUserId: string
  if (linkError) {
    if (!linkError.message.toLowerCase().includes('already registered')) return { error: linkError.message }
    // perPage must cover the full user base — the default page size is 50
    const { data: existingUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 10000 })
    const existing = existingUsers?.users.find(u => u.email === input.email.trim())
    if (!existing) return { error: 'Email already registered but user not found' }
    newUserId = existing.id
  } else {
    newUserId = linkData.user.id

    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      const inviteLink = linkData.properties.action_link
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: input.email.trim(),
          subject: `You've been invited to the admin dashboard`,
          html: `
            <p>Hi ${input.first_name.trim()},</p>
            <p>You've been invited as a${input.role === 'owner' ? 'n owner' : 'n'} admin on the dashboard. Click the link below to set your password and get started:</p>
            <p><a href="${inviteLink}">Accept invitation</a></p>
            <p>This link expires in 24 hours.</p>
          `,
        }),
      })
      if (!emailRes.ok) {
        const body = await emailRes.json().catch(() => ({}))
        return { error: `User created but invite email failed: ${body.message ?? emailRes.statusText}` }
      }
    }
  }

  const { error: upsertError } = await admin
    .from('admin_users')
    .upsert({ user_id: newUserId, role: input.role, invited_by: owner.id }, { onConflict: 'user_id' })
  if (upsertError) return { error: upsertError.message }

  revalidatePath('/dashboard/settings')
  return {}
}

export async function updateAdminUserRole(userId: string, role: AdminRole): Promise<{ error?: string }> {
  await requireAdminOwner()
  const admin = createAdminClient()

  if (role === 'admin') {
    const { count } = await admin
      .from('admin_users')
      .select('user_id', { count: 'exact', head: true })
      .eq('role', 'owner')
      .neq('user_id', userId)
    if (!count) return { error: 'Cannot remove the last owner.' }
  }

  const { error } = await admin.from('admin_users').update({ role }).eq('user_id', userId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/settings')
  return {}
}

export async function removeAdminUser(userId: string): Promise<{ error?: string }> {
  const owner = await requireAdminOwner()
  if (owner.id === userId) return { error: 'You cannot remove your own admin access.' }

  const admin = createAdminClient()
  const { data: target } = await admin.from('admin_users').select('role').eq('user_id', userId).maybeSingle()
  if (target?.role === 'owner') {
    const { count } = await admin
      .from('admin_users')
      .select('user_id', { count: 'exact', head: true })
      .eq('role', 'owner')
      .neq('user_id', userId)
    if (!count) return { error: 'Cannot remove the last owner.' }
  }

  const { error } = await admin.from('admin_users').delete().eq('user_id', userId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/settings')
  return {}
}
