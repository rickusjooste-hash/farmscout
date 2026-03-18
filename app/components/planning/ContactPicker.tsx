'use client'

import { useState } from 'react'

export interface Contact {
  id: string
  name: string
  company: string | null
  role: string | null
  phone: string | null
  email: string | null
}

interface Props {
  contacts: Contact[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onContactCreated: () => void
}

export default function ContactPicker({ contacts, selectedId, onSelect, onContactCreated }: Props) {
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCompany, setNewCompany] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!newName.trim()) return
    setSaving(true)
    const res = await fetch('/api/planning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save-contact',
        data: { name: newName.trim(), company: newCompany || null, role: newRole || null, phone: newPhone || null, email: newEmail || null },
      }),
    })
    const json = await res.json()
    if (json.ok && json.id) {
      onSelect(json.id)
      onContactCreated()
      setShowNew(false)
      setNewName(''); setNewCompany(''); setNewRole(''); setNewPhone(''); setNewEmail('')
    }
    setSaving(false)
  }

  return (
    <div>
      <select
        value={selectedId || ''}
        onChange={e => onSelect(e.target.value || null)}
        style={{
          width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid #e0ddd6',
          fontSize: 12, fontFamily: 'inherit', color: '#1a2a3a', background: '#fff',
        }}
      >
        <option value="">— none —</option>
        {contacts.map(c => (
          <option key={c.id} value={c.id}>
            {c.name}{c.company ? ` (${c.company})` : ''}{c.role ? ` — ${c.role}` : ''}
          </option>
        ))}
      </select>

      {!showNew ? (
        <button onClick={() => setShowNew(true)} style={{ background: 'none', border: 'none', color: '#2176d9', fontSize: 11, fontWeight: 600, cursor: 'pointer', marginTop: 4, padding: 0 }}>
          + New contact
        </button>
      ) : (
        <div style={{ marginTop: 8, padding: 10, background: '#f9f9f6', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input placeholder="Name *" value={newName} onChange={e => setNewName(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #e0ddd6', fontSize: 12, fontFamily: 'inherit' }} />
          <input placeholder="Company" value={newCompany} onChange={e => setNewCompany(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #e0ddd6', fontSize: 12, fontFamily: 'inherit' }} />
          <input placeholder="Role (e.g. Soil Scientist)" value={newRole} onChange={e => setNewRole(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #e0ddd6', fontSize: 12, fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <input placeholder="Phone" value={newPhone} onChange={e => setNewPhone(e.target.value)}
              style={{ flex: 1, padding: '5px 8px', borderRadius: 5, border: '1px solid #e0ddd6', fontSize: 12, fontFamily: 'inherit' }} />
            <input placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
              style={{ flex: 1, padding: '5px 8px', borderRadius: 5, border: '1px solid #e0ddd6', fontSize: 12, fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} disabled={saving || !newName.trim()}
              style={{ padding: '5px 14px', background: '#2176d9', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Saving...' : 'Add Contact'}
            </button>
            <button onClick={() => setShowNew(false)}
              style={{ padding: '5px 14px', background: 'none', color: '#6a7a70', border: '1px solid #e0ddd6', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
