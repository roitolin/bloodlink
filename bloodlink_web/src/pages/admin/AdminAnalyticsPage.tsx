import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { FirestoreDoc, TimestampLike } from '@/types/firestore'
import { normalize, toDate } from '@/pages/admin/adminHelpers'

type AnalyticsMetrics = {
  totalUsers: number
  adminUsers: number
  requesterAccounts: number
  donorProfiles: number
  pendingDonors: number
  verifiedDonors: number
  rejectedDonors: number
  availableDonors: number
  unavailableDonors: number
  totalRequests: number
  pendingRequests: number
  acceptedRequests: number
  completedRequests: number
  highUrgencyRequests: number
  slaBreachedPendingRequests: number
  uniqueRequesters: number
  uniqueAcceptedDonors: number
  totalRatings: number
  averageRating: number
  anonymousRatings: number
  totalFeedbackPosts: number
  anonymousFeedbackPosts: number
  totalFeedbackReplies: number
  feedbackWithReplies: number
  averageRepliesPerFeedback: number
  totalSupportMessages: number
  fulfillmentRatePercent: number
  avgResponseTimeMinutes: number
  donorRetentionPercent: number
}

type ChartBarItem = { label: string; value: number }
type ExportHistoryItem = {
  id: string
  action?: string
  adminId?: string
  summary?: string
  createdAt?: TimestampLike
  metadata?: Record<string, unknown>
}

type RequestExportItem = FirestoreDoc & { id: string }
type UserAnalyticsDoc = FirestoreDoc & { id: string }
type RequestAnalyticsDoc = FirestoreDoc & { id: string }
type RatingAnalyticsDoc = FirestoreDoc & { id: string }
type FeedbackAnalyticsDoc = FirestoreDoc & { id: string }
type DonationAnalyticsDoc = FirestoreDoc & { id: string }

type ExportSnapshot = {
  requests: RequestExportItem[]
}

const EMPTY_METRICS: AnalyticsMetrics = {
  totalUsers: 0,
  adminUsers: 0,
  requesterAccounts: 0,
  donorProfiles: 0,
  pendingDonors: 0,
  verifiedDonors: 0,
  rejectedDonors: 0,
  availableDonors: 0,
  unavailableDonors: 0,
  totalRequests: 0,
  pendingRequests: 0,
  acceptedRequests: 0,
  completedRequests: 0,
  highUrgencyRequests: 0,
  slaBreachedPendingRequests: 0,
  uniqueRequesters: 0,
  uniqueAcceptedDonors: 0,
  totalRatings: 0,
  averageRating: 0,
  anonymousRatings: 0,
  totalFeedbackPosts: 0,
  anonymousFeedbackPosts: 0,
  totalFeedbackReplies: 0,
  feedbackWithReplies: 0,
  averageRepliesPerFeedback: 0,
  totalSupportMessages: 0,
  fulfillmentRatePercent: 0,
  avgResponseTimeMinutes: 0,
  donorRetentionPercent: 0,
}

function getRequestSlaBreached(item: FirestoreDoc) {
  if (normalize(item?.status) !== 'pending') return false
  const deadline = toDate(item?.slaDeadlineAt)
  if (deadline) return deadline.getTime() <= Date.now()
  const created = toDate(item?.createdAt)
  if (!created) return false
  return Date.now() - created.getTime() >= 2 * 60 * 60 * 1000
}

function escapeCsv(value: unknown) {
  const stringified = String(value ?? '')
  if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
    return `"${stringified.replace(/"/g, '""')}"`
  }
  return stringified
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function PieChart({
  title,
  items,
}: {
  title: string
  items: { label: string; value: number; color: string }[]
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const gradient = total > 0
    ? items
        .reduce(
          (acc, item) => {
            const start = acc.offset
            const end = start + (item.value / total) * 100
            acc.stops.push(`${item.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`)
            acc.offset = end
            return acc
          },
          { offset: 0, stops: [] as string[] },
        )
        .stops.join(', ')
    : '#e5e7eb 0 100%'

  return (
    <article className="chart-card">
      <h4>{title}</h4>
      <div className="chart-pie-wrap">
        <div className="chart-pie" style={{ background: `conic-gradient(${gradient})` }} aria-label={title} />
        <div className="chart-legend">
          {items.map((item) => (
            <div key={item.label} className="chart-legend-item">
              <span className="chart-legend-dot" style={{ backgroundColor: item.color }} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

function BarChart({
  title,
  items,
  color,
}: {
  title: string
  items: { label: string; value: number }[]
  color: string
}) {
  const max = Math.max(0, ...items.map((item) => item.value))

  return (
    <article className="chart-card">
      <h4>{title}</h4>
      {items.length === 0 ? <p className="panel-sub">No data available.</p> : null}
      {items.map((item) => (
        <div key={item.label} className="chart-row">
          <span>{item.label}</span>
          <div className="chart-track">
            <div className="chart-fill" style={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%`, backgroundColor: color }} />
          </div>
          <strong>{item.value}</strong>
        </div>
      ))}
    </article>
  )
}

function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<AnalyticsMetrics>(EMPTY_METRICS)
  const [topCities, setTopCities] = useState<ChartBarItem[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([])
  const [exportSnapshot, setExportSnapshot] = useState<ExportSnapshot>({ requests: [] })
  const [urgencyBreakdown, setUrgencyBreakdown] = useState<{ label: string; value: number }[]>([])

  const recordExport = async (format: 'csv' | 'pdf', days: number, requestCount: number) => {
    const adminId = auth.currentUser?.uid || null
    const periodLabel = days === 7 ? 'weekly' : days === 30 ? 'monthly' : `${days}-day`
    const summary = `Exported ${periodLabel.toUpperCase()} ${format.toUpperCase()} analytics report`
    try {
      await addDoc(collection(db, 'admin_audit_logs'), {
        adminId,
        action: `analytics_export_${format}`,
        targetType: 'system',
        targetId: null,
        summary,
        metadata: { format, days, requestCount },
        createdAt: serverTimestamp(),
      })
    } catch {
      // noop: export should still continue even if logging fails
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const [usersSnap, requestsSnap, ratingsSnap, feedbackSnap, supportSnap, donationHistorySnap, auditSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'requests')),
        getDocs(collection(db, 'app_ratings')),
        getDocs(collection(db, 'app_feedback')),
        getDocs(collection(db, 'supportMessages')),
        getDocs(collection(db, 'donation_history')),
        getDocs(query(collection(db, 'admin_audit_logs'), orderBy('createdAt', 'desc'), limit(40))),
      ])

      const users: UserAnalyticsDoc[] = usersSnap.docs.map(
        (itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as FirestoreDoc) }) as UserAnalyticsDoc,
      )
      const requests: RequestAnalyticsDoc[] = requestsSnap.docs.map(
        (itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as FirestoreDoc) }) as RequestAnalyticsDoc,
      )
      const ratings: RatingAnalyticsDoc[] = ratingsSnap.docs.map(
        (itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as FirestoreDoc) }) as RatingAnalyticsDoc,
      )
      const feedbackDocs = feedbackSnap.docs
      const feedback: FeedbackAnalyticsDoc[] = feedbackDocs.map(
        (itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as FirestoreDoc) }) as FeedbackAnalyticsDoc,
      )
      const donationHistory: DonationAnalyticsDoc[] = donationHistorySnap.docs.map(
        (itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as FirestoreDoc) }) as DonationAnalyticsDoc,
      )

      const replySnaps = await Promise.all(feedbackDocs.map((itemDoc) => getDocs(collection(db, 'app_feedback', itemDoc.id, 'replies'))))
      const totalFeedbackReplies = replySnaps.reduce((sum, snap) => sum + snap.size, 0)
      const feedbackWithReplies = replySnaps.filter((snap) => snap.size > 0).length

      const pendingRequests = requests.filter((item) => normalize(item?.status) === 'pending').length
      const acceptedRequests = requests.filter((item) => normalize(item?.status) === 'accepted').length
      const completedRequests = requests.filter((item) => normalize(item?.status) === 'completed').length
      const highUrgencyRequests = requests.filter((item) => ['critical', 'urgent'].includes(normalize(item?.urgency))).length
      const slaBreachedPendingRequests = requests.filter((item) => getRequestSlaBreached(item)).length

      const uniqueRequesters = new Set(requests.map((item) => item?.requesterId).filter(Boolean)).size
      const uniqueAcceptedDonors = new Set(requests.map((item) => item?.acceptedBy).filter(Boolean)).size

      const completedDonorIds = donationHistory.map((item) => item?.donorId).filter(Boolean)
      const uniqueCompletedDonors = new Set(completedDonorIds)
      const repeatDonorIds = new Set<string>()
      const donorDonationCount = new Map<string, number>()
      completedDonorIds.forEach((id) => {
        const key = String(id)
        const current = donorDonationCount.get(key) || 0
        const next = current + 1
        donorDonationCount.set(key, next)
        if (next >= 2) repeatDonorIds.add(key)
      })
      const donorRetentionPercent = uniqueCompletedDonors.size > 0 ? (repeatDonorIds.size / uniqueCompletedDonors.size) * 100 : 0

      const responseTimesMinutes = requests
        .map((item) => {
          const created = toDate(item?.createdAt)
          const accepted = toDate(item?.acceptedAt)
          if (!created || !accepted) return null
          const diffMinutes = (accepted.getTime() - created.getTime()) / 60000
          return diffMinutes >= 0 ? diffMinutes : null
        })
        .filter((item): item is number => typeof item === 'number')
      const avgResponseTimeMinutes =
        responseTimesMinutes.length > 0
          ? responseTimesMinutes.reduce((sum, item) => sum + item, 0) / responseTimesMinutes.length
          : 0

      const fulfillmentRatePercent = requests.length > 0 ? (completedRequests / requests.length) * 100 : 0

      const cityCounts = new Map<string, number>()
      const urgencyCounts = new Map<string, number>()
      requests.forEach((item) => {
        const city = String(item?.city || '').trim()
        const urgency = String(item?.urgency || 'Normal').trim() || 'Normal'
        if (city) cityCounts.set(city, (cityCounts.get(city) || 0) + 1)
        urgencyCounts.set(urgency, (urgencyCounts.get(urgency) || 0) + 1)
      })

      setTopCities(
        Array.from(cityCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([label, value]) => ({ label, value })),
      )

      setUrgencyBreakdown(
        Array.from(urgencyCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([label, value]) => ({ label, value })),
      )

      const totalRatings = ratings.length
      const averageRating = totalRatings > 0 ? ratings.reduce((sum, item) => sum + (Number(item?.rating) || 0), 0) / totalRatings : 0
      const anonymousRatings = ratings.filter((item) => Boolean(item?.isAnonymous)).length

      const totalFeedbackPosts = feedback.length
      const anonymousFeedbackPosts = feedback.filter((item) => Boolean(item?.isAnonymous)).length
      const averageRepliesPerFeedback = totalFeedbackPosts > 0 ? totalFeedbackReplies / totalFeedbackPosts : 0

      setMetrics({
        totalUsers: users.length,
        adminUsers: users.filter((item) => normalize(item?.role) === 'admin').length,
        requesterAccounts: users.filter((item) => normalize(item?.role) === 'requester').length,
        donorProfiles: users.filter((item) => Boolean(item?.bloodType)).length,
        pendingDonors: users.filter((item) => normalize(item?.donorStatus) === 'pending').length,
        verifiedDonors: users.filter((item) => normalize(item?.donorStatus) === 'verified').length,
        rejectedDonors: users.filter((item) => normalize(item?.donorStatus) === 'rejected').length,
        availableDonors: users.filter((item) => normalize(item?.donorStatus) === 'verified' && normalize(item?.availabilityStatus) === 'available').length,
        unavailableDonors: users.filter((item) => normalize(item?.donorStatus) === 'verified' && normalize(item?.availabilityStatus) !== 'available').length,
        totalRequests: requests.length,
        pendingRequests,
        acceptedRequests,
        completedRequests,
        highUrgencyRequests,
        slaBreachedPendingRequests,
        uniqueRequesters,
        uniqueAcceptedDonors,
        totalRatings,
        averageRating,
        anonymousRatings,
        totalFeedbackPosts,
        anonymousFeedbackPosts,
        totalFeedbackReplies,
        feedbackWithReplies,
        averageRepliesPerFeedback,
        totalSupportMessages: supportSnap.size,
        fulfillmentRatePercent,
        avgResponseTimeMinutes,
        donorRetentionPercent,
      })

      setExportSnapshot({ requests: requests as RequestExportItem[] })
      setExportHistory(
        auditSnap.docs
          .map((itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as FirestoreDoc) }) as ExportHistoryItem)
          .filter((item) => String(item.action || '').startsWith('analytics_export_'))
          .slice(0, 10),
      )
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const buildExportRecords = (days: number) => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (days - 1))

    const requests = exportSnapshot.requests.filter((item) => {
      const createdAt = toDate(item?.createdAt)
      return createdAt ? createdAt.getTime() >= start.getTime() : false
    })

    const completed = requests.filter((item) => normalize(item?.status) === 'completed')
    const accepted = requests.filter((item) => normalize(item?.status) === 'accepted')
    const pending = requests.filter((item) => normalize(item?.status) === 'pending')
    const critical = requests.filter((item) => normalize(item?.urgency) === 'critical')

    return {
      start,
      requests,
      summary: {
        totalRequests: requests.length,
        pendingRequests: pending.length,
        acceptedRequests: accepted.length,
        completedRequests: completed.length,
        criticalRequests: critical.length,
        uniqueRequesters: new Set(requests.map((item) => item?.requesterId).filter(Boolean)).size,
        uniqueDonors: new Set(requests.map((item) => item?.acceptedBy).filter(Boolean)).size,
        fulfillmentRate: requests.length > 0 ? (completed.length / requests.length) * 100 : 0,
      },
    }
  }

  const exportCsv = async (days: number) => {
    const { start, requests, summary } = buildExportRecords(days)
    const lines = [
      'BloodLink Analytics Export',
      `Period,${escapeCsv(`${start.toLocaleDateString()} to ${new Date().toLocaleDateString()}`)}`,
      `Generated At,${escapeCsv(new Date().toLocaleString())}`,
      '',
      'Summary,Value',
      `Total Requests,${summary.totalRequests}`,
      `Pending Requests,${summary.pendingRequests}`,
      `Accepted Requests,${summary.acceptedRequests}`,
      `Completed Requests,${summary.completedRequests}`,
      `Critical Requests,${summary.criticalRequests}`,
      `Unique Requesters,${summary.uniqueRequesters}`,
      `Unique Accepted Donors,${summary.uniqueDonors}`,
      `Fulfillment Rate (%),${summary.fulfillmentRate.toFixed(1)}`,
      '',
      'Request ID,Created At,Patient Name,Hospital,City,Blood Type,Urgency,Status,Accepted By',
    ]

    requests.forEach((item) => {
      lines.push(
        [
          escapeCsv(item?.id || ''),
          escapeCsv(toDate(item?.createdAt)?.toLocaleString() || ''),
          escapeCsv(item?.patientName || ''),
          escapeCsv(item?.hospital || ''),
          escapeCsv(item?.city || ''),
          escapeCsv(item?.bloodTypeNeeded || ''),
          escapeCsv(item?.urgency || ''),
          escapeCsv(item?.status || ''),
          escapeCsv(item?.acceptedBy || ''),
        ].join(','),
      )
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, `analytics_${days === 7 ? 'weekly' : 'monthly'}_${Date.now()}.csv`)
    await recordExport('csv', days, requests.length)
    await load()
  }

  const exportPdf = async (days: number) => {
    const { start, requests, summary } = buildExportRecords(days)
    const topRows = requests.slice(0, 60)
    const rowsHtml = topRows
      .map((item) => {
        const createdAt = toDate(item?.createdAt)?.toLocaleString() || ''
        return `<tr>
          <td>${String(item?.id || '')}</td>
          <td>${String(createdAt)}</td>
          <td>${String(item?.patientName || '')}</td>
          <td>${String(item?.city || '')}</td>
          <td>${String(item?.bloodTypeNeeded || '')}</td>
          <td>${String(item?.urgency || '')}</td>
          <td>${String(item?.status || '')}</td>
        </tr>`
      })
      .join('')

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>BloodLink Analytics Export</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #111827; }
            h1 { color: #b91c1c; margin: 0 0 8px 0; }
            .meta { margin-bottom: 10px; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #d1d5db; padding: 6px; font-size: 11px; text-align: left; }
            th { background: #f3f4f6; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>BloodLink Analytics (${days === 7 ? 'Weekly' : 'Monthly'})</h1>
          <div class="meta">Period: ${start.toLocaleDateString()} to ${new Date().toLocaleDateString()}</div>
          <div class="meta">Generated: ${new Date().toLocaleString()}</div>
          <table>
            <tr><th>Total Requests</th><td>${summary.totalRequests}</td></tr>
            <tr><th>Pending Requests</th><td>${summary.pendingRequests}</td></tr>
            <tr><th>Accepted Requests</th><td>${summary.acceptedRequests}</td></tr>
            <tr><th>Completed Requests</th><td>${summary.completedRequests}</td></tr>
            <tr><th>Critical Requests</th><td>${summary.criticalRequests}</td></tr>
            <tr><th>Unique Requesters</th><td>${summary.uniqueRequesters}</td></tr>
            <tr><th>Unique Accepted Donors</th><td>${summary.uniqueDonors}</td></tr>
            <tr><th>Fulfillment Rate</th><td>${summary.fulfillmentRate.toFixed(1)}%</td></tr>
          </table>
          <h3>Recent Requests (${topRows.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Created At</th>
                <th>Patient</th>
                <th>City</th>
                <th>Blood</th>
                <th>Urgency</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>`

    const popup = window.open('', '_blank')
    if (!popup) return
    popup.document.write(html)
    popup.document.close()
    popup.focus()
    popup.print()
    await recordExport('pdf', days, requests.length)
    await load()
  }

  const performanceCards = useMemo(
    () => [
      { label: 'Avg Response Time', value: `${metrics.avgResponseTimeMinutes.toFixed(1)} min` },
      { label: 'Fulfillment Rate', value: `${metrics.fulfillmentRatePercent.toFixed(1)}%` },
      { label: 'Donor Retention', value: `${metrics.donorRetentionPercent.toFixed(1)}%` },
    ],
    [metrics],
  )

  return (
    <section className="panel">
      <h2>Analytics</h2>
      <p className="panel-sub">Mobile analytics parity for operations, feedback, and exports.</p>
      {lastUpdated ? <p className="panel-sub">Updated: {lastUpdated.toLocaleString()}</p> : null}

      <div className="quick-actions">
        <button type="button" className="ghost-btn" onClick={() => void load()}>Refresh</button>
        <button type="button" className="solid-btn" onClick={() => exportCsv(7)}>Weekly CSV</button>
        <button type="button" className="ghost-btn" onClick={() => exportPdf(7)}>Weekly PDF</button>
        <button type="button" className="solid-btn" onClick={() => exportCsv(30)}>Monthly CSV</button>
        <button type="button" className="ghost-btn" onClick={() => exportPdf(30)}>Monthly PDF</button>
      </div>

      {loading ? <p className="panel-sub">Loading analytics...</p> : null}

      <div className="stats-grid">
        <article className="stat-card"><strong>{metrics.totalUsers}</strong><span>Total Users</span></article>
        <article className="stat-card"><strong>{metrics.adminUsers}</strong><span>Admin Accounts</span></article>
        <article className="stat-card"><strong>{metrics.requesterAccounts}</strong><span>Requester Accounts</span></article>
        <article className="stat-card"><strong>{metrics.donorProfiles}</strong><span>Donor Profiles</span></article>
      </div>

      <div className="stats-grid" style={{ marginTop: '10px' }}>
        <article className="stat-card"><strong>{metrics.pendingDonors}</strong><span>Pending Donors</span></article>
        <article className="stat-card"><strong>{metrics.verifiedDonors}</strong><span>Verified Donors</span></article>
        <article className="stat-card"><strong>{metrics.availableDonors}</strong><span>Available Donors</span></article>
        <article className="stat-card"><strong>{metrics.unavailableDonors}</strong><span>Unavailable Donors</span></article>
      </div>

      <div className="stats-grid" style={{ marginTop: '10px' }}>
        <article className="stat-card"><strong>{metrics.totalRequests}</strong><span>Total Requests</span></article>
        <article className="stat-card"><strong>{metrics.pendingRequests}</strong><span>Pending Requests</span></article>
        <article className="stat-card"><strong>{metrics.acceptedRequests}</strong><span>Accepted Requests</span></article>
        <article className="stat-card"><strong>{metrics.completedRequests}</strong><span>Completed Requests</span></article>
      </div>

      <div className="stats-grid" style={{ marginTop: '10px' }}>
        <article className="stat-card"><strong>{metrics.highUrgencyRequests}</strong><span>High Urgency</span></article>
        <article className="stat-card"><strong>{metrics.slaBreachedPendingRequests}</strong><span>Over Target Time</span></article>
        <article className="stat-card"><strong>{metrics.uniqueRequesters}</strong><span>Unique Requesters</span></article>
        <article className="stat-card"><strong>{metrics.uniqueAcceptedDonors}</strong><span>Unique Accepted Donors</span></article>
      </div>

      <h3 style={{ marginTop: '14px' }}>Performance</h3>
      <div className="quick-actions">
        {performanceCards.map((item) => (
          <span key={item.label} className="feed-badge-pill">{item.label}: {item.value}</span>
        ))}
      </div>

      <h3 style={{ marginTop: '14px' }}>Visual Analytics</h3>
      <div className="charts-grid">
        <PieChart
          title="Request Status Share"
          items={[
            { label: 'Pending', value: metrics.pendingRequests, color: '#f59e0b' },
            { label: 'Accepted', value: metrics.acceptedRequests, color: '#16a34a' },
            { label: 'Completed', value: metrics.completedRequests, color: '#2563eb' },
          ]}
        />
        <BarChart title="Urgency Distribution" items={urgencyBreakdown} color="#dc2626" />
      </div>
      <div className="charts-grid" style={{ marginTop: '10px' }}>
        <BarChart title="Top Active Cities" items={topCities} color="#ea580c" />
      </div>

      <h3 style={{ marginTop: '14px' }}>Top Active Cities</h3>
      <div className="notification-list">
        {topCities.length === 0 ? <p className="panel-sub">No city request records yet.</p> : null}
        {topCities.map((item) => (
          <article key={item.label} className="notification-item">
            <h3>{item.label}</h3>
            <p>{item.value} request(s)</p>
          </article>
        ))}
      </div>

      <h3 style={{ marginTop: '14px' }}>Ratings, Feedback, and Support</h3>
      <div className="stats-grid">
        <article className="stat-card"><strong>{metrics.totalRatings}</strong><span>Ratings Submitted</span></article>
        <article className="stat-card"><strong>{metrics.averageRating.toFixed(1)}</strong><span>Average Rating</span></article>
        <article className="stat-card"><strong>{metrics.totalFeedbackPosts}</strong><span>Feedback Posts</span></article>
        <article className="stat-card"><strong>{metrics.totalSupportMessages}</strong><span>Support Messages</span></article>
      </div>
      <div className="quick-actions">
        <span className="feed-badge-pill">Anonymous Ratings: {metrics.anonymousRatings}</span>
        <span className="feed-badge-pill">Anonymous Feedback: {metrics.anonymousFeedbackPosts}</span>
        <span className="feed-badge-pill">Feedback Replies: {metrics.totalFeedbackReplies}</span>
        <span className="feed-badge-pill">Posts With Replies: {metrics.feedbackWithReplies}</span>
        <span className="feed-badge-pill">Avg Replies/Post: {metrics.averageRepliesPerFeedback.toFixed(1)}</span>
      </div>

      <h3 style={{ marginTop: '14px' }}>Export History</h3>
      <div className="notification-list">
        {exportHistory.length === 0 ? <p className="panel-sub">No exports logged yet.</p> : null}
        {exportHistory.map((item) => (
          <article key={item.id} className="notification-item">
            <h3>{item.summary || item.action || 'Analytics Export'}</h3>
            <p>Admin: {item.adminId || '-'}</p>
            <span>{toDate(item.createdAt)?.toLocaleString() || '-'}</span>
          </article>
        ))}
      </div>
    </section>
  )
}

export default AdminAnalyticsPage

