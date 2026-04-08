'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import AddVolunteerModal from './AddVolunteerModal'
import type { Category } from '@/types/database'
import { useAdminT } from '@/lib/admin-lang'

interface Props {
  count: number
  locations: { id: string; name: string }[]
  categories: Category[]
}

export default function VolunteersHeader({ count, locations, categories }: Props) {
  const [showModal, setShowModal] = useState(false)
  const t = useAdminT()

  return (
    <>
      <div className="vol-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--text-primary)',
            letterSpacing: '-0.025em',
            lineHeight: 1,
          }}>
            {t('volunteers_title')}
          </h1>
          <span style={{
            fontSize: '12px',
            fontWeight: 600,
            padding: '3px 9px',
            borderRadius: '99px',
            background: 'rgba(0, 137, 123, 0.1)',
            color: 'var(--teal)',
            border: '1px solid rgba(0, 137, 123, 0.18)',
            letterSpacing: '0.01em',
          }}>
            {count}
          </span>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="vol-add-btn"
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 18px', borderRadius: '9px',
            background: 'var(--navy)', color: 'white',
            border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600,
            fontFamily: 'inherit',
            letterSpacing: '-0.01em',
            boxShadow: '0 2px 8px rgba(27, 42, 74, 0.2)',
          }}
        >
          <UserPlus style={{ width: '14px', height: '14px' }} />
          {t('add_volunteer')}
        </button>
      </div>

      {showModal && (
        <AddVolunteerModal
          locations={locations}
          categories={categories}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
