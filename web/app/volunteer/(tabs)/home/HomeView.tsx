'use client'

import { useState, useEffect, useTransition, useContext } from 'react'
import type { Volunteer, Shift, Credential } from '@/types/database'
import { useRouter } from 'next/navigation'
import { homeClockIn, homeClockOut, homeDropShift } from './actions'
import { useT, LangContext } from '@/lib/volunteer-lang'

interface ShiftWithLocation extends Shift {
  locations: { name: string } | null
}

interface UpcomingAssignment {
  id: string
  shift: ShiftWithLocation
}

interface Props {
  volunteer: Volunteer
  upcomingAssignments: UpcomingAssignment[]
  onboardingPct: number
  onboardingCompleted: number
  onboardingTotal: number
  expiringCredentials: Pick<Credential, 'id' | 'type' | 'expiration_date'>[]
  activeEntry: { id: string; clock_in: string } | null
}

function formatShiftTime(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  volunteer: 'status_volunteer',
  prospect:  'status_prospect',
  applicant: 'status_applicant',
  inactive:  'status_inactive',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  volunteer: { bg: '#dcfce7', text: '#15803d' },
  prospect:  { bg: '#dbeafe', text: '#1e40af' },
  applicant: { bg: '#fef9c3', text: '#854d0e' },
  inactive:  { bg: '#f3f4f6', text: '#6b7280' },
}

export default function HomeView({
  volunteer,
  upcomingAssignments,
  onboardingPct,
  onboardingCompleted,
  onboardingTotal,
  expiringCredentials,
  activeEntry,
}: Props) {
  const t = useT()
  const lang = useContext(LangContext)
  const router = useRouter()
  const [dropConfirmId, setDropConfirmId] = useState<string | null>(null)
  const [droppingId, setDroppingId] = useState<string | null>(null)
  const [dropError, setDropError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleDrop(assignmentId: string) {
    setDropError(null)
    setDroppingId(assignmentId)
    setDropConfirmId(null)
    startTransition(async () => {
      try {
        await homeDropShift(assignmentId)
        router.refresh()
      } catch (e: unknown) {
        setDropError(e instanceof Error ? e.message : 'Could not drop shift')
      } finally {
        setDroppingId(null)
      }
    })
  }
  const statusColor = STATUS_COLORS[volunteer.status] ?? STATUS_COLORS.inactive
  const showOnboarding = ['applicant', 'prospect'].includes(volunteer.status) && onboardingTotal > 0

  function greeting() {
    const h = new Date().getHours()
    if (h < 12) return t('greeting_morning')
    if (h < 17) return t('greeting_afternoon')
    return t('greeting_evening')
  }

  return (
    <div style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      {/* Push permission prompt (client-only) */}
      <PushPermissionBanner volunteerId={volunteer.id} />

      {/* Header */}
      <div style={{
        background: '#1B2A4A',
        padding: '20px 20px 28px',
        paddingTop: 'calc(20px + env(safe-area-inset-top))',
      }}>
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'white', overflow: 'hidden', flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/hummingbird.png" alt="MedVolunteer" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.04em' }}>
            MedVolunteer
          </span>
        </div>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: '0 0 4px', fontWeight: 500 }}>
          {greeting()},
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <h1 style={{
            fontSize: '26px', fontWeight: 800, color: 'white',
            margin: 0, letterSpacing: '-0.5px',
          }}>
            {volunteer.first_name} {volunteer.last_name}
          </h1>
          <span style={{
            padding: '4px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 700,
            background: statusColor.bg, color: statusColor.text, flexShrink: 0,
          }}>
            {t(STATUS_LABEL_KEYS[volunteer.status] ?? 'status_inactive')}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Clock in / out */}
        <ClockCard initialEntry={activeEntry} />

        {/* Onboarding progress (only while not yet active) */}
        {showOnboarding && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <p style={cardTitleStyle}>{t('onboarding_title')}</p>
                <p style={cardSubStyle}>{onboardingCompleted} {t('onboarding_of')} {onboardingTotal} {t('onboarding_stages_complete')}</p>
              </div>
              <span style={{
                fontSize: '22px', fontWeight: 800, color: '#1B2A4A',
              }}>{onboardingPct}%</span>
            </div>
            <div style={{ height: '8px', borderRadius: '99px', background: '#f0f0f0', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${onboardingPct}%`,
                borderRadius: '99px',
                background: onboardingPct === 100 ? '#00897B' : '#1B2A4A',
                transition: 'width 0.5s ease',
              }} />
            </div>
            {onboardingPct === 100 && (
              <p style={{ fontSize: '13px', color: '#15803d', fontWeight: 600, marginTop: '10px' }}>
                {t('onboarding_waiting')}
              </p>
            )}
          </Card>
        )}

        {/* Credential expiry warnings */}
        {expiringCredentials.length > 0 && (
          <div>
            <SectionLabel>{t('expiring_creds')}</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {expiringCredentials.map(cred => {
                const days = daysUntil(cred.expiration_date!)
                const urgent = days <= 7
                const warning = days <= 14
                return (
                  <div key={cred.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 14px',
                    background: urgent ? '#fef2f2' : warning ? '#fffbeb' : 'white',
                    border: `1px solid ${urgent ? '#fecaca' : warning ? '#fde68a' : '#e5e7eb'}`,
                    borderRadius: '10px',
                  }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>
                        {cred.type}
                      </p>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>
                        {lang === 'es' ? 'Vence' : 'Expires'} {new Date(cred.expiration_date!).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <span style={{
                      fontSize: '12px', fontWeight: 700, padding: '3px 9px', borderRadius: '99px',
                      background: urgent ? '#fee2e2' : warning ? '#fef3c7' : '#f3f4f6',
                      color: urgent ? '#dc2626' : warning ? '#b45309' : '#6b7280',
                    }}>
                      {days === 0
                      ? (lang === 'es' ? 'Hoy' : 'Today')
                      : days === 1
                        ? (lang === 'es' ? '1 día' : '1 day')
                        : `${days} ${t('days')}`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Upcoming shifts */}
        <div>
          <SectionLabel>{t('upcoming_shifts')}</SectionLabel>
          {dropError && (
            <div style={{ marginBottom: '8px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', color: '#dc2626' }}>
              {dropError}
            </div>
          )}
          {upcomingAssignments.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>📅</div>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, fontWeight: 500 }}>
                  {t('no_upcoming_shifts')}
                </p>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0' }}>
                  {t('check_coordinator')}
                </p>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {upcomingAssignments.map(({ id: assignmentId, shift }, i) => {
                const isNext = i === 0
                const start = new Date(shift.start_time)
                const end = new Date(shift.end_time)
                const durationHrs = ((end.getTime() - start.getTime()) / 3600000).toFixed(1)
                const isDropping = droppingId === assignmentId
                const isConfirming = dropConfirmId === assignmentId
                return (
                  <div key={shift.id} style={{
                    background: isNext ? '#1B2A4A' : 'white',
                    border: `1px solid ${isNext ? '#1B2A4A' : '#e5e7eb'}`,
                    borderRadius: '12px',
                    padding: '16px',
                    position: 'relative',
                  }}>
                    {isNext && !isConfirming && (
                      <div style={{
                        position: 'absolute', top: '12px', right: '12px',
                        background: '#00897B', color: 'white',
                        fontSize: '10px', fontWeight: 800,
                        padding: '2px 8px', borderRadius: '99px',
                        letterSpacing: '0.06em',
                      }}>NEXT UP</div>
                    )}
                    <p style={{ fontSize: '15px', fontWeight: 700, color: isNext ? 'white' : '#111827', margin: '0 0 4px', paddingRight: isConfirming ? 0 : '64px' }}>
                      {shift.name}
                    </p>
                    <p style={{ fontSize: '13px', color: isNext ? 'rgba(255,255,255,0.7)' : '#6b7280', margin: '0 0 2px' }}>
                      📍 {shift.locations?.name ?? 'Unknown location'}
                    </p>
                    <p style={{ fontSize: '13px', color: isNext ? 'rgba(255,255,255,0.7)' : '#6b7280', margin: '0 0 10px' }}>
                      🕐 {formatShiftTime(shift.start_time, lang)} · {durationHrs}h
                    </p>

                    {/* Drop actions */}
                    {isConfirming ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleDrop(assignmentId)}
                          disabled={isDropping}
                          style={{
                            flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                            border: '1.5px solid #dc2626', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {isDropping ? 'Dropping…' : 'Yes, drop shift'}
                        </button>
                        <button
                          onClick={() => setDropConfirmId(null)}
                          style={{
                            flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                            border: '1.5px solid #e5e7eb', background: 'transparent',
                            color: isNext ? 'rgba(255,255,255,0.8)' : '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          Keep it
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDropConfirmId(assignmentId)}
                        style={{
                          padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
                          border: `1px solid ${isNext ? 'rgba(255,255,255,0.2)' : '#e5e7eb'}`,
                          background: 'transparent',
                          color: isNext ? 'rgba(255,255,255,0.6)' : '#9ca3af',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        Drop shift
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ─── Clock in / out card ──────────────────────────────────────────────────────

function ClockCard({ initialEntry }: { initialEntry: { id: string; clock_in: string } | null }) {
  const t = useT()
  const [entry, setEntry] = useState(initialEntry)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [, setTick] = useState(0)

  // Re-render every minute to update elapsed time display
  useEffect(() => {
    if (!entry) return
    const interval = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(interval)
  }, [entry])

  const isClockedIn = !!entry

  function elapsed() {
    if (!entry) return null
    const mins = Math.floor((Date.now() - new Date(entry.clock_in).getTime()) / 60000)
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  function handleClock() {
    setError(null)
    startTransition(async () => {
      try {
        if (isClockedIn) {
          await homeClockOut(entry.id)
          setEntry(null)
        } else {
          const res = await homeClockIn()
          setEntry({ id: res.entryId, clock_in: new Date().toISOString() })
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <div style={{
      background: isClockedIn ? '#1B2A4A' : 'white',
      border: `1px solid ${isClockedIn ? '#1B2A4A' : '#e5e7eb'}`,
      borderRadius: '16px',
      padding: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          {isClockedIn ? (
            <>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#00897B', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }}>
                {t('currently_clocked_in')}
              </p>
              <p style={{ fontSize: '28px', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-1px' }} suppressHydrationWarning>
                {elapsed()}
              </p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: '3px 0 0' }} suppressHydrationWarning>
                {t('clocked_in_since')} {new Date(entry!.clock_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: '0 0 2px' }}>
                {t('ready_to_start')}
              </p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                {t('tap_to_clock')}
              </p>
            </>
          )}
        </div>
        <button
          onClick={handleClock}
          disabled={pending}
          style={{
            flexShrink: 0,
            padding: '14px 22px',
            borderRadius: '12px',
            border: 'none',
            fontSize: '15px',
            fontWeight: 800,
            cursor: pending ? 'not-allowed' : 'pointer',
            background: pending ? '#94a3b8' : isClockedIn ? '#ef4444' : '#00897B',
            color: 'white',
            minWidth: '110px',
            transition: 'background 0.15s',
          }}
        >
          {pending
            ? (isClockedIn ? t('clocking_out') : t('clocking_in'))
            : isClockedIn ? t('clock_out') : t('clock_in')}
        </button>
      </div>
      {error && (
        <p style={{ fontSize: '12px', color: '#fca5a5', marginTop: '10px', marginBottom: 0 }}>{error}</p>
      )}
    </div>
  )
}

// ─── Push permission banner ────────────────────────────────────────────────────

function PushPermissionBanner({ volunteerId }: { volunteerId: string }) {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Only show if push is supported and not yet granted/denied
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      Notification.permission === 'default'
    ) {
      setShow(true)
    }
  }, [])

  if (!show || done) return null

  async function enablePush() {
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setShow(false); return }

      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set — subscription skipped')
        setDone(true)
        return
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      })

      const json = sub.toJSON()
      await fetch('/api/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          user_agent: navigator.userAgent.slice(0, 200),
        }),
      })
      setDone(true)
    } catch (err) {
      console.warn('[Push] Subscription failed:', err)
      setShow(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: '#00897B',
      padding: '12px 16px',
      margin: '0',
    }}>
      <span style={{ fontSize: '20px' }}>🔔</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: 'white', margin: 0 }}>
          Enable notifications
        </p>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', margin: '1px 0 0' }}>
          Get shift reminders and clock-in alerts
        </p>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button
          onClick={() => setShow(false)}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', padding: '5px 10px', color: 'white', fontSize: '12px', cursor: 'pointer' }}
        >Not now</button>
        <button
          onClick={enablePush}
          disabled={loading}
          style={{ background: 'white', border: 'none', borderRadius: '6px', padding: '5px 12px', color: '#00897B', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
        >{loading ? '…' : 'Enable'}</button>
      </div>
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '16px',
      border: '1px solid #e5e7eb',
    }}>{children}</div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: '12px', fontWeight: 700, color: '#6b7280',
      textTransform: 'uppercase', letterSpacing: '0.07em',
      margin: '0 0 8px 2px',
    }}>{children}</p>
  )
}

// ─── VAPID key helper ─────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}

// ─── Style atoms ───────────────────────────────────────────────────────────────

const cardTitleStyle: React.CSSProperties = {
  fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0,
}

const cardSubStyle: React.CSSProperties = {
  fontSize: '12px', color: '#6b7280', margin: '2px 0 0',
}
