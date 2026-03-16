'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import AddVolunteerModal from './AddVolunteerModal'

interface Props {
  count: number
  locations: { id: string; name: string }[]
}

export default function VolunteersHeader({ count, locations }: Props) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
      }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
            Volunteers
          </h1>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>
            {count} volunteer{count !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 16px', borderRadius: '8px',
            background: '#1B2A4A', color: 'white',
            border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600,
            fontFamily: 'inherit',
          }}
        >
          <UserPlus style={{ width: '14px', height: '14px' }} />
          Add Volunteer
        </button>
      </div>

      {showModal && (
        <AddVolunteerModal
          locations={locations}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
