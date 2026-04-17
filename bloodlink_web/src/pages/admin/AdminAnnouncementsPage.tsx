import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

type AnnouncementItem = {
  id: string
  title?: string
  body?: string
  status?: string
  isPinned?: boolean
  createdAt?: { toDate?: () => Date } | string | null
}

function toDateText(value: AnnouncementItem['createdAt']) {
  if (!value) return '-'
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return value.toDate?.()?.toLocaleString() || '-'
  }
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString()
}

function AdminAnnouncementsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [items, setItems] = useState<AnnouncementItem[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const snapshot = await getDocs(collection(db, 'announcements'))
      const list = snapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as Omit<AnnouncementItem, 'id'>) }))
      list.sort((a, b) => new Date(toDateText(b.createdAt)).getTime() - new Date(toDateText(a.createdAt)).getTime())
      setItems(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !body.trim()) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'announcements'), {
        title: title.trim(),
        body: body.trim(),
        status: 'active',
        isPinned: false,
        createdBy: auth.currentUser?.uid || null,
        createdAt: serverTimestamp(),
      })
      setTitle('')
      setBody('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (item: AnnouncementItem) => {
    await updateDoc(doc(db, 'announcements', item.id), {
      status: item.status === 'active' ? 'inactive' : 'active',
      updatedAt: serverTimestamp(),
    })
    await load()
  }

  const togglePinned = async (item: AnnouncementItem) => {
    await updateDoc(doc(db, 'announcements', item.id), {
      isPinned: !item.isPinned,
      updatedAt: serverTimestamp(),
    })
    await load()
  }

  return (
    <section className="panel">
      <h2>Announcements</h2>
      <p className="panel-sub">Post updates and manage what is visible to users.</p>

      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="admin-announcement-title">Title</label>
        <input id="admin-announcement-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <label htmlFor="admin-announcement-body">Message</label>
        <textarea id="admin-announcement-body" className="app-textarea" value={body} onChange={(event) => setBody(event.target.value)} required />
        <button type="submit" className="solid-btn auth-submit" disabled={saving}>{saving ? 'Posting...' : 'Post Announcement'}</button>
      </form>

      {loading ? <p className="panel-sub">Loading announcements...</p> : null}
      {!loading && items.length === 0 ? <p className="panel-sub">No announcements found.</p> : null}

      <div className="notification-list">
        {items.map((item) => (
          <article key={item.id} className="notification-item">
            <h3>{item.title || '-'}</h3>
            <p>{item.body || '-'}</p>
            <span>
              {item.status || 'inactive'}{item.isPinned ? ' • pinned' : ''} • {toDateText(item.createdAt)}
            </span>
            <div className="quick-actions">
              <button type="button" className="ghost-btn" onClick={() => void togglePinned(item)}>
                {item.isPinned ? 'Unpin' : 'Pin'}
              </button>
              <button type="button" className="ghost-btn" onClick={() => void toggleStatus(item)}>
                {item.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default AdminAnnouncementsPage
