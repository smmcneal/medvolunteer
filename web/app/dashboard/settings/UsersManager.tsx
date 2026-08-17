'use client'

import { useState, useTransition } from 'react'
import type { AdminUserRow, AdminRole } from '@/types/database'
import { inviteAdminUser, updateAdminUserRole, removeAdminUser } from './usersActions'
import { useAdminT } from '@/lib/admin-lang'

const fieldStyle: React.CSSProperties = {
  padding: '8px 10px', fontSize: '13px',
  border: '1px solid #e5e7eb', borderRadius: '7px',
  fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const,
}

const primaryBtn: React.CSSProperties = {
  padding: '8px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
  border: 'none', background: '#1B2A4A', color: 'white', cursor: 'pointer', fontFamily: 'inherit',
}

interface Props {
  initialAdminUsers: AdminUserRow[]
  currentUserId: string
  myRole: AdminRole | null
}

export default function UsersManager({ initialAdminUsers, currentUserId, myRole }: Props) {
  const t = useAdminT()
  const isOwner = myRole === 'owner'
  const [users, setUsers] = useState<AdminUserRow[]>(initialAdminUsers)

  const [showInvite, setShowInvite] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRole>('admin')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await inviteAdminUser({ email: email.trim(), first_name: firstName.trim(), last_name: lastName.trim(), role })
      if (res.error) { setError(res.error); return }
      setFirstName('')
      setLastName('')
      setEmail('')
      setRole('admin')
      setShowInvite(false)
    })
  }

  function handleRoleChange(userId: string, newRole: AdminRole) {
    setError(null)
    const prev = users
    setUsers(u => u.map(a => a.user_id === userId ? { ...a, role: newRole } : a))
    startTransition(async () => {
      const res = await updateAdminUserRole(userId, newRole)
      if (res.error) { setUsers(prev); setError(res.error) }
    })
  }

  function handleRemove(userId: string, label: string) {
    if (!confirm(`${t('remove_admin_confirm')} ${label}?`)) return
    setError(null)
    const prev = users
    setUsers(u => u.filter(a => a.user_id !== userId))
    startTransition(async () => {
      const res = await removeAdminUser(userId)
      if (res.error) { setUsers(prev); setError(res.error) }
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 4 }}>{t('users_section')}</h3>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>{t('users_desc')}</p>
        </div>
        {isOwner && (
          <button onClick={() => setShowInvite(v => !v)} style={primaryBtn}>
            {showInvite ? t('cancel') : t('invite_admin_btn')}
          </button>
        )}
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {!isOwner && (
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>{t('users_owner_only')}</p>
      )}

      {showInvite && isOwner && (
        <form onSubmit={handleInvite} style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          border: '1px solid #e5e7eb', borderRadius: 10, padding: 16,
          background: '#f9fafb', marginBottom: 20,
        }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{t('first_name_required')}</label>
            <input required value={firstName} onChange={e => setFirstName(e.target.value)} style={fieldStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{t('last_name_required')}</label>
            <input required value={lastName} onChange={e => setLastName(e.target.value)} style={fieldStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{t('email_address_required')}</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} style={fieldStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{t('role_label')}</label>
            <select value={role} onChange={e => setRole(e.target.value as AdminRole)} style={{ ...fieldStyle, background: 'white' }}>
              <option value="admin">{t('role_admin')}</option>
              <option value="owner">{t('role_owner')}</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" disabled={isPending} style={{ ...primaryBtn, opacity: isPending ? 0.7 : 1, width: '100%' }}>
              {t('send_invite_btn')}
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {users.map(u => {
          const label = (u.first_name || u.last_name) ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : u.email
          const isSelf = u.user_id === currentUserId
          return (
            <div key={u.user_id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              border: '1px solid #e5e7eb', borderRadius: 10, background: 'white',
              padding: '12px 16px',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: '#eef2ff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: '#4338ca', flexShrink: 0,
              }}>
                {label.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                  {label}{isSelf && <span style={{ color: '#9ca3af', fontWeight: 500 }}> ({t('you_label')})</span>}
                </p>
                <p style={{ fontSize: 12, color: '#6b7280' }}>{u.email}</p>
              </div>

              {isOwner && !isSelf ? (
                <select
                  value={u.role}
                  onChange={e => handleRoleChange(u.user_id, e.target.value as AdminRole)}
                  disabled={isPending}
                  style={{ ...fieldStyle, width: 'auto', background: 'white' }}
                >
                  <option value="admin">{t('role_admin')}</option>
                  <option value="owner">{t('role_owner')}</option>
                </select>
              ) : (
                <span style={{
                  padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                  background: u.role === 'owner' ? '#fef3c7' : '#f3f4f6',
                  color: u.role === 'owner' ? '#92400e' : '#6b7280',
                  flexShrink: 0,
                }}>
                  {u.role === 'owner' ? t('role_owner') : t('role_admin')}
                </span>
              )}

              {isOwner && !isSelf && (
                <button
                  onClick={() => handleRemove(u.user_id, label)}
                  disabled={isPending}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 2, display: 'flex', flexShrink: 0 }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#d1d5db')}
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
