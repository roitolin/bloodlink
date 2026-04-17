import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { getRequestSlaState } from '../../utils/requestSla'

type RequestDetail = {
  requesterId?: string
  patientName?: string
  hospital?: string
  city?: string
  bloodTypeNeeded?: string
  urgency?: string
  contactNumber?: string
  status?: string
  location?: { latitude?: number; longitude?: number } | null
  locationLabel?: string | null
  createdAt?: { toDate?: () => Date } | string | null
  acceptedAt?: { toDate?: () => Date } | string | null
  completedAt?: { toDate?: () => Date } | string | null
  slaDeadlineAt?: { toDate?: () => Date } | string | null
}

function formatDate(value: RequestDetail['createdAt']) {
  if (!value) return '-'
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return value.toDate?.().toLocaleString() ?? '-'
  }
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString()
}

function RequestDetailPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const [item, setItem] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser
      if (!user || !id) {
        setLoading(false)
        return
      }

      try {
        const snapshot = await getDoc(doc(db, 'requests', id))
        if (!snapshot.exists()) {
          setError('Request not found.')
          return
        }

        const data = snapshot.data() as RequestDetail
        if (String(data.requesterId || '') !== user.uid) {
          setError('You can only view your own requests.')
          return
        }

        setItem(data)
      } catch (caughtError) {
        const messageText =
          typeof caughtError === 'object' && caughtError !== null && 'message' in caughtError
            ? String(caughtError.message)
            : 'Failed to load request.'
        setError(messageText)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(timer)
  }, [])

  const handleEdit = () => {
    if (!item) return
    const status = String(item.status || 'pending').toLowerCase()
    if (status === 'completed') {
      setError('Completed requests can no longer be edited.')
      return
    }

    navigate('/app/create-request', {
      state: {
        editRequestId: id,
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

  return (
    <section className="panel">
      <div className="quick-actions">
        <button type="button" className="ghost-btn" onClick={() => navigate('/app/my-requests')}>
          Back to My Requests
        </button>
      </div>

      <h2>Request Details</h2>
      <p className="panel-sub">View full information for this blood request.</p>

      {loading ? <p className="panel-sub">Loading request...</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      {item ? (
        <>
          <div className="request-detail-grid">
            <div>
              <span>Patient Name</span>
              <strong>{item.patientName || '-'}</strong>
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
              <span>Blood Type Needed</span>
              <strong>{item.bloodTypeNeeded || '-'}</strong>
            </div>
            <div>
              <span>Urgency</span>
              <strong>{item.urgency || '-'}</strong>
            </div>
            <div>
              <span>Contact Number</span>
              <strong>{item.contactNumber || '-'}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{item.status || '-'}</strong>
            </div>
            <div>
              <span>Response Time</span>
              <strong className={`sla-pill ${getRequestSlaState(item, now).tone}`}>{getRequestSlaState(item, now).label}</strong>
            </div>
            <div>
              <span>Created At</span>
              <strong>{formatDate(item.createdAt)}</strong>
            </div>
            <div>
              <span>Accepted At</span>
              <strong>{formatDate(item.acceptedAt)}</strong>
            </div>
            <div>
              <span>Completed At</span>
              <strong>{formatDate(item.completedAt)}</strong>
            </div>
          </div>

          {Number.isFinite(Number(item.location?.latitude)) && Number.isFinite(Number(item.location?.longitude)) ? (
            <>
              <iframe
                title="request-detail-map"
                className="map-frame detail-map"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(item.location?.longitude) - 0.01}%2C${Number(item.location?.latitude) - 0.01}%2C${Number(item.location?.longitude) + 0.01}%2C${Number(item.location?.latitude) + 0.01}&layer=mapnik&marker=${Number(item.location?.latitude)}%2C${Number(item.location?.longitude)}`}
              />
              <a
                className="ghost-btn btn-link map-open-btn"
                href={`https://www.google.com/maps?q=${Number(item.location?.latitude)},${Number(item.location?.longitude)}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in Google Maps
              </a>
            </>
          ) : null}

          <div className="quick-actions">
            <Link to="/app/my-requests" className="ghost-btn btn-link">Back to My Requests</Link>
            {String(item.status || '').toLowerCase() !== 'completed' ? (
              <button type="button" className="solid-btn" onClick={handleEdit}>Edit Request</button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  )
}

export default RequestDetailPage

