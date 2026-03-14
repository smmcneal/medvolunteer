'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Org Profile ──────────────────────────────────────────────────────────────

export async function updateOrgProfile(data: {
  name: string
  logo_url: string | null
}) {
  const supabase = await createClient()
  const { data: org } = await supabase.from('organizations').select('id').limit(1).single()
  if (!org) throw new Error('No organization found')
  const { error } = await supabase.from('organizations').update(data).eq('id', org.id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

export async function updateOrgSettings(settings: Record<string, unknown>) {
  const supabase = await createClient()
  const { data: org } = await supabase.from('organizations').select('id, settings').limit(1).single()
  if (!org) throw new Error('No organization found')
  const { error } = await supabase
    .from('organizations')
    .update({ settings: { ...(org.settings as Record<string, unknown> ?? {}), ...settings } })
    .eq('id', org.id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

// ─── Locations ────────────────────────────────────────────────────────────────

export async function createLocation(data: {
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  geofence_radius_meters: number
}) {
  const supabase = await createClient()
  const { data: org } = await supabase.from('organizations').select('id').limit(1).single()
  if (!org) throw new Error('No organization found')
  const { error } = await supabase.from('locations').insert({ org_id: org.id, ...data })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

export async function updateLocation(id: string, data: {
  name?: string
  address?: string | null
  lat?: number | null
  lng?: number | null
  geofence_radius_meters?: number
  is_active?: boolean
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('locations').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}

export async function deleteLocation(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('locations').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/settings')
}
