import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_noStore as noStore } from 'next/cache'
import DocumentsView from './DocumentsView'
import type { OrgDocument } from '@/types/database'

export const dynamic = 'force-dynamic'

async function fetchOrgDocuments(): Promise<OrgDocument[]> {
  noStore()
  const admin = createAdminClient()
  const { data } = await admin
    .from('org_documents')
    .select('*')
    .order('is_preset', { ascending: false })
    .order('sort_order')
    .order('created_at')
  return (data ?? []) as OrgDocument[]
}

export default async function DocumentsPage() {
  const docs = await fetchOrgDocuments()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '28px 32px 20px',
        borderBottom: '1px solid #f0f0f0',
        background: 'white',
        flexShrink: 0,
      }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
          Documents
        </h1>
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>
          Volunteer repository and internal admin-only documents
        </p>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <DocumentsView initialDocs={docs} />
      </div>
    </div>
  )
}
