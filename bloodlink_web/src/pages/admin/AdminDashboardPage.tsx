import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

type RequestRecord = {
  status?: string
}

type UserRecord = {
  role?: string
  availabilityStatus?: string
  donorStatus?: string
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
  const [reportsCount, setReportsCount] = useState(0)
  const [feedbackCount, setFeedbackCount] = useState(0)
  const [activeAnnouncementsCount, setActiveAnnouncementsCount] = useState(0)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [usersSnap, requestsSnap, reportsSnap, feedbackSnap, announcementsSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'requests')),
          getDocs(collection(db, 'abuse_reports')),
          getDocs(collection(db, 'app_feedback')),
          getDocs(collection(db, 'announcements')),
        ])

        const usersList = usersSnap.docs.map((itemDoc) => itemDoc.data() as UserRecord)
        const requestsList = requestsSnap.docs.map((itemDoc) => itemDoc.data() as RequestRecord)
        const activeAnnouncements = announcementsSnap.docs
          .map((itemDoc) => itemDoc.data() as AnnouncementRecord)
          .filter((item) => normalize(item.status) === 'active').length

        setUsers(usersList)
        setRequests(requestsList)
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
    const nonAdminUsers = users.filter((item) => normalize(item.role) !== 'admin')
    const availableDonors = users.filter((item) => normalize(item.availabilityStatus) === 'available').length
    const pendingDonorVerifications = users.filter((item) => normalize(item.donorStatus) === 'pending').length
    const openRequests = requests.filter((item) => {
      const status = normalize(item.status)
      return status === 'pending' || status === 'accepted'
    }).length
    const completedRequests = requests.filter((item) => normalize(item.status) === 'completed').length

    return {
      totalUsers: nonAdminUsers.length,
      availableDonors,
      pendingDonorVerifications,
      totalRequests: requests.length,
      openRequests,
      completedRequests,
      reportsCount,
      feedbackCount,
      activeAnnouncementsCount,
    }
  }, [users, requests, reportsCount, feedbackCount, activeAnnouncementsCount])

  return (
    <section className="panel">
      <h2>System Overview</h2>
      <p className="panel-sub">Monitor key metrics for donors, requests, and moderation queues.</p>

      {loading ? <p className="panel-sub">Loading admin dashboard...</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      <div className="stats-grid">
        <article className="stat-card"><strong>{metrics.totalUsers}</strong><span>Users</span></article>
        <article className="stat-card"><strong>{metrics.availableDonors}</strong><span>Available Donors</span></article>
        <article className="stat-card"><strong>{metrics.pendingDonorVerifications}</strong><span>Donor Verifications Pending</span></article>
        <article className="stat-card"><strong>{metrics.totalRequests}</strong><span>Total Requests</span></article>
        <article className="stat-card"><strong>{metrics.openRequests}</strong><span>Open Requests</span></article>
        <article className="stat-card"><strong>{metrics.completedRequests}</strong><span>Completed Requests</span></article>
        <article className="stat-card"><strong>{metrics.reportsCount}</strong><span>Abuse Reports</span></article>
        <article className="stat-card"><strong>{metrics.feedbackCount}</strong><span>Feedback Entries</span></article>
        <article className="stat-card"><strong>{metrics.activeAnnouncementsCount}</strong><span>Active Announcements</span></article>
      </div>
    </section>
  )
}

export default AdminDashboardPage
