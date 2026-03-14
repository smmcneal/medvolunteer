import { createClient } from '@/lib/supabase/server'
import WorkflowBuilder from './WorkflowBuilder'
import type { OnboardingWorkflow, OnboardingStage } from '@/types/database'

export interface WorkflowWithStages extends OnboardingWorkflow {
  stages: OnboardingStage[]
}

async function fetchWorkflows(): Promise<WorkflowWithStages[]> {
  const supabase = await createClient()

  const { data: workflows } = await supabase
    .from('onboarding_workflows')
    .select('*')
    .order('created_at', { ascending: true })

  if (!workflows?.length) return []

  const { data: stages } = await supabase
    .from('onboarding_stages')
    .select('*')
    .in('workflow_id', workflows.map(w => w.id))
    .order('order_index', { ascending: true })

  return workflows.map(w => ({
    ...w,
    stages: (stages ?? []).filter(s => s.workflow_id === w.id),
  }))
}

export default async function OnboardingPage() {
  const workflows = await fetchWorkflows()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '28px 32px 20px',
        borderBottom: '1px solid #f0f0f0',
        background: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
            Onboarding Workflows
          </h1>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>
            Define stages volunteers must complete before becoming active
          </p>
        </div>
      </div>

      {/* Builder */}
      <WorkflowBuilder initialWorkflows={workflows} />
    </div>
  )
}
