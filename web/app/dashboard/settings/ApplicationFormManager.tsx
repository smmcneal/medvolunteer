'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ApplicationFormField, ApplicationFieldType, ApplicationOptionSource } from '@/types/database'
import { saveApplicationForm, restoreApplicationFormVersion } from './applicationFormActions'
import { useAdminT } from '@/lib/admin-lang'

export interface VersionSummary {
  id: string
  created_at: string
  created_by_email: string | null
  field_count: number
  restored_from: string | null
}

interface Props {
  initialFields: ApplicationFormField[]
  versions: VersionSummary[]
  orgTagNames: string[]
  categoryNames: string[]
  automationValues: string[]
  applyUrl: string
}

type EditableField = Omit<ApplicationFormField, 'sort_order'>

function blankField(): EditableField {
  return {
    id: crypto.randomUUID(),
    label: '',
    field_type: 'text',
    option_source: 'manual',
    options: [],
    required: false,
  }
}

export default function ApplicationFormManager({ initialFields, versions, orgTagNames, categoryNames, automationValues, applyUrl }: Props) {
  const t = useAdminT()
  const router = useRouter()
  const [fields, setFields] = useState<EditableField[]>(initialFields.map(f => ({
    id: f.id, label: f.label, field_type: f.field_type, option_source: f.option_source, options: f.options, required: f.required,
  })))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  function updateField(id: string, patch: Partial<EditableField>) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))
  }

  function addField() {
    setFields(prev => [...prev, blankField()])
  }

  function removeField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id))
  }

  function moveField(id: string, dir: -1 | 1) {
    setFields(prev => {
      const idx = prev.findIndex(f => f.id === id)
      const swapIdx = idx + dir
      if (idx === -1 || swapIdx < 0 || swapIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })
  }

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await saveApplicationForm(fields.map(f => ({
        id: f.id,
        label: f.label,
        field_type: f.field_type,
        option_source: f.option_source,
        options: f.options,
        required: f.required,
      })))
      if (res.error) { setError(res.error); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      router.refresh()
    })
  }

  function handleRestore(versionId: string) {
    if (!confirm(t('restore_confirm'))) return
    setError(null)
    setRestoringId(versionId)
    startTransition(async () => {
      const res = await restoreApplicationFormVersion(versionId)
      setRestoringId(null)
      if (res.error) { setError(res.error); return }
      router.refresh()
    })
  }

  function copy(text: string, which: 'link' | 'embed') {
    navigator.clipboard.writeText(text)
    setCopied(which)
    setTimeout(() => setCopied(null), 2000)
  }

  const embedSnippet = `<iframe src="${applyUrl}" style="width:100%;max-width:640px;height:900px;border:0;" title="Volunteer Application"></iframe>`

  function optionSourcePreview(source: ApplicationOptionSource): string {
    if (source === 'tags') return orgTagNames.length ? orgTagNames.join(', ') : t('no_options_available')
    if (source === 'categories') return categoryNames.length ? categoryNames.join(', ') : t('no_options_available')
    if (source === 'automations') return automationValues.length ? automationValues.join(', ') : t('no_options_available')
    return ''
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 4 }}>{t('application_form_section')}</h3>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>{t('application_form_desc')}</p>

      {/* Shareable URL */}
      <div style={{ padding: '14px 16px', borderRadius: 8, background: '#f9fafb', border: '1px solid #f0f0f0', marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>{t('shareable_url_label')}</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input readOnly value={applyUrl} style={{ flex: 1, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, color: '#374151', background: 'white' }} />
          <button onClick={() => copy(applyUrl, 'link')} style={ghostBtn}>{copied === 'link' ? t('link_copied') : t('copy_link')}</button>
        </div>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t('embed_snippet_label')}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <code style={{ flex: 1, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 11, color: '#6b7280', background: 'white', overflowX: 'auto', whiteSpace: 'nowrap' }}>{embedSnippet}</code>
          <button onClick={() => copy(embedSnippet, 'embed')} style={ghostBtn}>{copied === 'embed' ? t('link_copied') : t('copy_embed')}</button>
        </div>
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}
      {saved && <p style={{ color: '#15803d', fontSize: 13, marginBottom: 12 }}>✓ {t('save_form_success')}</p>}

      {/* Field builder */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {fields.length === 0 && (
          <p style={{ fontSize: 13, color: '#9ca3af' }}>{t('no_custom_fields_yet')}</p>
        )}
        {fields.map((f, idx) => {
          const needsOptions = f.field_type === 'dropdown' || f.field_type === 'checkbox'
          return (
            <div key={f.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 200px' }}>
                  <label style={miniLabel}>{t('field_label_field')}</label>
                  <input
                    value={f.label}
                    onChange={e => updateField(f.id, { label: e.target.value })}
                    placeholder={t('field_label_placeholder')}
                    maxLength={100}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: '1 1 130px' }}>
                  <label style={miniLabel}>{t('field_type_label')}</label>
                  <select
                    value={f.field_type}
                    onChange={e => updateField(f.id, { field_type: e.target.value as ApplicationFieldType, option_source: 'manual', options: [] })}
                    style={inputStyle}
                  >
                    <option value="text">{t('field_type_text')}</option>
                    <option value="dropdown">{t('field_type_dropdown')}</option>
                    <option value="checkbox">{t('field_type_checkbox')}</option>
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', flex: '0 0 auto', paddingBottom: 8 }}>
                  <input type="checkbox" checked={f.required} onChange={e => updateField(f.id, { required: e.target.checked })} />
                  {t('required_label')}
                </label>
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', paddingBottom: 6 }}>
                  <button type="button" disabled={idx === 0} onClick={() => moveField(f.id, -1)} style={{ ...iconBtn, opacity: idx === 0 ? 0.35 : 1 }}>↑</button>
                  <button type="button" disabled={idx === fields.length - 1} onClick={() => moveField(f.id, 1)} style={{ ...iconBtn, opacity: idx === fields.length - 1 ? 0.35 : 1 }}>↓</button>
                  <button type="button" onClick={() => removeField(f.id)} style={{ ...iconBtn, color: '#dc2626' }}>✕</button>
                </div>
              </div>

              {needsOptions && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e5e7eb' }}>
                  <label style={miniLabel}>{t('option_source_label')}</label>
                  <select
                    value={f.option_source}
                    onChange={e => updateField(f.id, { option_source: e.target.value as ApplicationOptionSource })}
                    style={{ ...inputStyle, marginBottom: 8, maxWidth: 260 }}
                  >
                    <option value="manual">{t('option_source_manual')}</option>
                    <option value="tags">{t('option_source_tags')}</option>
                    <option value="categories">{t('option_source_categories')}</option>
                    <option value="automations">{t('option_source_automations')}</option>
                  </select>

                  {f.option_source === 'manual' ? (
                    <>
                      <label style={miniLabel}>{t('manual_options_label')}</label>
                      <textarea
                        value={f.options.join('\n')}
                        onChange={e => updateField(f.id, { options: e.target.value.split('\n') })}
                        placeholder={t('manual_options_hint')}
                        rows={3}
                        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                      />
                    </>
                  ) : (
                    <p style={{ fontSize: 12, color: '#9ca3af' }}>{t('auto_populated_from')}: {optionSourcePreview(f.option_source)}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <button type="button" onClick={addField} style={ghostBtn}>{t('add_field_btn')}</button>
        <button type="button" onClick={handleSave} disabled={isPending} style={{ ...primaryBtn, opacity: isPending ? 0.7 : 1 }}>
          {isPending ? t('saving') : t('save_form_btn')}
        </button>
      </div>

      {/* Version history */}
      <div>
        <button type="button" onClick={() => setShowHistory(v => !v)} style={{ ...ghostBtn, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span>{showHistory ? '▾' : '▸'}</span>
          {t('version_history_section')} ({versions.length})
        </button>
        {showHistory && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {versions.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af' }}>{t('no_versions_yet')}</p>}
            {versions.map((v, i) => (
              <div key={v.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '10px 14px', borderRadius: 8, background: '#f9fafb', border: '1px solid #f0f0f0',
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                    {new Date(v.created_at).toLocaleString()}
                    {i === 0 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#15803d' }}>{t('current_version_badge')}</span>}
                  </p>
                  <p style={{ fontSize: 12, color: '#6b7280' }}>
                    {v.field_count} {t('fields_count_label')} · {v.created_by_email ?? t('created_by_unknown')}
                    {v.restored_from && ` · ${t('version_restored_from')}`}
                  </p>
                </div>
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => handleRestore(v.id)}
                    disabled={isPending && restoringId === v.id}
                    style={ghostBtn}
                  >
                    {isPending && restoringId === v.id ? t('restoring') : t('restore_btn')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7,
  fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit',
}

const miniLabel: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4,
}

const ghostBtn: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600,
  border: '1px solid #e5e7eb', background: 'white', color: '#374151',
  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
}

const primaryBtn: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
  border: 'none', background: '#1B2A4A', color: 'white', cursor: 'pointer', fontFamily: 'inherit',
}

const iconBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6, border: '1px solid #e5e7eb', background: 'white',
  color: '#6b7280', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
}
