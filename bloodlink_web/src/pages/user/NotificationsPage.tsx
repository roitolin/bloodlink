import { useEffect, useMemo, useState } from 'react'
import { collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

type NotificationItem = {
  id: string
  title?: string
  body?: string
  type?: string
  read?: boolean
  createdAt?: { toDate?: () => Date } | string | null
}

function formatDate(value: NotificationItem['createdAt']) {
  if (!value) return '-'
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return value.toDate?.().toLocaleString() ?? '-'
  }
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString()
}

function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    const user = auth.currentUser
    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const snapshot = await getDocs(
        query(collection(db, 'notifications'), where('userId', '==', user.uid), orderBy('createdAt', 'desc')),
      )

      setItems(snapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as Omit<NotificationItem, 'id'>) })))
    } catch (caughtError) {
      const messageText =
        typeof caughtError === 'object' && caughtError !== null && 'message' in caughtError
          ? String(caughtError.message)
          : 'Failed to load notifications.'
      setError(messageText)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items])

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true })
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)))
    } catch {
      setError('Failed to mark notification as read.')
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id))
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch {
      setError('Failed to delete notification.')
    }
  }

  const markAllAsRead = async () => {
    const unread = items.filter((item) => !item.read)
    if (unread.length === 0) return
    const batch = writeBatch(db)
    unread.forEach((item) => {
      batch.update(doc(db, 'notifications', item.id), { read: true })
    })
    try {
      await batch.commit()
      setItems((prev) => prev.map((item) => ({ ...item, read: true })))
    } catch {
      setError('Failed to mark all notifications as read.')
    }
  }

  const deleteRead = async () => {
    const readItems = items.filter((item) => item.read)
    if (readItems.length === 0) return
    const batch = writeBatch(db)
    readItems.forEach((item) => {
      batch.delete(doc(db, 'notifications', item.id))
    })
    try {
      await batch.commit()
      setItems((prev) => prev.filter((item) => !item.read))
    } catch {
      setError('Failed to delete read notifications.')
    }
  }

  return (
    <section className="panel">
      <h2>Notifications</h2>
      <p className="panel-sub">Latest updates related to your requests, account, and announcements.</p>

      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      <div className="notification-toolbar">
        <span className="notification-unread-pill">{unreadCount} unread</span>
        <div className="request-actions">
          <button type="button" className="ghost-btn table-action" onClick={() => void markAllAsRead()}>
            Mark all as read
          </button>
          <button type="button" className="ghost-btn table-action" onClick={() => void deleteRead()}>
            Delete read
          </button>
          <button type="button" className="ghost-btn table-action" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </div>

      <div className="notification-list">
        {loading ? <p className="panel-sub">Loading notifications...</p> : null}
        {!loading && items.length === 0 ? <p className="panel-sub">No notifications yet.</p> : null}

        {items.map((item) => (
          <article key={item.id} className={`notification-item${item.read ? '' : ' notification-item-unread'}`}>
            <div className="notification-head-row">
              <h3>{item.title || 'Notification'}</h3>
              <span className={`notification-read-badge${item.read ? ' is-read' : ''}`}>{item.read ? 'READ' : 'UNREAD'}</span>
            </div>
            <p>{item.body || '-'}</p>
            <div className="notification-foot-row">
              <span>{formatDate(item.createdAt)}</span>
              <div className="request-actions">
                {!item.read ? (
                  <button type="button" className="ghost-btn table-action" onClick={() => void markAsRead(item.id)}>
                    Mark as read
                  </button>
                ) : null}
                <button type="button" className="ghost-btn table-action" onClick={() => void deleteNotification(item.id)}>
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default NotificationsPage
