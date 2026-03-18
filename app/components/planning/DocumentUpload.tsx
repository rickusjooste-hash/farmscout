'use client'

import { useState } from 'react'

interface Doc {
  id: string
  file_name: string
  file_url: string
  uploaded_at: string
  step: string
}

interface Props {
  orchardId: string
  step: string
  documents: Doc[]
  onUploaded: () => void
}

export default function DocumentUpload({ orchardId, step, documents, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    try {
      const path = `${orchardId}/${step}/${Date.now()}_${file.name}`

      // Upload via our API route (uses service role key)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('path', path)

      const uploadRes = await fetch('/api/planning/upload', { method: 'POST', body: formData })
      const uploadJson = await uploadRes.json()

      if (!uploadRes.ok || !uploadJson.ok) {
        alert(`Upload failed: ${uploadJson.error || 'Unknown error'}`)
        setUploading(false)
        return
      }

      // Save document reference
      await fetch('/api/planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-document',
          orchard_id: orchardId,
          step,
          file_name: file.name,
          file_url: uploadJson.fileUrl,
        }),
      })

      onUploaded()
    } catch {
      alert('Upload failed')
    }
    setUploading(false)
    e.target.value = ''
  }

  async function handleDelete(docId: string) {
    if (!confirm('Delete this document?')) return
    await fetch('/api/planning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-document', id: docId }),
    })
    onUploaded()
  }

  const stepDocs = documents.filter(d => d.step === step)

  return (
    <div style={{ marginTop: 8 }}>
      {stepDocs.map(d => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
          <a href={d.file_url} target="_blank" rel="noopener" style={{ color: '#2176d9', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.file_name}
          </a>
          <span style={{ color: '#aaa', fontSize: 10 }}>{new Date(d.uploaded_at).toLocaleDateString()}</span>
          <button onClick={() => handleDelete(d.id)} style={{ background: 'none', border: 'none', color: '#e85a4a', cursor: 'pointer', fontSize: 13 }}>x</button>
        </div>
      ))}
      <label style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', fontSize: 11, fontWeight: 600,
        color: '#2176d9', cursor: uploading ? 'not-allowed' : 'pointer',
        opacity: uploading ? 0.6 : 1,
      }}>
        {uploading ? 'Uploading...' : '+ Attach document'}
        <input type="file" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
      </label>
    </div>
  )
}
