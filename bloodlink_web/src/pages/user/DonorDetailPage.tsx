import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

type DonorDetail = {
  id: string
  fullName?: string
  email?: string
  contactNumber?: string
  bloodType?: string
  city?: string
  gender?: string
  donorStatus?: string
  availabilityStatus?: string
  photoURL?: string
  medicalCertificateURL?: string
  location?: { latitude?: number; longitude?: number } | null
}

function getDefaultAvatar(gender?: string) {
  if (String(gender || '').toLowerCase() === 'female') return '/Female_Default_Profile.png'
  return '/Male_Default_Profile.png'
}

function DonorDetailPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const [item, setItem] = useState<DonorDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showRequestConfirm, setShowRequestConfirm] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setLoading(false)
        setError('Donor not found.')
        return
      }

      setLoading(true)
      setError('')
      try {
        const donorSnap = await getDoc(doc(db, 'users', id))
        if (!donorSnap.exists()) {
          setError('Donor not found.')
          return
        }

        setItem({ id: donorSnap.id, ...(donorSnap.data() as Omit<DonorDetail, 'id'>) })
      } catch (caughtError) {
        const messageText =
          typeof caughtError === 'object' && caughtError !== null && 'message' in caughtError
            ? String(caughtError.message)
            : 'Failed to load donor details.'
        setError(messageText)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id])

  const openCreateRequest = () => {
    if (!item) return

    const latitude = Number(item.location?.latitude)
    const longitude = Number(item.location?.longitude)

    navigate('/app/create-request', {
      state: {
        fromFindDonor: true,
        donorContext: {
          donorId: item.id,
          fullName: item.fullName || item.email || 'Donor',
          bloodType: item.bloodType || '',
          contactNumber: item.contactNumber || '',
          city: item.city || '',
          location:
            Number.isFinite(latitude) && Number.isFinite(longitude)
              ? { latitude, longitude }
              : null,
        },
      },
    })
  }

  const latitude = Number(item?.location?.latitude)
  const longitude = Number(item?.location?.longitude)
  const hasMap = Number.isFinite(latitude) && Number.isFinite(longitude)

  return (
    <section className="panel">
      <div className="quick-actions">
        <button type="button" className="ghost-btn" onClick={() => navigate('/app/search-donors')}>
          Back to Find Donors
        </button>
      </div>

      <h2>Donor Details</h2>
      <p className="panel-sub">Review donor information before sending a request.</p>

      {loading ? <p className="panel-sub">Loading donor details...</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      {item ? (
        <>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
            <img
              src={item.photoURL?.trim() || getDefaultAvatar(item.gender)}
              alt={item.fullName || item.email || 'Donor'}
              style={{ width: '96px', height: '96px', borderRadius: '24px', objectFit: 'cover', border: '1px solid rgba(148, 163, 184, 0.4)' }}
            />
            <div>
              <h3 style={{ margin: 0 }}>{item.fullName || item.email || 'Donor'}</h3>
              <p className="panel-sub" style={{ margin: '6px 0 0' }}>
                {item.donorStatus === 'verified' ? 'Verified donor' : 'Pending donor verification'}
              </p>
            </div>
          </div>

          <div className="request-detail-grid">
            <div>
              <span>Blood Type</span>
              <strong>{item.bloodType || '-'}</strong>
            </div>
            <div>
              <span>Availability</span>
              <strong>{item.availabilityStatus || '-'}</strong>
            </div>
            <div>
              <span>City</span>
              <strong>{item.city || '-'}</strong>
            </div>
            <div>
              <span>Contact Number</span>
              <strong>{item.contactNumber || '-'}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{item.email || '-'}</strong>
            </div>
            <div>
              <span>Medical Certificate</span>
              <strong>{item.medicalCertificateURL ? 'Uploaded' : 'Not uploaded'}</strong>
            </div>
          </div>

          <div className="quick-actions">
            <button type="button" className="solid-btn" onClick={() => setShowRequestConfirm(true)}>
              Request Blood
            </button>
            {item.medicalCertificateURL ? (
              <a className="ghost-btn btn-link" href={item.medicalCertificateURL} target="_blank" rel="noreferrer">
                View Certificate
              </a>
            ) : null}
          </div>

          {hasMap ? (
            <>
              <iframe
                title={`donor-map-${item.id}`}
                className="map-frame"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${latitude + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}`}
              />
              <div className="quick-actions">
                <a
                  className="ghost-btn btn-link map-open-btn"
                  href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Google Maps
                </a>
              </div>
            </>
          ) : (
            <p className="panel-sub">This donor has not shared a map pin yet.</p>
          )}
        </>
      ) : null}

      {showRequestConfirm && item ? (
        <div className="info-modal-overlay" role="presentation" onClick={() => setShowRequestConfirm(false)}>
          <div
            className="info-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="donor-request-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="info-modal-head">
              <h3 id="donor-request-confirm-title">Create Request</h3>
              <button type="button" className="ghost-btn info-modal-close" onClick={() => setShowRequestConfirm(false)}>
                Close
              </button>
            </div>
            <div className="info-modal-body">
              <p>{`Create a blood request using ${item.fullName || item.email || 'this donor'} as the selected donor reference?`}</p>
              <div className="quick-actions">
                <button type="button" className="ghost-btn" onClick={() => setShowRequestConfirm(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="solid-btn"
                  onClick={() => {
                    setShowRequestConfirm(false)
                    openCreateRequest()
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default DonorDetailPage
