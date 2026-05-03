import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, getDocs, collection, query, where, orderBy, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { TimestampLike } from '@/types/firestore'
import { getConversationId, toDateText } from '@/pages/admin/adminHelpers'

type UserDetail = {
  id: string
  email?: string
  fullName?: string
  role?: string
  disabled?: boolean
  gender?: string
  dateOfBirth?: string
  contactNumber?: string
  bloodType?: string
  city?: string
  street?: string
  donorStatus?: string
  availabilityStatus?: string
  medicalCertificateURL?: string
  validIdURL?: string
  createdAt?: TimestampLike
}

type UserRequest = {
  id: string
  patientName?: string
  hospital?: string
  bloodTypeNeeded?: string
  urgency?: string
  status?: string
  createdAt?: TimestampLike
}

function AdminUserDetailPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState<UserDetail | null>(null)
  const [requests, setRequests] = useState<UserRequest[]>([])
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
        const userSnap = await getDoc(doc(db, 'users', id))
        if (!userSnap.exists()) {
          setError('User not found.')
          return
        }

        const requestSnap = await getDocs(query(collection(db, 'requests'), where('requesterId', '==', id), orderBy('createdAt', 'desc')))
        const requestItems = requestSnap.docs.map((requestDoc) => ({ id: requestDoc.id, ...(requestDoc.data() as Omit<UserRequest, 'id'>) }))

        setItem({ id: userSnap.id, ...(userSnap.data() as Omit<UserDetail, 'id'>) })
        setRequests(requestItems)
      } catch (caughtError) {
        const messageText =
          typeof caughtError === 'object' && caughtError !== null && 'message' in caughtError
            ? String(caughtError.message)
            : 'Failed to load user details.'
        setError(messageText)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id])

  const startConversation = async () => {
    if (!item?.id) return
    const adminId = auth.currentUser?.uid
    if (!adminId) return
    const conversationId = getConversationId(adminId, item.id)
    await setDoc(
      doc(db, 'conversations', conversationId),
      {
        participants: [adminId, item.id],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    navigate(`/admin/support?conversation=${encodeURIComponent(conversationId)}`)
  }

  return (
    <section className="panel">
      <div className="quick-actions">
        <button type="button" className="ghost-btn" onClick={() => navigate('/admin/users')}>
          Back to Users
        </button>
      </div>

      <h2>User Details</h2>
      <p className="panel-sub">View full user profile and request history.</p>

      {loading ? <p className="panel-sub">Loading user details...</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      {item ? (
        <>
          <div className="request-detail-grid">
            <div>
              <span>Name</span>
              <strong>{item.fullName || '-'}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{item.email || '-'}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>{item.role || 'user'}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{item.disabled ? 'Disabled' : 'Active'}</strong>
            </div>
            <div>
              <span>Contact</span>
              <strong>{item.contactNumber || '-'}</strong>
            </div>
            <div>
              <span>Gender</span>
              <strong>{item.gender || '-'}</strong>
            </div>
            <div>
              <span>Date Of Birth</span>
              <strong>{item.dateOfBirth || '-'}</strong>
            </div>
            <div>
              <span>Created At</span>
              <strong>{toDateText(item.createdAt)}</strong>
            </div>
            <div>
              <span>Donor Status</span>
              <strong>{item.donorStatus || 'none'}</strong>
            </div>
            <div>
              <span>Availability</span>
              <strong>{item.availabilityStatus || '-'}</strong>
            </div>
            <div>
              <span>Blood Type</span>
              <strong>{item.bloodType || '-'}</strong>
            </div>
            <div>
              <span>Location</span>
              <strong>{[item.street, item.city].filter(Boolean).join(', ') || '-'}</strong>
            </div>
          </div>

          {item.medicalCertificateURL || item.validIdURL ? (
            <div className="quick-actions">
              {item.medicalCertificateURL ? (
                <a className="ghost-btn btn-link" href={item.medicalCertificateURL} target="_blank" rel="noreferrer">
                  Open Medical Certificate
                </a>
              ) : null}
              {item.validIdURL ? (
                <a className="ghost-btn btn-link" href={item.validIdURL} target="_blank" rel="noreferrer">
                  Open Valid ID
                </a>
              ) : null}
            </div>
          ) : null}

          <h3 style={{ marginTop: '14px' }}>Blood Requests</h3>
          {requests.length === 0 ? <p className="panel-sub">No requests found for this user.</p> : null}
          <div className="table-wrap">
            <table className="request-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Hospital</th>
                  <th>Blood</th>
                  <th>Urgency</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((requestItem) => (
                  <tr key={requestItem.id}>
                    <td>{requestItem.patientName || '-'}</td>
                    <td>{requestItem.hospital || '-'}</td>
                    <td>{requestItem.bloodTypeNeeded || '-'}</td>
                    <td>{requestItem.urgency || '-'}</td>
                    <td>{requestItem.status || '-'}</td>
                    <td>{toDateText(requestItem.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="quick-actions">
            <button type="button" className="solid-btn" onClick={() => void startConversation()}>Chat</button>
          </div>
        </>
      ) : null}
    </section>
  )
}

export default AdminUserDetailPage
