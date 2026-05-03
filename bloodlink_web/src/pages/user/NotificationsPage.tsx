import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

type NotificationPayload = {
  requestId?: string
  conversationId?: string
  otherUserId?: string
  userId?: string
  [key: string]: unknown
}

type NotificationItem = {
  id: string
  title?: string
  body?: string
  type?: string
  data?: NotificationPayload | null
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
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const lastRefreshTapRef = useRef(0)

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

  const openNotification = async (item: NotificationItem) => {
    if (!item.read) {
      await markAsRead(item.id)
    }

    const data = item.data || {}
    const type = String(item.type || '')
    if (type === 'request_pending' || type === 'request_accepted' || type === 'request_completed') {
      if (typeof data.requestId === 'string' && data.requestId.trim()) {
        navigate(`/app/my-requests/${encodeURIComponent(data.requestId)}`)
        return
      }
      navigate('/app/my-requests')
      return
    }

    if (type === 'donor_approved' || type === 'donor_rejected') {
      navigate('/app/profile')
      return
    }

    if (type === 'support_message') {
      const params = new URLSearchParams()
      params.set('openMessages', '1')
      if (typeof data.conversationId === 'string' && data.conversationId.trim()) {
        params.set('conversation', data.conversationId)
      }
      if (typeof data.otherUserId === 'string' && data.otherUserId.trim()) {
        params.set('otherUserId', data.otherUserId)
      }
      navigate(`/app?${params.toString()}`)
      return
    }

    if (type === 'announcement_new' || type === 'emergency_broadcast') {
      navigate('/app')
    }
  }

  const handleDoubleTapRefresh = () => {
    const now = Date.now()
    if (now - lastRefreshTapRef.current <= 420) {
      lastRefreshTapRef.current = 0
      void load()
      return
    }
    lastRefreshTapRef.current = now
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
          <button type="button" className="ghost-btn table-action" onClick={handleDoubleTapRefresh} title="Double-tap to refresh notifications">
            Refresh x2
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
                <button type="button" className="ghost-btn table-action" onClick={() => void openNotification(item)}>
                  Open
                </button>
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
