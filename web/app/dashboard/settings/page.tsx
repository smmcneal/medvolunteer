import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_noStore as noStore } from 'next/cache'
import SettingsView from './SettingsView'
import TagsManager from './TagsManager'
import FlagsManager from './FlagsManager'
import type { Organization, Location, OrgTag, OrgFlag } from '@/types/database'

export const dynamic = 'force-dynamic'

async function fetchData() {
  noStore()
  const supabase = createAdminClient()

  const [{ data: org }, { data: locations }, { data: tags }, { data: flags }] = await Promise.all([
    supabase.from('organizations').select('*').limit(1).single(),
    supabase.from('locations').select('*').order('created_at', { ascending: true }),
    supabase.from('org_tags').select('*').order('name'),
    supabase.from('org_flags').select('*').order('name'),
  ])

  return {
    org: org as Organization | null,
    locations: (locations ?? []) as Location[],
    tags: (tags ?? []) as OrgTag[],
    flags: (flags ?? []) as OrgFlag[],
  }
}

export default async function SettingsPage() {
  const { org, locations, tags, flags } = await fetchData()

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
          Manage your organization, locations, integrations, tags, and flags
        </p>
      </div>

      <SettingsView org={org} locations={locations} />

      {/* Tags & Flags */}
      <div style={{ padding: '0 32px 40px' }}>
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 32, marginBottom: 32 }}>
          <TagsManager initialTags={tags} />
        </div>
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 32 }}>
          <FlagsManager initialFlags={flags} />
        </div>
      </div>
    </div>
  )
}
