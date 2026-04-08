import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_noStore as noStore } from 'next/cache'
import AlertsView from './AlertsView'
import type { InternalAlert } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function AlertsPage() {
  noStore()
  const supabase = createAdminClient()
  const { data: alertsRaw } = await supabase
    .from('internal_alerts')
    .select('*, volunteer:volunteers(id, first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  const alerts: InternalAlert[] = (alertsRaw ?? []) as InternalAlert[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '28px 32px 20px',
        borderBottom: '1px solid #f0f0f0',
        background: 'white',
        flexShrink: 0,
      }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
          Alerts
        </h1>
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>Internal notifications triggered by document automation rules</p>
      </div>

      <AlertsView alerts={alerts} />
    </div>
  )
}
