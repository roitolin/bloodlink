import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

type RequestRecord = {
  status?: string
}

type UserRecord = {
  role?: string
  availabilityStatus?: string
  donorStatus?: string
  funeralShopStatus?: string
}

type AnnouncementRecord = {
  status?: string
}

function normalize(value: string | undefined | null) {
  return String(value || '').trim().toLowerCase()
}

function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [users, setUsers] = useState<UserRecord[]>([])
  const [requests, setRequests] = useState<RequestRecord[]>([])
  const [viewerRole, setViewerRole] = useState('user')
  const [reportsCount, setReportsCount] = useState(0)
  const [feedbackCount, setFeedbackCount] = useState(0)
  const [activeAnnouncementsCount, setActiveAnnouncementsCount] = useState(0)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const currentUser = auth.currentUser
        const [usersSnap, requestsSnap, reportsSnap, feedbackSnap, announcementsSnap, viewerSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'requests')),
          getDocs(collection(db, 'abuse_reports')),
          getDocs(collection(db, 'app_feedback')),
          getDocs(collection(db, 'announcements')),
          currentUser ? getDoc(doc(db, 'users', currentUser.uid)) : Promise.resolve(null),
        ])

        const usersList = usersSnap.docs.map((itemDoc) => itemDoc.data() as UserRecord)
        const requestsList = requestsSnap.docs.map((itemDoc) => itemDoc.data() as RequestRecord)
        const activeAnnouncements = announcementsSnap.docs
          .map((itemDoc) => itemDoc.data() as AnnouncementRecord)
          .filter((item) => normalize(item.status) === 'active').length
        const nextViewerRole =
          viewerSnap && 'data' in viewerSnap ? normalize(viewerSnap.data()?.role || 'user') : 'user'

        setUsers(usersList)
        setRequests(requestsList)
        setViewerRole(nextViewerRole)
        setReportsCount(reportsSnap.size)
        setFeedbackCount(feedbackSnap.size)
        setActiveAnnouncementsCount(activeAnnouncements)
      } catch {
        setError('Unable to load admin metrics right now.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const metrics = useMemo(() => {
    const isRootAdmin = viewerRole === 'super_admin' || viewerRole === 'admin'
    const isBloodAdmin = isRootAdmin || viewerRole === 'blood_admin'
    const isFuneralAdmin = isRootAdmin || viewerRole === 'funeral_admin'
    const nonAdminUsers = users.filter((item) => !normalize(item.role).includes('admin'))
    const availableDonors = users.filter((item) => normalize(item.availabilityStatus) === 'available').length
    const pendingDonorVerifications = users.filter((item) => normalize(item.donorStatus) === 'pending').length
    const pendingFuneralShops = users.filter((item) => normalize(item.funeralShopStatus) === 'pending').length
    const openRequests = requests.filter((item) => {
      const status = normalize(item.status)
      return status === 'pending' || status === 'accepted'
    }).length
    const completedRequests = requests.filter((item) => normalize(item.status) === 'completed').length

    return {
      totalUsers: nonAdminUsers.length,
      availableDonors,
      pendingDonorVerifications,
      pendingFuneralShops,
      totalRequests: requests.length,
      openRequests,
      completedRequests,
      reportsCount,
      feedbackCount,
      activeAnnouncementsCount,
      isBloodAdmin,
      isFuneralAdmin,
    }
  }, [users, requests, reportsCount, feedbackCount, activeAnnouncementsCount, viewerRole])

  return (
    <section className="panel">
      <h2>System Overview</h2>
      <p className="panel-sub">
        {viewerRole === 'funeral_admin'
          ? 'Monitor funeral shop records and moderation queues.'
          : viewerRole === 'blood_admin'
            ? 'Monitor blood metrics, donor queues, and request activity.'
            : 'Monitor key metrics for donors, requests, and moderation queues.'}
      </p>

      {loading ? <p className="panel-sub">Loading admin dashboard...</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      <div className="stats-grid">
        <article className="stat-card"><strong>{metrics.totalUsers}</strong><span>Users</span></article>
        {metrics.isBloodAdmin ? <article className="stat-card"><strong>{metrics.availableDonors}</strong><span>Available Donors</span></article> : null}
        {metrics.isBloodAdmin ? <article className="stat-card"><strong>{metrics.pendingDonorVerifications}</strong><span>Donor Verifications Pending</span></article> : null}
        {metrics.isBloodAdmin ? <article className="stat-card"><strong>{metrics.totalRequests}</strong><span>Total Requests</span></article> : null}
        {metrics.isBloodAdmin ? <article className="stat-card"><strong>{metrics.openRequests}</strong><span>Open Requests</span></article> : null}
        {metrics.isBloodAdmin ? <article className="stat-card"><strong>{metrics.completedRequests}</strong><span>Completed Requests</span></article> : null}
        {metrics.isFuneralAdmin ? <article className="stat-card"><strong>{metrics.pendingFuneralShops}</strong><span>Pending Funeral Shops</span></article> : null}
        <article className="stat-card"><strong>{metrics.reportsCount}</strong><span>Abuse Reports</span></article>
        {metrics.isBloodAdmin ? <article className="stat-card"><strong>{metrics.feedbackCount}</strong><span>Feedback Entries</span></article> : null}
        {metrics.isBloodAdmin ? <article className="stat-card"><strong>{metrics.activeAnnouncementsCount}</strong><span>Active Announcements</span></article> : null}
      </div>
    </section>
  )
}

export default AdminDashboardPage
