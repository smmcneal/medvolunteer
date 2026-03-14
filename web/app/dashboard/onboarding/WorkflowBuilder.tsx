'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, ChevronUp, ChevronDown,
  FileText, ShieldCheck, Users, BookOpen,
  CheckSquare, ClipboardList, Pencil, Check, X,
  ToggleLeft, ToggleRight, AlertCircle,
} from 'lucide-react'
import {
  createWorkflow, updateWorkflow, deleteWorkflow,
  createStage, updateStage, deleteStage, reorderStages,
} from './actions'
import type { WorkflowWithStages } from './page'
import type { StageType, VolunteerCategory, OnboardingStage } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_TYPES: { value: StageType; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'form_submission',   label: 'Form Submission',    icon: ClipboardList, color: '#6366f1' },
  { value: 'background_check', label: 'Background Check',   icon: ShieldCheck,   color: '#f59e0b' },
  { value: 'document_sign',    label: 'Document Sign',      icon: FileText,      color: '#3b82f6' },
  { value: 'in_person_meeting',label: 'In-Person Meeting',  icon: Users,         color: '#00897B' },
  { value: 'learning_module',  label: 'Learning Module',    icon: BookOpen,      color: '#8b5cf6' },
  { value: 'manual_approval',  label: 'Manual Approval',    icon: CheckSquare,   color: '#1B2A4A' },
]

const STAGE_TYPE_MAP = Object.fromEntries(STAGE_TYPES.map(t => [t.value, t]))

const CATEGORIES: { value: VolunteerCategory | ''; label: string }[] = [
  { value: '',                   label: 'All categories' },
  { value: 'medical_professional', label: 'Medical Professional' },
  { value: 'support_staff',      label: 'Support Staff' },
  { value: 'admin',              label: 'Admin' },
  { value: 'trainee',            label: 'Trainee' },
  { value: 'other',              label: 'Other' },
]

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  medical_professional: { bg: '#d1fae5', text: '#065f46' },
  support_staff:        { bg: '#dbeafe', text: '#1e40af' },
  admin:                { bg: '#ede9fe', text: '#5b21b6' },
  trainee:              { bg: '#fef3c7', text: '#92400e' },
  other:                { bg: '#f3f4f6', text: '#374151' },
}

const NAVY = '#1B2A4A'
const TEAL = '#00897B'

// ─── Empty stage form defaults ────────────────────────────────────────────────

interface StageForm {
  name: string
  description: string
  stage_type: StageType
  is_required: boolean
  deadline_days_after_start: string
}

const EMPTY_STAGE_FORM: StageForm = {
  name: '',
  description: '',
  stage_type: 'form_submission',
  is_required: true,
  deadline_days_after_start: '',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkflowBuilder({
  initialWorkflows,
}: {
  initialWorkflows: WorkflowWithStages[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [selectedId, setSelectedId] = useState<string | null>(
    initialWorkflows[0]?.id ?? null
  )
  const [showNewWorkflow, setShowNewWorkflow] = useState(initialWorkflows.length === 0)
  const [newWorkflowName, setNewWorkflowName] = useState('')
  const [newWorkflowCategory, setNewWorkflowCategory] = useState<VolunteerCategory | ''>('')

  // Stage editing state
  const [editingStageId, setEditingStageId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<StageForm>(EMPTY_STAGE_FORM)
  const [showAddStage, setShowAddStage] = useState(false)
  const [addForm, setAddForm] = useState<StageForm>(EMPTY_STAGE_FORM)

  // Workflow name inline edit
  const [editingWorkflowName, setEditingWorkflowName] = useState(false)
  const [workflowNameDraft, setWorkflowNameDraft] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Error state
  const [error, setError] = useState<string | null>(null)

  const selected = initialWorkflows.find(w => w.id === selectedId) ?? null

  function refresh() {
    router.refresh()
    setError(null)
  }

  async function run(fn: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  // ── Workflow actions ────────────────────────────────────────────

  function handleCreateWorkflow() {
    if (!newWorkflowName.trim()) return
    run(async () => {
      await createWorkflow({
        name: newWorkflowName.trim(),
        applies_to_category: newWorkflowCategory || null,
      })
      setNewWorkflowName('')
      setNewWorkflowCategory('')
      setShowNewWorkflow(false)
    })
  }

  function handleToggleActive(workflow: WorkflowWithStages) {
    run(() => updateWorkflow(workflow.id, { is_active: !workflow.is_active }))
  }

  function handleDeleteWorkflow(id: string) {
    if (!confirm('Delete this workflow? This cannot be undone.')) return
    run(async () => {
      await deleteWorkflow(id)
      setSelectedId(initialWorkflows.find(w => w.id !== id)?.id ?? null)
    })
  }

  function handleSaveWorkflowName() {
    if (!selected || !workflowNameDraft.trim()) return
    run(() => updateWorkflow(selected.id, { name: workflowNameDraft.trim() }))
    setEditingWorkflowName(false)
  }

  function handleCategoryChange(cat: VolunteerCategory | '') {
    if (!selected) return
    run(() => updateWorkflow(selected.id, { applies_to_category: cat || null }))
  }

  // ── Stage actions ───────────────────────────────────────────────

  function handleAddStage() {
    if (!selected || !addForm.name.trim()) return
    run(async () => {
      await createStage({
        workflow_id: selected.id,
        name: addForm.name.trim(),
        description: addForm.description.trim(),
        stage_type: addForm.stage_type,
        is_required: addForm.is_required,
        deadline_days_after_start: addForm.deadline_days_after_start
          ? parseInt(addForm.deadline_days_after_start)
          : null,
        order_index: selected.stages.length + 1,
      })
      setAddForm(EMPTY_STAGE_FORM)
      setShowAddStage(false)
    })
  }

  function handleStartEditStage(stage: OnboardingStage) {
    setEditingStageId(stage.id)
    setEditForm({
      name: stage.name,
      description: stage.description ?? '',
      stage_type: stage.stage_type,
      is_required: stage.is_required,
      deadline_days_after_start: stage.deadline_days_after_start?.toString() ?? '',
    })
    setShowAddStage(false)
  }

  function handleSaveStage(stageId: string) {
    run(async () => {
      await updateStage(stageId, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        stage_type: editForm.stage_type,
        is_required: editForm.is_required,
        deadline_days_after_start: editForm.deadline_days_after_start
          ? parseInt(editForm.deadline_days_after_start)
          : null,
      })
      setEditingStageId(null)
    })
  }

  function handleDeleteStage(stageId: string) {
    if (!confirm('Remove this stage?')) return
    run(() => deleteStage(stageId))
  }

  function handleMoveStage(stages: OnboardingStage[], index: number, dir: -1 | 1) {
    const newStages = [...stages]
    const target = index + dir
    if (target < 0 || target >= newStages.length) return
    ;[newStages[index], newStages[target]] = [newStages[target], newStages[index]]
    const reordered = newStages.map((s, i) => ({ id: s.id, order_index: i + 1 }))
    run(() => reorderStages(reordered))
  }

  // ── Shared styles ───────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px',
    border: '1px solid #e5e7eb', borderRadius: '7px',
    fontSize: '13px', color: '#374151', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
    background: 'white',
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
  }

  const btnPrimary: React.CSSProperties = {
    padding: '7px 14px', borderRadius: '7px',
    background: NAVY, color: 'white',
    border: 'none', cursor: 'pointer',
    fontSize: '13px', fontWeight: 600,
    opacity: isPending ? 0.6 : 1,
  }

  const btnSecondary: React.CSSProperties = {
    padding: '7px 14px', borderRadius: '7px',
    background: 'white', color: '#374151',
    border: '1px solid #e5e7eb', cursor: 'pointer',
    fontSize: '13px', fontWeight: 500,
  }

  // ── Render stage form (shared between add + edit) ──────────────

  function StageFormFields({
    form, setForm,
  }: {
    form: StageForm
    setForm: (f: StageForm) => void
  }) {
    const TypeIcon = STAGE_TYPE_MAP[form.stage_type]?.icon ?? ClipboardList
    const typeColor = STAGE_TYPE_MAP[form.stage_type]?.color ?? '#6b7280'

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Stage Name *
            </label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Background Check"
              autoFocus
            />
          </div>

          {/* Type */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Stage Type *
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)',
                display: 'flex', alignItems: 'center', pointerEvents: 'none',
              }}>
                <TypeIcon style={{ width: '13px', height: '13px', color: typeColor }} />
              </div>
              <select
                style={{ ...selectStyle, paddingLeft: '28px' }}
                value={form.stage_type}
                onChange={e => setForm({ ...form, stage_type: e.target.value as StageType })}
              >
                {STAGE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Description
          </label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: '56px', lineHeight: 1.5 }}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Optional description shown to coordinators"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {/* Required */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Required
            </label>
            <div
              onClick={() => setForm({ ...form, is_required: !form.is_required })}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '7px',
                cursor: 'pointer', userSelect: 'none',
                background: form.is_required ? '#f0fdf4' : 'white',
              }}
            >
              {form.is_required
                ? <ToggleRight style={{ width: '18px', height: '18px', color: '#22c55e' }} />
                : <ToggleLeft  style={{ width: '18px', height: '18px', color: '#d1d5db' }} />
              }
              <span style={{ fontSize: '13px', color: form.is_required ? '#15803d' : '#6b7280', fontWeight: 500 }}>
                {form.is_required ? 'Required' : 'Optional'}
              </span>
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Deadline (days from start)
            </label>
            <input
              style={inputStyle}
              type="number"
              min="1"
              value={form.deadline_days_after_start}
              onChange={e => setForm({ ...form, deadline_days_after_start: e.target.value })}
              placeholder="e.g. 14"
            />
          </div>
        </div>
      </div>
    )
  }

  // ── Main render ─────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

      {/* ── Left: Workflow list ──────────────────────────────────── */}
      <div style={{
        width: '280px', borderRight: '1px solid #f0f0f0',
        display: 'flex', flexDirection: 'column',
        background: '#fafafa', flexShrink: 0,
        overflowY: 'auto',
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
          <button
            onClick={() => { setShowNewWorkflow(true); setSelectedId(null) }}
            style={{
              ...btnPrimary,
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '6px', padding: '9px 14px',
            }}
          >
            <Plus style={{ width: '14px', height: '14px' }} />
            New Workflow
          </button>
        </div>

        <div style={{ flex: 1, padding: '8px' }}>
          {initialWorkflows.length === 0 && !showNewWorkflow && (
            <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '24px 8px' }}>
              No workflows yet. Create your first one.
            </p>
          )}

          {initialWorkflows.map(w => {
            const isSelected = selectedId === w.id
            const catStyle = w.applies_to_category
              ? (CATEGORY_COLORS[w.applies_to_category] ?? { bg: '#f3f4f6', text: '#374151' })
              : { bg: '#f3f4f6', text: '#6b7280' }

            return (
              <div
                key={w.id}
                onClick={() => { setSelectedId(w.id); setShowNewWorkflow(false); setShowAddStage(false); setEditingStageId(null) }}
                style={{
                  padding: '12px', borderRadius: '8px', cursor: 'pointer',
                  marginBottom: '4px',
                  background: isSelected ? NAVY : 'white',
                  border: `1px solid ${isSelected ? NAVY : '#f0f0f0'}`,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{
                    fontSize: '13px', fontWeight: 600,
                    color: isSelected ? 'white' : '#111827',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                  }}>
                    {w.name}
                  </span>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, marginLeft: '8px',
                    background: w.is_active
                      ? (isSelected ? '#86efac' : '#22c55e')
                      : (isSelected ? 'rgba(255,255,255,0.3)' : '#d1d5db'),
                  }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
                    background: isSelected ? 'rgba(255,255,255,0.15)' : catStyle.bg,
                    color: isSelected ? 'rgba(255,255,255,0.8)' : catStyle.text,
                    fontWeight: 500,
                  }}>
                    {w.applies_to_category
                      ? CATEGORIES.find(c => c.value === w.applies_to_category)?.label ?? w.applies_to_category
                      : 'All categories'
                    }
                  </span>
                  <span style={{ fontSize: '11px', color: isSelected ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>
                    {w.stages.length} stage{w.stages.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Right: Editor ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

        {/* Error banner */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 14px', borderRadius: '8px',
            background: '#fef2f2', border: '1px solid #fecaca',
            color: '#dc2626', fontSize: '13px', marginBottom: '20px',
          }}>
            <AlertCircle style={{ width: '14px', height: '14px', flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* New workflow form */}
        {showNewWorkflow && (
          <div style={{
            background: 'white', borderRadius: '12px',
            border: '1px solid #e5e7eb', padding: '24px',
            maxWidth: '560px',
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '20px' }}>
              Create New Workflow
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Workflow Name *
                </label>
                <input
                  style={inputStyle}
                  value={newWorkflowName}
                  onChange={e => setNewWorkflowName(e.target.value)}
                  placeholder="e.g. Medical Professional Onboarding"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreateWorkflow()}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Applies To Category
                </label>
                <select
                  style={selectStyle}
                  value={newWorkflowCategory}
                  onChange={e => setNewWorkflowCategory(e.target.value as VolunteerCategory | '')}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={btnPrimary} onClick={handleCreateWorkflow} disabled={!newWorkflowName.trim() || isPending}>
                Create Workflow
              </button>
              <button style={btnSecondary} onClick={() => { setShowNewWorkflow(false); setSelectedId(initialWorkflows[0]?.id ?? null) }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Workflow editor */}
        {selected && !showNewWorkflow && (
          <div style={{ maxWidth: '720px' }}>

            {/* Workflow settings bar */}
            <div style={{
              background: 'white', borderRadius: '12px',
              border: '1px solid #f0f0f0', padding: '18px 20px',
              display: 'flex', alignItems: 'center', gap: '14px',
              marginBottom: '20px', flexWrap: 'wrap',
            }}>
              {/* Name */}
              {editingWorkflowName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '200px' }}>
                  <input
                    ref={nameInputRef}
                    style={{ ...inputStyle, fontSize: '15px', fontWeight: 600 }}
                    value={workflowNameDraft}
                    onChange={e => setWorkflowNameDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveWorkflowName(); if (e.key === 'Escape') setEditingWorkflowName(false) }}
                    autoFocus
                  />
                  <button onClick={handleSaveWorkflowName} style={{ ...btnPrimary, padding: '7px 10px' }}>
                    <Check style={{ width: '14px', height: '14px' }} />
                  </button>
                  <button onClick={() => setEditingWorkflowName(false)} style={{ ...btnSecondary, padding: '7px 10px' }}>
                    <X style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              ) : (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, cursor: 'pointer' }}
                  onClick={() => { setEditingWorkflowName(true); setWorkflowNameDraft(selected.name) }}
                >
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{selected.name}</span>
                  <Pencil style={{ width: '12px', height: '12px', color: '#9ca3af' }} />
                </div>
              )}

              {/* Category */}
              <select
                style={{ ...selectStyle, width: 'auto', minWidth: '160px' }}
                value={selected.applies_to_category ?? ''}
                onChange={e => handleCategoryChange(e.target.value as VolunteerCategory | '')}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>

              {/* Active toggle */}
              <div
                onClick={() => handleToggleActive(selected)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  cursor: 'pointer', padding: '6px 10px', borderRadius: '7px',
                  border: '1px solid #e5e7eb', userSelect: 'none',
                  background: selected.is_active ? '#f0fdf4' : '#f9fafb',
                }}
              >
                {selected.is_active
                  ? <ToggleRight style={{ width: '18px', height: '18px', color: '#22c55e' }} />
                  : <ToggleLeft  style={{ width: '18px', height: '18px', color: '#d1d5db' }} />
                }
                <span style={{ fontSize: '12px', fontWeight: 500, color: selected.is_active ? '#15803d' : '#6b7280' }}>
                  {selected.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Delete workflow */}
              <button
                onClick={() => handleDeleteWorkflow(selected.id)}
                style={{
                  padding: '7px 10px', borderRadius: '7px',
                  background: 'white', border: '1px solid #fecaca',
                  cursor: 'pointer', color: '#dc2626', marginLeft: 'auto',
                }}
                title="Delete workflow"
              >
                <Trash2 style={{ width: '14px', height: '14px' }} />
              </button>
            </div>

            {/* Stages section */}
            <div style={{
              background: 'white', borderRadius: '12px',
              border: '1px solid #f0f0f0', overflow: 'hidden',
            }}>
              <div style={{
                padding: '16px 20px', borderBottom: '1px solid #f0f0f0',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Stages</span>
                  <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '8px' }}>
                    {selected.stages.length} stage{selected.stages.length !== 1 ? 's' : ''} · complete in order
                  </span>
                </div>
                {!showAddStage && (
                  <button
                    onClick={() => { setShowAddStage(true); setEditingStageId(null); setAddForm(EMPTY_STAGE_FORM) }}
                    style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px' }}
                  >
                    <Plus style={{ width: '13px', height: '13px' }} />
                    Add Stage
                  </button>
                )}
              </div>

              {/* Stage list */}
              <div>
                {selected.stages.length === 0 && !showAddStage && (
                  <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                    <ClipboardList style={{ width: '32px', height: '32px', color: '#e5e7eb', margin: '0 auto 10px' }} />
                    <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '4px' }}>No stages yet</p>
                    <p style={{ fontSize: '12px', color: '#d1d5db' }}>Add your first stage to define the onboarding steps</p>
                  </div>
                )}

                {selected.stages.map((stage, i) => {
                  const meta = STAGE_TYPE_MAP[stage.stage_type]
                  const StageIcon = meta?.icon ?? ClipboardList
                  const iconColor = meta?.color ?? '#6b7280'
                  const isEditing = editingStageId === stage.id

                  return (
                    <div key={stage.id} style={{
                      borderTop: i === 0 ? 'none' : '1px solid #f9f9f9',
                    }}>
                      {/* Stage row */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '14px 20px',
                        background: isEditing ? '#fafafa' : 'white',
                      }}>
                        {/* Order + reorder buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                          <button
                            onClick={() => handleMoveStage(selected.stages, i, -1)}
                            disabled={i === 0 || isPending}
                            style={{ background: 'none', border: 'none', cursor: i === 0 ? 'not-allowed' : 'pointer', padding: '1px', color: i === 0 ? '#e5e7eb' : '#9ca3af' }}
                          >
                            <ChevronUp style={{ width: '14px', height: '14px' }} />
                          </button>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#d1d5db', width: '16px', textAlign: 'center' }}>{i + 1}</span>
                          <button
                            onClick={() => handleMoveStage(selected.stages, i, 1)}
                            disabled={i === selected.stages.length - 1 || isPending}
                            style={{ background: 'none', border: 'none', cursor: i === selected.stages.length - 1 ? 'not-allowed' : 'pointer', padding: '1px', color: i === selected.stages.length - 1 ? '#e5e7eb' : '#9ca3af' }}
                          >
                            <ChevronDown style={{ width: '14px', height: '14px' }} />
                          </button>
                        </div>

                        {/* Type icon */}
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '9px',
                          background: `${iconColor}15`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <StageIcon style={{ width: '16px', height: '16px', color: iconColor }} />
                        </div>

                        {/* Name + meta */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '3px' }}>
                            {stage.name}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '11px', padding: '2px 7px', borderRadius: '4px',
                              background: `${iconColor}12`, color: iconColor, fontWeight: 500,
                            }}>
                              {meta?.label ?? stage.stage_type}
                            </span>
                            {stage.is_required && (
                              <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontWeight: 500 }}>
                                Required
                              </span>
                            )}
                            {stage.deadline_days_after_start && (
                              <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                                Due in {stage.deadline_days_after_start}d
                              </span>
                            )}
                            {stage.description && (
                              <span style={{ fontSize: '12px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                                {stage.description}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button
                            onClick={() => isEditing ? setEditingStageId(null) : handleStartEditStage(stage)}
                            style={{
                              padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb',
                              background: isEditing ? '#f3f4f6' : 'white', cursor: 'pointer',
                              color: '#374151', fontSize: '12px', fontWeight: 500,
                              display: 'flex', alignItems: 'center', gap: '4px',
                            }}
                          >
                            {isEditing ? <X style={{ width: '12px', height: '12px' }} /> : <Pencil style={{ width: '12px', height: '12px' }} />}
                            {isEditing ? 'Cancel' : 'Edit'}
                          </button>
                          <button
                            onClick={() => handleDeleteStage(stage.id)}
                            style={{
                              padding: '6px 8px', borderRadius: '6px',
                              border: '1px solid #fecaca', background: 'white',
                              cursor: 'pointer', color: '#dc2626',
                            }}
                          >
                            <Trash2 style={{ width: '12px', height: '12px' }} />
                          </button>
                        </div>
                      </div>

                      {/* Inline edit form */}
                      {isEditing && (
                        <div style={{
                          margin: '0 20px 16px', padding: '18px',
                          background: 'white', borderRadius: '10px',
                          border: '1px solid #e5e7eb',
                        }}>
                          <StageFormFields form={editForm} setForm={setEditForm} />
                          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                            <button
                              style={btnPrimary}
                              onClick={() => handleSaveStage(stage.id)}
                              disabled={!editForm.name.trim() || isPending}
                            >
                              Save Changes
                            </button>
                            <button style={btnSecondary} onClick={() => setEditingStageId(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Add stage form */}
                {showAddStage && (
                  <div style={{
                    borderTop: selected.stages.length > 0 ? '1px solid #f0f0f0' : 'none',
                    padding: '16px 20px',
                  }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '14px' }}>
                      New Stage
                    </p>
                    <StageFormFields form={addForm} setForm={setAddForm} />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                      <button
                        style={btnPrimary}
                        onClick={handleAddStage}
                        disabled={!addForm.name.trim() || isPending}
                      >
                        Add Stage
                      </button>
                      <button style={btnSecondary} onClick={() => setShowAddStage(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Add stage footer button */}
                {!showAddStage && selected.stages.length > 0 && (
                  <div style={{ padding: '12px 20px', borderTop: '1px solid #f9f9f9' }}>
                    <button
                      onClick={() => { setShowAddStage(true); setEditingStageId(null); setAddForm(EMPTY_STAGE_FORM) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '13px', color: TEAL, fontWeight: 500, padding: 0,
                      }}
                    >
                      <Plus style={{ width: '14px', height: '14px' }} />
                      Add another stage
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty state (no workflows at all) */}
        {!selected && !showNewWorkflow && initialWorkflows.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 32px' }}>
            <ClipboardList style={{ width: '40px', height: '40px', color: '#e5e7eb', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '16px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>No workflows yet</p>
            <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '20px' }}>
              Create your first onboarding workflow to get started
            </p>
            <button
              onClick={() => setShowNewWorkflow(true)}
              style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus style={{ width: '14px', height: '14px' }} />
              New Workflow
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
