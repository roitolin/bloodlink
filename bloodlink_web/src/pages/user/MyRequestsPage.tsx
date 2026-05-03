import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, deleteDoc, doc, getDocs, orderBy, query, where } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { syncPublicCityAvailability } from '../../utils/publicCityAvailability'
import { getRequestSlaState } from '../../utils/requestSla'

type RequestItem = {
  id: string
  patientName?: string
  hospital?: string
  city?: string
  bloodTypeNeeded?: string
  urgency?: string
  status?: string
  contactNumber?: string
  location?: { latitude?: number; longitude?: number } | null
  locationLabel?: string | null
  createdAt?: { toDate?: () => Date } | string | null
  acceptedAt?: { toDate?: () => Date } | string | null
  completedAt?: { toDate?: () => Date } | string | null
  slaDeadlineAt?: { toDate?: () => Date } | string | null
}

function formatDate(value: RequestItem['createdAt']) {
  if (!value) return '-'
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return value.toDate?.().toLocaleString() ?? '-'
  }
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString()
}

function MyRequestsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [now, setNow] = useState(new Date())
  const { openConfirm, confirmDialog } = useConfirmDialog()

  const load = async () => {
    const user = auth.currentUser
    if (!user) {
      setLoading(false)
      return
    }

    setError('')
    setLoading(true)

    try {
      const snapshot = await getDocs(
        query(collection(db, 'requests'), where('requesterId', '==', user.uid), orderBy('createdAt', 'desc')),
      )

      setItems(snapshot.docs.map((requestDoc) => ({ id: requestDoc.id, ...(requestDoc.data() as Omit<RequestItem, 'id'>) })))
    } catch (caughtError) {
      const messageText =
        typeof caughtError === 'object' && caughtError !== null && 'message' in caughtError
          ? String(caughtError.message)
          : 'Failed to load requests.'
      setError(messageText)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(timer)
  }, [])

  const handleEdit = (item: RequestItem) => {
    const status = String(item.status || 'pending').toLowerCase()
    if (status === 'completed') {
      setError('Completed requests can no longer be edited.')
      return
    }

    navigate('/app/create-request', {
      state: {
        editRequestId: item.id,
        originalStatus: status,
        draft: {
          patientName: item.patientName || '',
          hospital: item.hospital || '',
          city: item.city || '',
          bloodType: item.bloodTypeNeeded || '',
          urgency: item.urgency || 'Normal',
          contactNumber: item.contactNumber || '',
          selectedLocation: item.location || null,
          selectedLocationLabel: item.locationLabel || '',
        },
      },
    })
  }

  const handleDelete = async (id: string, status: string) => {
    if (status.toLowerCase() === 'completed') {
      setError('Completed requests can no longer be deleted.')
      return
    }

    const item = items.find((entry) => entry.id === id)
    openConfirm({
      title: 'Delete this request?',
      message: `This will remove the request for ${item?.patientName || 'this patient'}.`,
      details: ['Completed requests cannot be deleted, but pending and accepted ones can be removed.'],
      tone: 'danger',
      confirmLabel: 'Delete Request',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'requests', id))
          await syncPublicCityAvailability(db)
          setItems((prev) => prev.filter((entry) => entry.id !== id))
        } catch (caughtError) {
          const messageText =
            typeof caughtError === 'object' && caughtError !== null && 'message' in caughtError
              ? String(caughtError.message)
              : 'Failed to delete request.'
          setError(messageText)
        }
      },
    })
  }

  const metrics = useMemo(() => {
    const pending = items.filter((item) => String(item.status || '').toLowerCase() === 'pending').length
    const accepted = items.filter((item) => String(item.status || '').toLowerCase() === 'accepted').length
    const completed = items.filter((item) => String(item.status || '').toLowerCase() === 'completed').length
    const breached = items.filter((item) => {
      const status = String(item.status || '').toLowerCase()
      if (status !== 'pending') return false
      return getRequestSlaState(item, now).isBreached
    }).length
    return { pending, accepted, completed, breached }
  }, [items, now])

  return (
    <section className="panel">
      <h2>My Requests</h2>
      <p className="panel-sub">Track and manage all requests you created.</p>

      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      <div className="stats-grid">
        <article className="stat-card"><strong>{metrics.pending}</strong><span>Pending</span></article>
        <article className="stat-card"><strong>{metrics.accepted}</strong><span>Accepted</span></article>
        <article className="stat-card"><strong>{metrics.completed}</strong><span>Completed</span></article>
        <article className="stat-card"><strong>{metrics.breached}</strong><span>Over Target Time</span></article>
      </div>

      <div className="table-wrap">
        <table className="request-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Location</th>
              <th>Blood</th>
              <th>Status</th>
              <th>Response Time</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>Loading requests...</td>
              </tr>
            ) : null}

            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={7}>No requests yet.</td>
              </tr>
            ) : null}

            {!loading
              ? items.map((item) => {
                  const status = String(item.status || 'pending')
                  const sla = getRequestSlaState(item, now)
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.patientName || '-'}</strong>
                        <div>{item.hospital || '-'}</div>
                      </td>
                      <td>
                        {item.locationLabel || item.city || '-'}
                      </td>
                      <td>{item.bloodTypeNeeded || '-'}</td>
                      <td>
                        <span className={`status-pill ${status.toLowerCase()}`}>{status}</span>
                      </td>
                      <td>
                        <span className={`sla-pill ${sla.tone}`}>{sla.label}</span>
                      </td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>
                        <div className="request-actions">
                          <Link to={`/app/my-requests/${item.id}`} className="ghost-btn table-action btn-link">
                            View
                          </Link>
                          <button type="button" className="ghost-btn table-action" onClick={() => handleEdit(item)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="ghost-btn table-action"
                            onClick={() => {
                              void handleDelete(item.id, status)
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              : null}
          </tbody>
        </table>
      </div>
      {confirmDialog}
    </section>
  )
}

export default MyRequestsPage

