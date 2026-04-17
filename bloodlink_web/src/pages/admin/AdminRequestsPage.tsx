import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

type RequestItem = {
  id: string
  requesterId?: string
  patientName?: string
  hospital?: string
  city?: string
  bloodTypeNeeded?: string
  urgency?: string
  status?: string
  contactNumber?: string
  slaDeadlineAt?: { toDate?: () => Date } | string | null
  escalationCount?: number
  createdAt?: { toDate?: () => Date } | string | null
}

type EmergencyUrgency = 'Critical' | 'Urgent' | 'Normal'

type EmergencyBroadcast = {
  id: string
  message?: string
  urgency?: EmergencyUrgency
  targetCity?: string | null
  targetBloodType?: string | null
  createdAt?: { toDate?: () => Date } | string | null
}

function normalize(value: string | undefined | null) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function toDateText(value: { toDate?: () => Date } | string | null | undefined) {
  if (!value) return '-'
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return value.toDate?.()?.toLocaleString() || '-'
  }
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString()
}

function toDate(value: { toDate?: () => Date } | string | null | undefined) {
  if (!value) return null
  if (typeof value === 'object' && value !== null && 'toDate' in value) return value.toDate?.() || null
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getConversationId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join('_')
}

function isAdminRole(role: string | undefined) {
  return normalize(role).includes('admin')
}

function AdminRequestsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [urgencyFilter, setUrgencyFilter] = useState('all')
  const [queryText, setQueryText] = useState('')
  const [items, setItems] = useState<RequestItem[]>([])
  const [runningEscalation, setRunningEscalation] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastUrgency, setBroadcastUrgency] = useState<EmergencyUrgency>('Critical')
  const [broadcastCity, setBroadcastCity] = useState('')
  const [broadcastBloodType, setBroadcastBloodType] = useState('')
  const [broadcastHours, setBroadcastHours] = useState('6')
  const [postingBroadcast, setPostingBroadcast] = useState(false)
  const [activeBroadcasts, setActiveBroadcasts] = useState<EmergencyBroadcast[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const requestSnap = await getDocs(collection(db, 'requests'))
      const list = requestSnap.docs.map((itemDoc) => ({
        id: itemDoc.id,
        ...(itemDoc.data() as Omit<RequestItem, 'id'>),
      }))
      list.sort((a, b) => new Date(toDateText(b.createdAt)).getTime() - new Date(toDateText(a.createdAt)).getTime())
      setItems(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    const emergencyQuery = query(collection(db, 'emergency_broadcasts'), where('status', '==', 'active'))
    const unsubscribe = onSnapshot(emergencyQuery, (snapshot) => {
      const list = snapshot.docs
        .map((itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as Omit<EmergencyBroadcast, 'id'>) }))
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))
      setActiveBroadcasts(list)
    })
    return () => unsubscribe()
  }, [])

  const filtered = useMemo(() => {
    const q = normalize(queryText)
    return items.filter((item) => {
      const statusOk = statusFilter === 'all' || normalize(item.status) === statusFilter
      const urgencyOk = urgencyFilter === 'all' || normalize(item.urgency) === normalize(urgencyFilter)
      if (!statusOk || !urgencyOk) return false
      if (!q) return true
      return [
        item.id,
        item.requesterId,
        item.patientName,
        item.hospital,
        item.city,
        item.bloodTypeNeeded,
        item.urgency,
        item.status,
        item.contactNumber,
      ].some((value) => normalize(value).includes(q))
    })
  }, [items, statusFilter, urgencyFilter, queryText])

  const updateStatus = async (item: RequestItem, nextStatus: string) => {
    setSavingId(item.id)
    try {
      const payload: Record<string, unknown> = {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      }
      if (nextStatus === 'completed') payload.completedAt = serverTimestamp()
      await updateDoc(doc(db, 'requests', item.id), payload)
      await load()
    } finally {
      setSavingId('')
    }
  }

  const deleteRequest = async (id: string) => {
    setSavingId(id)
    try {
      await deleteDoc(doc(db, 'requests', id))
      await load()
    } finally {
      setSavingId('')
    }
  }

  const openChatWithRequester = async (requesterId?: string) => {
    const adminId = auth.currentUser?.uid
    if (!adminId || !requesterId) return
    const conversationId = getConversationId(adminId, requesterId)
    const conversationRef = doc(db, 'conversations', conversationId)
    await setDoc(
      conversationRef,
      {
        participants: [adminId, requesterId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
    navigate(`/admin/support?conversation=${encodeURIComponent(conversationId)}`)
  }

  const runAutoEscalation = async () => {
    setRunningEscalation(true)
    try {
      const now = Date.now()
      const candidates = items.filter((item) => normalize(item.status) === 'pending').filter((item) => {
        const deadline = toDate(item.slaDeadlineAt)
        return Boolean(deadline && deadline.getTime() <= now)
      })

      await Promise.all(
        candidates.map((item) =>
          updateDoc(doc(db, 'requests', item.id), {
            escalationCount: Number(item.escalationCount || 0) + 1,
            escalatedAt: serverTimestamp(),
            escalatedBy: auth.currentUser?.uid || 'admin-web',
            updatedAt: serverTimestamp(),
          }),
        ),
      )
      await load()
    } finally {
      setRunningEscalation(false)
    }
  }

  const publishEmergencyBroadcast = async () => {
    const adminId = auth.currentUser?.uid
    if (!adminId) return

    const message = broadcastMessage.trim()
    if (!message) return

    setPostingBroadcast(true)
    try {
      const safeHours = Math.min(72, Math.max(1, Math.round(Number(broadcastHours) || 6)))
      const expiresAt = new Date(Date.now() + safeHours * 3600000)
      const trimmedCity = broadcastCity.trim()
      const trimmedBloodType = broadcastBloodType.trim()

      await setDoc(doc(collection(db, 'emergency_broadcasts')), {
        message,
        urgency: broadcastUrgency,
        status: 'active',
        targetCity: trimmedCity || null,
        targetBloodType: trimmedBloodType || null,
        createdBy: adminId,
        createdByName: auth.currentUser?.email || 'Admin',
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
      })

      const usersSnap = await getDocs(collection(db, 'users'))
      const users = usersSnap.docs.map((itemDoc) => ({
        id: itemDoc.id,
        ...(itemDoc.data() as { role?: string; city?: string; bloodType?: string }),
      }))
      const cityFilter = normalize(trimmedCity)
      const bloodFilter = normalize(trimmedBloodType)
      const recipients = users.filter((user) => {
        if (user.id === adminId) return false
        if (isAdminRole(String(user.role || ''))) return false
        if (cityFilter && normalize(String(user.city || '')) !== cityFilter) return false
        if (bloodFilter && normalize(String(user.bloodType || '')) !== bloodFilter) return false
        return true
      })

      if (recipients.length > 0) {
        const batch = writeBatch(db)
        recipients.forEach((recipient) => {
          const notifRef = doc(collection(db, 'notifications'))
          batch.set(notifRef, {
            userId: recipient.id,
            type: 'emergency_broadcast',
            title: `${broadcastUrgency} Blood Alert`,
            body: message,
            data: {
              urgency: broadcastUrgency,
              targetCity: trimmedCity || null,
              targetBloodType: trimmedBloodType || null,
            },
            read: false,
            createdAt: serverTimestamp(),
          })
        })
        await batch.commit()
      }

      setBroadcastMessage('')
      setBroadcastCity('')
      setBroadcastBloodType('')
      setBroadcastHours('6')
      await load()
    } finally {
      setPostingBroadcast(false)
    }
  }

  const resolveEmergencyBroadcast = async (broadcastId: string) => {
    await updateDoc(doc(db, 'emergency_broadcasts', broadcastId), {
      status: 'resolved',
      resolvedAt: serverTimestamp(),
      resolvedBy: auth.currentUser?.uid || 'admin-web',
    })
  }

  const escalationCandidates = items.filter((item) => {
    if (normalize(item.status) !== 'pending') return false
    const deadline = toDate(item.slaDeadlineAt)
    return Boolean(deadline && deadline.getTime() <= Date.now())
  })

  return (
    <section className="panel">
      <h2>Request Management</h2>
      <p className="panel-sub">Manage requests and escalation workflow.</p>

      <article className="panel feed-block emergency-card">
        <h3>Response Time Alert Board</h3>
        <p className="panel-sub">
          {escalationCandidates.length > 0
            ? `${escalationCandidates.length} pending request(s) require escalation attention.`
            : 'No requests currently need escalation.'}
        </p>
        <div className="quick-actions">
          <button type="button" className="solid-btn" disabled={runningEscalation} onClick={() => void runAutoEscalation()}>
            {runningEscalation ? 'Running...' : 'Run Auto Escalation'}
          </button>
        </div>
      </article>

      <article className="panel feed-block emergency-card">
        <h3>Emergency Broadcast Board</h3>
        <p className="panel-sub">Send urgent donor alerts filtered by city and blood type.</p>
        <div className="donor-filters donor-filters-advanced">
          <div>
            <label htmlFor="emergency-message">Message</label>
            <textarea
              id="emergency-message"
              value={broadcastMessage}
              onChange={(event) => setBroadcastMessage(event.target.value)}
              placeholder="Urgent blood alert message"
              rows={3}
            />
          </div>
          <div>
            <label htmlFor="emergency-urgency">Urgency</label>
            <select id="emergency-urgency" value={broadcastUrgency} onChange={(event) => setBroadcastUrgency(event.target.value as EmergencyUrgency)}>
              <option value="Critical">Critical</option>
              <option value="Urgent">Urgent</option>
              <option value="Normal">Normal</option>
            </select>
          </div>
          <div>
            <label htmlFor="emergency-city">Target City</label>
            <input id="emergency-city" value={broadcastCity} onChange={(event) => setBroadcastCity(event.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label htmlFor="emergency-blood">Target Blood Type</label>
            <input id="emergency-blood" value={broadcastBloodType} onChange={(event) => setBroadcastBloodType(event.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label htmlFor="emergency-hours">Expires In (Hours)</label>
            <input id="emergency-hours" type="number" min={1} max={72} value={broadcastHours} onChange={(event) => setBroadcastHours(event.target.value)} />
          </div>
        </div>
        <div className="quick-actions">
          <button type="button" className="solid-btn" disabled={postingBroadcast || !broadcastMessage.trim()} onClick={() => void publishEmergencyBroadcast()}>
            {postingBroadcast ? 'Publishing...' : 'Publish Emergency Broadcast'}
          </button>
        </div>
        <div className="notification-list">
          {activeBroadcasts.slice(0, 6).map((item) => (
            <article key={item.id} className="notification-item">
              <h3>{item.urgency || 'Emergency'} Alert</h3>
              <p>{item.message || '-'}</p>
              <span>
                {item.targetCity ? `City: ${item.targetCity}` : 'Nationwide'}
                {item.targetBloodType ? ` | Blood: ${item.targetBloodType}` : ''}
              </span>
              <div className="quick-actions">
                <button type="button" className="ghost-btn" onClick={() => void resolveEmergencyBroadcast(item.id)}>
                  Mark Resolved
                </button>
              </div>
            </article>
          ))}
          {activeBroadcasts.length === 0 ? <p className="panel-sub">No active emergency broadcasts.</p> : null}
        </div>
      </article>

      <div className="donor-filters donor-filters-advanced">
        <div>
          <label htmlFor="admin-request-search">Search</label>
          <input id="admin-request-search" value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Patient, hospital, city, blood type" />
        </div>
        <div>
          <label htmlFor="admin-request-status">Status</label>
          <select id="admin-request-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label htmlFor="admin-request-urgency">Urgency</label>
          <select id="admin-request-urgency" value={urgencyFilter} onChange={(event) => setUrgencyFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="Critical">Critical</option>
            <option value="Urgent">Urgent</option>
            <option value="Normal">Normal</option>
          </select>
        </div>
      </div>

      {loading ? <p className="panel-sub">Loading requests...</p> : null}
      {!loading && filtered.length === 0 ? <p className="panel-sub">No requests found.</p> : null}

      <div className="table-wrap">
        <table className="request-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Hospital</th>
              <th>City</th>
              <th>Blood</th>
              <th>Urgency</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const status = normalize(item.status) || 'pending'
              const busy = savingId === item.id
              return (
                <tr key={item.id}>
                  <td>{item.patientName || '-'}</td>
                  <td>{item.hospital || '-'}</td>
                  <td>{item.city || '-'}</td>
                  <td>{item.bloodTypeNeeded || '-'}</td>
                  <td>{item.urgency || '-'}</td>
                  <td><span className={`status-pill ${status}`}>{status}</span></td>
                  <td>{toDateText(item.createdAt)}</td>
                  <td>
                    <div className="request-actions">
                      <Link to={`/admin/requests/${item.id}`} className="ghost-btn btn-link table-action">View</Link>
                      <button type="button" className="ghost-btn table-action" disabled={busy || !item.requesterId} onClick={() => void openChatWithRequester(item.requesterId)}>
                        Chat
                      </button>
                      {status !== 'completed' ? (
                        <button type="button" className="ghost-btn table-action" disabled={busy} onClick={() => void updateStatus(item, 'completed')}>
                          Complete
                        </button>
                      ) : null}
                      <button type="button" className="ghost-btn table-action" disabled={busy} onClick={() => void deleteRequest(item.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AdminRequestsPage

