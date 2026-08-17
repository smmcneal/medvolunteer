import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { User } from '@supabase/supabase-js'

/**
 * Server-side auth guards.
 *
 * Layout guards only protect page rendering — server actions are
 * independently invokable POST endpoints, so EVERY dashboard action must call
 * requireAdmin() and every volunteer action must call requireVolunteer()
 * before touching the database with the admin client.
 */

/** Resolves the current auth user, or null. */
export async function getAuthUser(): Promise<User | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * Throws unless the caller is an authenticated admin (admin_users member).
 * Returns the auth user for attribution (e.g. sender_id, approved_by).
 */
export async function requireAdmin(): Promise<User> {
  const user = await getAuthUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const { data } = await admin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) throw new Error('Admin access required')
  return user
}

/**
 * Throws unless the caller is an admin with the 'owner' role. Owners are the
 * only admins who can invite, re-role, or remove other admin users.
 * Returns the auth user for attribution (e.g. invited_by).
 */
export async function requireAdminOwner(): Promise<User> {
  const user = await getAuthUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const { data } = await admin
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) throw new Error('Admin access required')
  if (data.role !== 'owner') throw new Error('Only owners can manage dashboard users')
  return user
}

/** Like requireAdmin() but redirect-friendly: returns null instead of throwing. */
export async function getAdminUser(): Promise<User | null> {
  const user = await getAuthUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  return data ? user : null
}

/**
 * Throws unless the caller is an authenticated volunteer.
 * Returns the auth user and their volunteers row id.
 */
export async function requireVolunteer(): Promise<{ user: User; volunteerId: string }> {
  const user = await getAuthUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const { data: volunteer } = await admin
    .from('volunteers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!volunteer) throw new Error('Volunteer not found')
  return { user, volunteerId: volunteer.id as string }
}
