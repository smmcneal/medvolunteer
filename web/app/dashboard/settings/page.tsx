import { createClient } from '@/lib/supabase/server'
import SettingsView from './SettingsView'
import type { Organization, Location } from '@/types/database'

async function fetchData() {
  const supabase = await createClient()

  const [{ data: org }, { data: locations }] = await Promise.all([
    supabase.from('organizations').select('*').limit(1).single(),
    supabase.from('locations').select('*').order('created_at', { ascending: true }),
  ])

  return {
    org: org as Organization | null,
    locations: (locations ?? []) as Location[],
  }
}

export default async function SettingsPage() {
  const { org, locations } = await fetchData()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '28px 32px 20px',
        borderBottom: '1px solid #f0f0f0',
        background: 'white',
        flexShrink: 0,
      }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
          Settings
        </h1>
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>
          Manage your organization, locations, and integrations
        </p>
      </div>

      <SettingsView org={org} locations={locations} />
    </div>
  )
}
