'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { VolunteerCategory, VolunteerStatus } from '@/types/database'

export interface CreateVolunteerInput {
  first_name: string
  last_name: string
  email: string
  phone: string
  category: VolunteerCategory
  status: VolunteerStatus
  location_ids: string[]
  send_invite: boolean
}

export async function createVolunteer(
  input: CreateVolunteerInput
): Promise<{ error?: string }> {
  // Verify the requesting user is an authenticated admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  // 1. Resolve org_id — try the admin's own volunteer row first,
  //    then fall back to the first organization in the table.
  //    (Admin accounts may not have a volunteer row themselves.)
  let org_id: string | null = null

  const { data: adminVolunteer } = await supabase
    .from('volunteers')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (adminVolunteer?.org_id) {
    org_id = adminVolunteer.org_id
  } else {
    const { data: org } = await admin
      .from('organizations')
      .select('id')
      .limit(1)
      .single()
    org_id = org?.id ?? null
  }

  if (!org_id) return { error: 'Could not determine organization' }

  // 2. Create (or invite) the Auth user
  let newUserId: string

  if (input.send_invite) {
    // Sends a magic-link email so the volunteer sets their own password
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      input.email,
      {
        data: { first_name: input.first_name, last_name: input.last_name },
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback?next=/volunteer/set-password`,
      }
    )
    if (inviteError) {
      // If user already exists in Auth, look them up
      if (inviteError.message.includes('already been registered')) {
        const { data: existingUsers } = await admin.auth.admin.listUsers()
        const existing = existingUsers?.users.find(u => u.email === input.email)
        if (!existing) return { error: 'Email already registered but user not found' }
        newUserId = existing.id
      } else {
        return { error: inviteError.message }
      }
    } else {
      newUserId = inviteData.user.id
    }
  } else {
    // Create user with a random temporary password (admin will share it)
    const tempPassword = crypto.randomUUID().replace(/-/g, '').slice(0, 16) + 'Aa1!'
    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email: input.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { first_name: input.first_name, last_name: input.last_name },
    })
    if (createError) {
      if (createError.message.includes('already been registered')) {
        const { data: existingUsers } = await admin.auth.admin.listUsers()
        const existing = existingUsers?.users.find(u => u.email === input.email)
        if (!existing) return { error: 'Email already registered but user not found' }
        newUserId = existing.id
      } else {
        return { error: createError.message }
      }
    } else {
      newUserId = createData.user.id
    }
  }

  // 3. Insert volunteer row (use admin client to bypass RLS on insert)
  const { data: volunteerInsert, error: volError } = await admin
    .from('volunteers')
    .insert({
      user_id: newUserId,
      org_id,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email,
      phone: input.phone || null,
      category: input.category,
      status: input.status,
      pipeline_phase: 'intake',
    })
    .select('id')
    .single()

  let volunteerId: string

  if (volError) {
    // If volunteer row already exists for this user, not a fatal error
    if (!volError.message.includes('duplicate') && !volError.message.includes('unique')) {
      return { error: volError.message }
    }
    // Look up existing volunteer
    const { data: existing } = await admin
      .from('volunteers')
      .select('id')
      .eq('user_id', newUserId)
      .single()
    if (!existing) return { error: 'Volunteer record could not be created' }
    volunteerId = existing.id
  } else {
    volunteerId = volunteerInsert.id
  }

  // 4. Assign locations if provided
  if (input.location_ids.length > 0) {
    await admin
      .from('volunteer_locations')
      .insert(
        input.location_ids.map(location_id => ({
          volunteer_id: volunteerId,
          location_id,
        }))
      )
  }

  revalidatePath('/dashboard/volunteers')
  return {}
}
