'use client'

import { useState, useTransition, useRef } from 'react'
import type { ModuleWithLessons, LessonWithQuiz, QuizQuestionRow } from './page'
import { useAdminT } from '@/lib/admin-lang'
import {
  createModule, updateModule, deleteModule,
  createLesson, updateLesson, deleteLesson, reorderLessons,
  createQuizQuestion, updateQuizQuestion, deleteQuizQuestion,
} from './actions'

const CATEGORY_LABELS: Record<string, string> = {
  medical_professional: 'Medical',
  support_staff: 'Support',
  admin: 'Admin',
  trainee: 'Trainee',
  other: 'Other',
}
const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS)

const LESSON_TYPE_COLORS: Record<string, string> = {
  video: '#8b5cf6',
  text: '#0ea5e9',
  quiz: '#f59e0b',
}
const LESSON_TYPE_ICONS: Record<string, string> = {
  video: '▶',
  text: '📄',
  quiz: '❓',
}

function pluralize(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

interface Props {
  initialModules: ModuleWithLessons[]
  totalVolunteers: number
}

export default function LearningView({ initialModules, totalVolunteers }: Props) {
  const t = useAdminT()
  const [modules, setModules] = useState(initialModules)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(
    initialModules[0]?.id ?? null
  )
  const [activeTab, setActiveTab] = useState<'lessons' | 'completions'>('lessons')
  const [showNewModule, setShowNewModule] = useState(false)
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedModule = modules.find(m => m.id === selectedModuleId) ?? null
  const selectedLesson = selectedModule?.lessons.find(l => l.id === selectedLessonId) ?? null

  function run(fn: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  // ─── New Module Form ───────────────────────────────────────────────────────

  function NewModuleForm() {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [isRequired, setIsRequired] = useState(false)
    const [categories, setCategories] = useState<string[]>([])

    function toggleCat(cat: string) {
      setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
    }

    return (
      <div style={{
        padding: '16px',
        background: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        margin: '12px 16px',
      }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('new_module')}
        </p>
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Module title"
          style={fieldStyle}
          onKeyDown={e => {
            if (e.key === 'Escape') setShowNewModule(false)
          }}
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          style={{ ...fieldStyle, resize: 'vertical', marginTop: '6px' }}
        />
        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {ALL_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => toggleCat(cat)}
              style={{
                padding: '3px 8px',
                borderRadius: '99px',
                fontSize: '11px',
                fontWeight: 500,
                border: '1px solid',
                cursor: 'pointer',
                background: categories.includes(cat) ? '#1B2A4A' : 'white',
                borderColor: categories.includes(cat) ? '#1B2A4A' : '#d1d5db',
                color: categories.includes(cat) ? 'white' : '#6b7280',
              }}
            >{CATEGORY_LABELS[cat]}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
          <input type="checkbox" id="req" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} style={{ cursor: 'pointer' }} />
          <label htmlFor="req" style={{ fontSize: '12px', color: '#374151', cursor: 'pointer' }}>Required for onboarding</label>
        </div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
          <button
            onClick={() => {
              if (!title.trim()) return
              run(() => createModule({ title: title.trim(), description: description.trim(), is_required: isRequired, required_for_categories: categories }))
              setShowNewModule(false)
            }}
            disabled={!title.trim() || isPending}
            style={primaryBtnSmall}
          >{t('save_module')}</button>
          <button onClick={() => setShowNewModule(false)} style={ghostBtnSmall}>{t('cancel')}</button>
        </div>
      </div>
    )
  }

  // ─── Add/Edit Lesson Form ──────────────────────────────────────────────────

  function LessonForm({ lesson, moduleId, onClose }: {
    lesson?: LessonWithQuiz
    moduleId: string
    onClose: () => void
  }) {
    const [title, setTitle] = useState(lesson?.title ?? '')
    const [type, setType] = useState<'video' | 'text' | 'quiz'>(lesson?.type ?? 'video')
    const [contentUrl, setContentUrl] = useState(lesson?.content_url ?? '')
    const [duration, setDuration] = useState(lesson?.duration_minutes?.toString() ?? '')

    const isEdit = !!lesson

    return (
      <div style={{
        padding: '14px',
        background: '#f9fafb',
        borderRadius: '8px',
        border: '1px dashed #d1d5db',
        marginTop: '8px',
      }}>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
          {isEdit ? t('edit') : t('add_lesson')}
        </p>
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Lesson title"
          style={fieldStyle}
        />
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
          {(['video', 'text', 'quiz'] as const).map(lt => (
            <button
              key={lt}
              onClick={() => setType(lt)}
              style={{
                flex: 1,
                padding: '5px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                border: '1px solid',
                cursor: 'pointer',
                background: type === lt ? LESSON_TYPE_COLORS[lt] : 'white',
                borderColor: type === lt ? LESSON_TYPE_COLORS[lt] : '#d1d5db',
                color: type === lt ? 'white' : '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >{LESSON_TYPE_ICONS[lt]} {lt}</button>
          ))}
        </div>
        {type !== 'quiz' && (
          <input
            value={contentUrl}
            onChange={e => setContentUrl(e.target.value)}
            placeholder={type === 'video' ? 'Video URL (YouTube, Vimeo, etc.)' : 'Content URL or leave blank for text'}
            style={{ ...fieldStyle, marginTop: '6px' }}
          />
        )}
        <input
          value={duration}
          onChange={e => setDuration(e.target.value.replace(/\D/g, ''))}
          placeholder="Duration (minutes, optional)"
          style={{ ...fieldStyle, marginTop: '6px' }}
        />
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
          <button
            onClick={() => {
              if (!title.trim()) return
              const payload = {
                title: title.trim(),
                type,
                content_url: contentUrl.trim() || null,
                duration_minutes: duration ? parseInt(duration) : null,
              }
              if (isEdit) {
                run(() => updateLesson(lesson.id, payload))
              } else {
                run(() => createLesson({ module_id: moduleId, ...payload }))
              }
              onClose()
            }}
            disabled={!title.trim() || isPending}
            style={primaryBtnSmall}
          >{isEdit ? t('save') : t('add_lesson')}</button>
          <button onClick={onClose} style={ghostBtnSmall}>{t('cancel')}</button>
        </div>
      </div>
    )
  }

  // ─── Quiz Question Form ────────────────────────────────────────────────────

  function QuizQuestionForm({ lessonId, q, onClose }: {
    lessonId: string
    q?: QuizQuestionRow
    onClose: () => void
  }) {
    const [question, setQuestion] = useState(q?.question ?? '')
    const [options, setOptions] = useState<string[]>(q?.options ?? ['', '', '', ''])
    const [correctIdx, setCorrectIdx] = useState(q?.correct_answer_index ?? 0)
    const isEdit = !!q

    function setOption(i: number, val: string) {
      setOptions(prev => prev.map((o, idx) => idx === i ? val : o))
    }

    return (
      <div style={{
        padding: '12px',
        background: '#fffbeb',
        borderRadius: '6px',
        border: '1px solid #fde68a',
        marginTop: '8px',
      }}>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          {isEdit ? 'Edit Question' : 'Add Question'}
        </p>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Question text"
          rows={2}
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
        <p style={{ fontSize: '11px', color: '#6b7280', margin: '8px 0 4px', fontWeight: 500 }}>Answer options (click radio to mark correct)</p>
        {options.map((opt, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <input
              type="radio"
              name="correct"
              checked={correctIdx === i}
              onChange={() => setCorrectIdx(i)}
              style={{ cursor: 'pointer', accentColor: '#00897B' }}
            />
            <input
              value={opt}
              onChange={e => setOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              style={{ ...fieldStyle, flex: 1, marginBottom: 0 }}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          <button
            onClick={() => {
              if (!question.trim()) return
              const payload = { question: question.trim(), options: options.map(o => o.trim()), correct_answer_index: correctIdx }
              if (isEdit) {
                run(() => updateQuizQuestion(q.id, payload))
              } else {
                run(() => createQuizQuestion({ lesson_id: lessonId, ...payload }))
              }
              onClose()
            }}
            disabled={!question.trim() || isPending}
            style={{ ...primaryBtnSmall, background: '#f59e0b', borderColor: '#f59e0b' }}
          >{isEdit ? t('save') : t('add_lesson')}</button>
          <button onClick={onClose} style={ghostBtnSmall}>{t('cancel')}</button>
        </div>
      </div>
    )
  }

  // ─── Module Editor Panel ───────────────────────────────────────────────────

  function ModuleEditor({ mod }: { mod: ModuleWithLessons }) {
    const [editingName, setEditingName] = useState(false)
    const [nameVal, setNameVal] = useState(mod.title)
    const [showAddLesson, setShowAddLesson] = useState(false)
    const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
    const [showAddQuestion, setShowAddQuestion] = useState(false)
    const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)

    const sl = mod.lessons.find(l => l.id === selectedLessonId) ?? null
    const completionPct = totalVolunteers > 0
      ? Math.round((mod.completion_count / totalVolunteers) * 100)
      : 0

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Module top bar */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'white',
          flexShrink: 0,
        }}>
          {editingName ? (
            <input
              autoFocus
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={() => {
                if (nameVal.trim() && nameVal !== mod.title) {
                  run(() => updateModule(mod.id, { title: nameVal.trim() }))
                }
                setEditingName(false)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (nameVal.trim() && nameVal !== mod.title) {
                    run(() => updateModule(mod.id, { title: nameVal.trim() }))
                  }
                  setEditingName(false)
                }
                if (e.key === 'Escape') {
                  setNameVal(mod.title)
                  setEditingName(false)
                }
              }}
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#111827',
                border: 'none',
                borderBottom: '2px solid #00897B',
                outline: 'none',
                background: 'transparent',
                flex: 1,
              }}
            />
          ) : (
            <h2
              onClick={() => setEditingName(true)}
              title="Click to rename"
              style={{ fontSize: '16px', fontWeight: 700, color: '#111827', cursor: 'pointer', flex: 1 }}
            >
              {mod.title}
            </h2>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={mod.is_required}
              onChange={e => run(() => updateModule(mod.id, { is_required: e.target.checked }))}
              disabled={isPending}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ ...badgeStyle, background: mod.is_required ? '#dbeafe' : '#f3f4f6', color: mod.is_required ? '#1e40af' : '#6b7280' }}>Required</span>
          </label>
          <button
            onClick={() => {
              if (!confirm(`Delete module "${mod.title}"? All lessons will be removed.`)) return
              run(() => deleteModule(mod.id))
              setSelectedModuleId(modules.find(m => m.id !== mod.id)?.id ?? null)
            }}
            style={{ ...ghostBtnSmall, color: '#dc2626', borderColor: '#fca5a5' }}
          >Delete</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', background: 'white', flexShrink: 0 }}>
          {(['lessons', 'completions'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #1B2A4A' : '2px solid transparent',
                cursor: 'pointer',
                background: 'transparent',
                color: activeTab === tab ? '#1B2A4A' : '#9ca3af',
                textTransform: 'capitalize',
              }}
            >{tab === 'lessons' ? t('lessons') : t('completions')}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {activeTab === 'lessons' && (
            <div>
              {mod.lessons.length === 0 && !showAddLesson && (
                <div style={{
                  textAlign: 'center', padding: '40px 20px',
                  color: '#9ca3af', fontSize: '13px',
                  border: '2px dashed #e5e7eb', borderRadius: '8px',
                }}>
                  {t('no_modules')}
                </div>
              )}
              {mod.lessons.map((lesson, idx) => (
                <div key={lesson.id} style={{
                  border: '1px solid',
                  borderColor: selectedLessonId === lesson.id ? '#1B2A4A' : '#e5e7eb',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  overflow: 'hidden',
                  background: 'white',
                }}>
                  {/* Lesson header */}
                  <div
                    onClick={() => setSelectedLessonId(prev => prev === lesson.id ? null : lesson.id)}
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      background: selectedLessonId === lesson.id ? '#f0f4ff' : 'transparent',
                    }}
                  >
                    <span style={{
                      width: '28px', height: '28px',
                      borderRadius: '6px',
                      background: LESSON_TYPE_COLORS[lesson.type] + '20',
                      color: LESSON_TYPE_COLORS[lesson.type],
                      fontSize: '12px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>{LESSON_TYPE_ICONS[lesson.type]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '1px' }}>{lesson.title}</p>
                      <p style={{ fontSize: '11px', color: '#9ca3af' }}>
                        {lesson.type.charAt(0).toUpperCase() + lesson.type.slice(1)}
                        {lesson.duration_minutes ? ` · ${lesson.duration_minutes}m` : ''}
                        {' · '}{pluralize(lesson.completion_count, 'completion')}
                        {lesson.type === 'quiz' ? ` · ${pluralize(lesson.quiz_questions.length, 'question')}` : ''}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={e => { e.stopPropagation(); setEditingLessonId(lesson.id) }}
                        style={{ ...ghostBtnSmall, padding: '3px 8px', fontSize: '11px' }}
                      >Edit</button>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          if (!confirm(`Delete "${lesson.title}"?`)) return
                          if (selectedLessonId === lesson.id) setSelectedLessonId(null)
                          run(() => deleteLesson(lesson.id))
                        }}
                        style={{ ...ghostBtnSmall, padding: '3px 8px', fontSize: '11px', color: '#dc2626', borderColor: '#fca5a5' }}
                      >✕</button>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          if (idx === 0) return
                          const ids = mod.lessons.map(l => l.id)
                          const swapped = [...ids]
                          ;[swapped[idx - 1], swapped[idx]] = [swapped[idx], swapped[idx - 1]]
                          run(() => reorderLessons(swapped))
                        }}
                        disabled={idx === 0}
                        style={{ ...ghostBtnSmall, padding: '3px 6px', fontSize: '11px', opacity: idx === 0 ? 0.3 : 1 }}
                      >↑</button>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          if (idx === mod.lessons.length - 1) return
                          const ids = mod.lessons.map(l => l.id)
                          const swapped = [...ids]
                          ;[swapped[idx + 1], swapped[idx]] = [swapped[idx], swapped[idx + 1]]
                          run(() => reorderLessons(swapped))
                        }}
                        disabled={idx === mod.lessons.length - 1}
                        style={{ ...ghostBtnSmall, padding: '3px 6px', fontSize: '11px', opacity: idx === mod.lessons.length - 1 ? 0.3 : 1 }}
                      >↓</button>
                    </div>
                  </div>

                  {/* Edit lesson form */}
                  {editingLessonId === lesson.id && (
                    <div style={{ padding: '0 12px 12px' }}>
                      <LessonForm
                        lesson={lesson}
                        moduleId={mod.id}
                        onClose={() => setEditingLessonId(null)}
                      />
                    </div>
                  )}

                  {/* Quiz builder (expanded when lesson selected and type=quiz) */}
                  {selectedLessonId === lesson.id && lesson.type === 'quiz' && (
                    <div style={{ borderTop: '1px solid #f0f0f0', padding: '12px 16px', background: '#fffbeb' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#92400e' }}>
                          Quiz Questions ({lesson.quiz_questions.length})
                        </p>
                        <button
                          onClick={() => setShowAddQuestion(true)}
                          style={{ ...primaryBtnSmall, background: '#f59e0b', borderColor: '#f59e0b', fontSize: '11px', padding: '4px 10px' }}
                        >+ {t('add_lesson')}</button>
                      </div>
                      {lesson.quiz_questions.map((q, qi) => (
                        <div key={q.id} style={{
                          background: 'white',
                          border: '1px solid #fde68a',
                          borderRadius: '6px',
                          padding: '10px 12px',
                          marginBottom: '6px',
                        }}>
                          {editingQuestionId === q.id ? (
                            <QuizQuestionForm
                              lessonId={lesson.id}
                              q={q}
                              onClose={() => setEditingQuestionId(null)}
                            />
                          ) : (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>
                                  Q{qi + 1}. {q.question}
                                </p>
                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                  <button
                                    onClick={() => setEditingQuestionId(q.id)}
                                    style={{ ...ghostBtnSmall, padding: '2px 7px', fontSize: '11px' }}
                                  >Edit</button>
                                  <button
                                    onClick={() => {
                                      if (!confirm('Delete this question?')) return
                                      run(() => deleteQuizQuestion(q.id))
                                    }}
                                    style={{ ...ghostBtnSmall, padding: '2px 7px', fontSize: '11px', color: '#dc2626', borderColor: '#fca5a5' }}
                                  >✕</button>
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                                {q.options.map((opt, oi) => (
                                  <span key={oi} style={{
                                    padding: '2px 8px',
                                    borderRadius: '99px',
                                    fontSize: '11px',
                                    background: oi === q.correct_answer_index ? '#d1fae5' : '#f3f4f6',
                                    color: oi === q.correct_answer_index ? '#065f46' : '#374151',
                                    fontWeight: oi === q.correct_answer_index ? 600 : 400,
                                    border: oi === q.correct_answer_index ? '1px solid #a7f3d0' : '1px solid transparent',
                                  }}>
                                    {oi === q.correct_answer_index && '✓ '}{opt}
                                  </span>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      {showAddQuestion && (
                        <QuizQuestionForm
                          lessonId={lesson.id}
                          onClose={() => setShowAddQuestion(false)}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}

              {showAddLesson && (
                <LessonForm moduleId={mod.id} onClose={() => setShowAddLesson(false)} />
              )}
              {!showAddLesson && (
                <button
                  onClick={() => setShowAddLesson(true)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px dashed #d1d5db',
                    borderRadius: '8px',
                    background: 'transparent',
                    color: '#6b7280',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    marginTop: '4px',
                  }}
                >+ {t('add_lesson')}</button>
              )}
            </div>
          )}

          {activeTab === 'completions' && (
            <div>
              {/* Progress card */}
              <div style={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                padding: '20px',
                marginBottom: '16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                  <div>
                    <p style={{ fontSize: '28px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{completionPct}%</p>
                    <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                      {mod.completion_count} of {totalVolunteers} active volunteers completed all lessons
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>{mod.lessons.length} lessons</p>
                    <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                      {mod.required_for_categories?.length
                        ? mod.required_for_categories.map(c => CATEGORY_LABELS[c]).join(', ')
                        : 'All categories'}
                    </p>
                  </div>
                </div>
                <div style={{ height: '8px', borderRadius: '99px', background: '#f0f0f0', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${completionPct}%`,
                    borderRadius: '99px',
                    background: completionPct === 100 ? '#00897B' : '#1B2A4A',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>

              {/* Per-lesson completion */}
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Per Lesson
              </p>
              {mod.lessons.length === 0 && (
                <p style={{ fontSize: '13px', color: '#9ca3af' }}>No lessons added yet.</p>
              )}
              {mod.lessons.map(lesson => {
                const pct = totalVolunteers > 0 ? Math.round((lesson.completion_count / totalVolunteers) * 100) : 0
                return (
                  <div key={lesson.id} style={{
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}>
                    <span style={{
                      width: '26px', height: '26px',
                      borderRadius: '6px',
                      background: LESSON_TYPE_COLORS[lesson.type] + '20',
                      color: LESSON_TYPE_COLORS[lesson.type],
                      fontSize: '12px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>{LESSON_TYPE_ICONS[lesson.type]}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>{lesson.title}</p>
                      <div style={{ height: '4px', borderRadius: '99px', background: '#f0f0f0', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${pct}%`,
                          borderRadius: '99px',
                          background: LESSON_TYPE_COLORS[lesson.type],
                        }} />
                      </div>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151', flexShrink: 0, minWidth: '50px', textAlign: 'right' }}>
                      {lesson.completion_count}/{totalVolunteers}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left panel — module list */}
      <div style={{
        width: '260px',
        flexShrink: 0,
        borderRight: '1px solid #f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        background: '#fafafa',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 16px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {modules.length} {modules.length === 1 ? 'Module' : 'Modules'}
          </span>
          <button
            onClick={() => setShowNewModule(prev => !prev)}
            style={{
              fontSize: '18px',
              lineHeight: 1,
              color: '#1B2A4A',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              padding: '0 4px',
            }}
          >+</button>
        </div>

        {showNewModule && <NewModuleForm />}

        <div style={{ overflow: 'auto', flex: 1 }}>
          {modules.length === 0 && !showNewModule && (
            <p style={{ padding: '20px 16px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>
              {t('no_modules')}
            </p>
          )}
          {modules.map(mod => {
            const pct = totalVolunteers > 0 ? Math.round((mod.completion_count / totalVolunteers) * 100) : 0
            const isSelected = selectedModuleId === mod.id
            return (
              <div
                key={mod.id}
                onClick={() => { setSelectedModuleId(mod.id); setSelectedLessonId(null) }}
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  background: isSelected ? '#e8edf5' : 'transparent',
                  borderLeft: isSelected ? '3px solid #1B2A4A' : '3px solid transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <p style={{
                    fontSize: '13px',
                    fontWeight: isSelected ? 600 : 500,
                    color: isSelected ? '#1B2A4A' : '#374151',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}>{mod.title}</p>
                  {mod.is_required && (
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#1e40af', background: '#dbeafe', padding: '1px 5px', borderRadius: '99px', flexShrink: 0 }}>REQ</span>
                  )}
                </div>
                <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                  {pluralize(mod.lessons.length, 'lesson')} · {pct}% complete
                </p>
                {/* Tiny progress bar */}
                <div style={{ height: '2px', borderRadius: '99px', background: '#e5e7eb', marginTop: '5px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#00897B', borderRadius: '99px' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {error && (
          <div style={{
            margin: '12px 24px 0',
            padding: '10px 14px',
            background: '#fef2f2',
            borderRadius: '8px',
            border: '1px solid #fecaca',
            fontSize: '13px',
            color: '#dc2626',
          }}>{error}</div>
        )}

        {selectedModule ? (
          <ModuleEditor mod={selectedModule} />
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            fontSize: '14px',
            flexDirection: 'column',
            gap: '8px',
          }}>
            <span style={{ fontSize: '40px' }}>📚</span>
            <p style={{ fontWeight: 500 }}>{modules.length === 0 ? 'Create your first module' : 'Select a module to edit'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Shared style atoms ────────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
  color: '#111827',
  background: 'white',
  marginBottom: 0,
}

const primaryBtnSmall: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 600,
  border: '1px solid #1B2A4A',
  cursor: 'pointer',
  background: '#1B2A4A',
  color: 'white',
}

const ghostBtnSmall: React.CSSProperties = {
  padding: '5px 10px',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 500,
  border: '1px solid #e5e7eb',
  cursor: 'pointer',
  background: 'white',
  color: '#374151',
}

const badgeStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: '99px',
  fontSize: '11px',
  fontWeight: 600,
}
