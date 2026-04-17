import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import EmergencyBroadcastBoard from '@/components/EmergencyBroadcastBoard'

type RequestRecord = {
  status?: string
}

type Announcement = {
  id: string
  title?: string
  body?: string
  isPinned?: boolean
  createdAt?: { toDate?: () => Date } | string | null
}

function getAnnouncementTime(value: Announcement['createdAt']) {
  if (!value) return 'Unknown date'
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return value.toDate?.()?.toLocaleString() || 'Unknown date'
  }
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return 'Unknown date'
  return parsed.toLocaleString()
}

function DashboardPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser)
  const [fullName, setFullName] = useState('User')
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<RequestRecord[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [viewerCity, setViewerCity] = useState('')
  const [viewerBloodType, setViewerBloodType] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        const userData = userSnap.data() as { fullName?: string; city?: string; bloodType?: string } | undefined
        setFullName(userData?.fullName?.trim() || user.displayName || 'User')
        setViewerCity(userData?.city || '')
        setViewerBloodType(userData?.bloodType || '')

        const requestSnap = await getDocs(query(collection(db, 'requests'), where('requesterId', '==', user.uid)))
        const list = requestSnap.docs.map((docItem) => docItem.data() as RequestRecord)
        setRequests(list)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [user])

  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'announcements'), where('status', '==', 'active')))
        const list = snapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as Omit<Announcement, 'id'>) }))

        list.sort((a, b) => {
          const aPinned = a.isPinned ? 1 : 0
          const bPinned = b.isPinned ? 1 : 0
          if (aPinned !== bPinned) return bPinned - aPinned

          const aTime =
            typeof a.createdAt === 'object' && a.createdAt && 'toDate' in a.createdAt
              ? a.createdAt.toDate?.()?.getTime?.() || 0
              : new Date(String(a.createdAt || 0)).getTime() || 0
          const bTime =
            typeof b.createdAt === 'object' && b.createdAt && 'toDate' in b.createdAt
              ? b.createdAt.toDate?.()?.getTime?.() || 0
              : new Date(String(b.createdAt || 0)).getTime() || 0

          return bTime - aTime
        })

        setAnnouncements(list.slice(0, 3))
      } catch {
        setAnnouncements([])
      }
    }

    void loadAnnouncements()
  }, [])

  const stats = useMemo(() => {
    const total = requests.length
    const pending = requests.filter((item) => String(item.status || '').toLowerCase() === 'pending').length
    const accepted = requests.filter((item) => String(item.status || '').toLowerCase() === 'accepted').length
    const completed = requests.filter((item) => String(item.status || '').toLowerCase() === 'completed').length

    return { total, pending, accepted, completed }
  }, [requests])

  return (
    <section className="panel feed-layout">
      <article className="feed-hero-card">
        <p className="kicker">LIFE-SAVING NETWORK</p>
        <h2>Welcome to BloodLink, {fullName}</h2>
        <p className="panel-sub">Connect with donors, view active requests, and respond faster in your community.</p>
        <div className="feed-badges-row">
          <span className="feed-badge-pill">Fast Matching</span>
          <span className="feed-badge-pill">Verified Donors</span>
          <span className="feed-badge-pill">Local Support</span>
        </div>
        <div className="quick-actions">
          <Link to="/app/search-donors" className="solid-btn btn-link">Browse Available Donors</Link>
          <Link to="/app/my-requests" className="ghost-btn btn-link">View Active Requests</Link>
        </div>
      </article>

      <article className="panel feed-block welcome-announcements">
        <h3>Announcements</h3>
        {announcements.length === 0 ? <p className="panel-sub">No active announcements right now.</p> : null}
        <div className="notification-list">
          {announcements.map((item) => (
            <article key={item.id} className="notification-item">
              <h3>{item.title || 'Update'}{item.isPinned ? ' - Pinned' : ''}</h3>
              <p>{item.body || '-'}</p>
              <span>{getAnnouncementTime(item.createdAt)}</span>
            </article>
          ))}
        </div>
      </article>

      <EmergencyBroadcastBoard viewerCity={viewerCity} viewerBloodType={viewerBloodType} />

      <article className="panel feed-block">
        <h3>What You Can Do</h3>
        <ul className="feed-list">
          <li>Search and match with nearby donors by blood type.</li>
          <li>Create urgent requests with map location and contact number.</li>
          <li>Track status updates and manage your profile.</li>
          <li>Use support tools from profile for concerns and feedback.</li>
        </ul>
      </article>

      <article className="panel feed-block">
        <h3>Your Request Summary</h3>
        {loading ? <p className="panel-sub">Loading dashboard...</p> : null}
        <div className="stats-grid">
          <article className="stat-card"><strong>{stats.total}</strong><span>Total Requests</span></article>
          <article className="stat-card"><strong>{stats.pending}</strong><span>Pending</span></article>
          <article className="stat-card"><strong>{stats.accepted}</strong><span>Accepted</span></article>
          <article className="stat-card"><strong>{stats.completed}</strong><span>Completed</span></article>
        </div>
      </article>

      <article className="panel feed-block">
        <h3>Quick Access</h3>
        <div className="quick-actions">
          <Link to="/app/create-request" className="solid-btn btn-link">Request Blood</Link>
          <Link to="/app/my-requests" className="ghost-btn btn-link">My Requests</Link>
          <Link to="/app/profile" className="ghost-btn btn-link">Profile</Link>
          <Link to="/app/notifications" className="ghost-btn btn-link">Notifications</Link>
        </div>
      </article>

      <article className="panel feed-block">
        <h3>Need Blood Fast?</h3>
        <p className="panel-sub">Create your own blood request and connect with available donors right away.</p>
        <div className="quick-actions">
          <Link to="/app/create-request" className="solid-btn btn-link">Create Blood Request</Link>
        </div>
      </article>

      <article className="panel feed-block">
        <h3>Need Help, Follow-up, or Updates?</h3>
        <p className="panel-sub">Open messages from the floating chat button, and monitor updates in notifications.</p>
        <div className="quick-actions">
          <Link to="/app/notifications" className="ghost-btn btn-link">Open Notifications</Link>
        </div>
      </article>

      <article className="panel feed-block">
        <h3>Need to Update Your Details?</h3>
        <p className="panel-sub">Keep your profile complete so others can trust your information and contact you quickly.</p>
        <div className="quick-actions">
          <Link to="/app/profile" className="ghost-btn btn-link">Manage Profile</Link>
        </div>
      </article>

    </section>
  )
}

export default DashboardPage
