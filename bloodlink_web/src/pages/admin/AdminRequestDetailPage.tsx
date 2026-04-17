import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { getConversationId, toDateText } from './adminHelpers'

type RequestDetail = {
  id: string
  requesterId?: string
  patientName?: string
  hospital?: string
  city?: string
  locationLabel?: string | null
  bloodTypeNeeded?: string
  urgency?: string
  status?: string
  contactNumber?: string
  details?: string
  notes?: string
  escalationCount?: number
  createdAt?: unknown
  updatedAt?: unknown
  acceptedAt?: unknown
  completedAt?: unknown
}

type RequesterProfile = {
  fullName?: string
  email?: string
  contactNumber?: string
}

function AdminRequestDetailPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState<RequestDetail | null>(null)
  const [requester, setRequester] = useState<RequesterProfile | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      try {
        const requestSnap = await getDoc(doc(db, 'requests', id))
        if (!requestSnap.exists()) {
          setError('Request not found.')
          return
        }

        const nextItem = { id: requestSnap.id, ...(requestSnap.data() as Omit<RequestDetail, 'id'>) }
        setItem(nextItem)

        if (nextItem.requesterId) {
          const requesterSnap = await getDoc(doc(db, 'users', nextItem.requesterId))
          if (requesterSnap.exists()) {
            setRequester(requesterSnap.data() as RequesterProfile)
          } else {
            setRequester(null)
          }
        } else {
          setRequester(null)
        }
      } catch (caughtError) {
        const messageText =
          typeof caughtError === 'object' && caughtError !== null && 'message' in caughtError
            ? String(caughtError.message)
            : 'Failed to load request details.'
        setError(messageText)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id])

  const openChat = async () => {
    if (!item?.requesterId) return
    const adminId = auth.currentUser?.uid
    if (!adminId) return
    const conversationId = getConversationId(adminId, item.requesterId)
    await setDoc(
      doc(db, 'conversations', conversationId),
      {
        participants: [adminId, item.requesterId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
    navigate(`/admin/support?conversation=${encodeURIComponent(conversationId)}`)
  }

  const contactNumber = item?.contactNumber || requester?.contactNumber || ''

  return (
    <section className="panel">
      <div className="quick-actions">
        <button type="button" className="ghost-btn" onClick={() => navigate('/admin/requests')}>
          Back to Requests
        </button>
      </div>

      <h2>Request Details</h2>
      <p className="panel-sub">Complete request record for admin review.</p>

      {loading ? <p className="panel-sub">Loading request details...</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      {item ? (
        <>
          <div className="request-detail-grid">
            <div>
              <span>Request ID</span>
              <strong>{item.id}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{item.status || '-'}</strong>
            </div>
            <div>
              <span>Patient Name</span>
              <strong>{item.patientName || '-'}</strong>
            </div>
            <div>
              <span>Blood Type Needed</span>
              <strong>{item.bloodTypeNeeded || '-'}</strong>
            </div>
            <div>
              <span>Urgency</span>
              <strong>{item.urgency || '-'}</strong>
            </div>
            <div>
              <span>Escalation Count</span>
              <strong>{Number(item.escalationCount || 0)}</strong>
            </div>
            <div>
              <span>Hospital</span>
              <strong>{item.hospital || '-'}</strong>
            </div>
            <div>
              <span>Location</span>
              <strong>{item.locationLabel || item.city || '-'}</strong>
            </div>
            <div>
              <span>Contact Number</span>
              <strong>{contactNumber || '-'}</strong>
            </div>
            <div>
              <span>Requester</span>
              <strong>{requester?.fullName || requester?.email || item.requesterId || '-'}</strong>
            </div>
            <div>
              <span>Created At</span>
              <strong>{toDateText(item.createdAt)}</strong>
            </div>
            <div>
              <span>Updated At</span>
              <strong>{toDateText(item.updatedAt)}</strong>
            </div>
            <div>
              <span>Accepted At</span>
              <strong>{toDateText(item.acceptedAt)}</strong>
            </div>
            <div>
              <span>Completed At</span>
              <strong>{toDateText(item.completedAt)}</strong>
            </div>
          </div>

          {item.details ? (
            <article className="notification-item" style={{ marginTop: '12px' }}>
              <h3>Request Details</h3>
              <p>{item.details}</p>
            </article>
          ) : null}

          {item.notes ? (
            <article className="notification-item" style={{ marginTop: '12px' }}>
              <h3>Requester Notes</h3>
              <p>{item.notes}</p>
            </article>
          ) : null}

          <div className="quick-actions">
            <Link to="/admin/requests" className="ghost-btn btn-link">Back to Requests</Link>
            <Link to={item.requesterId ? `/admin/users/${item.requesterId}` : '/admin/users'} className="ghost-btn btn-link">View Requester</Link>
            <button type="button" className="solid-btn" disabled={!item.requesterId} onClick={() => void openChat()}>
              Chat
            </button>
          </div>
        </>
      ) : null}
    </section>
  )
}

export default AdminRequestDetailPage
