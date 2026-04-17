import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { syncPublicCityAvailability } from '../../utils/publicCityAvailability'
import { buildSlaDeadlineDate, getSlaMinutes } from '../../utils/requestSla'

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const URGENCY_LEVELS = ['Normal', 'Urgent', 'Critical']

type DonorContext = {
  donorId?: string
  fullName?: string
  bloodType?: string
  contactNumber?: string
  city?: string
  location?: { latitude?: number; longitude?: number } | null
}

type RequestDraft = {
  patientName?: string
  hospital?: string
  city?: string
  bloodType?: string
  urgency?: string
  contactNumber?: string
  selectedLocation?: { latitude?: number; longitude?: number } | null
  selectedLocationLabel?: string
}

type CreateRequestState = {
  fromFindDonor?: boolean
  donorContext?: DonorContext
  editRequestId?: string
  originalStatus?: string
  draft?: RequestDraft
}

function getConversationId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join('_')
}

function CreateRequestPage() {
  const navigate = useNavigate()
  const locationState = useLocation().state as CreateRequestState | null
  const donorContext = locationState?.fromFindDonor ? locationState?.donorContext || null : null

  const editRequestId = locationState?.editRequestId || null
  const originalStatus = String(locationState?.originalStatus || 'pending').toLowerCase()
  const draft = locationState?.draft || {}
  const isEditMode = Boolean(editRequestId)

  const [patientName, setPatientName] = useState(String(draft.patientName || ''))
  const [hospital, setHospital] = useState(String(draft.hospital || ''))
  const [city, setCity] = useState(String(draft.city || ''))
  const [bloodType, setBloodType] = useState(String(draft.bloodType || donorContext?.bloodType || BLOOD_TYPES[0]))
  const [urgency, setUrgency] = useState(String(draft.urgency || URGENCY_LEVELS[0]))
  const [contactNumber, setContactNumber] = useState(String(draft.contactNumber || ''))
  const [latitude, setLatitude] = useState(String(draft.selectedLocation?.latitude || ''))
  const [longitude, setLongitude] = useState(String(draft.selectedLocation?.longitude || ''))
  const [locationLabel, setLocationLabel] = useState(String(draft.selectedLocationLabel || ''))
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!donorContext || isEditMode) return
    if (donorContext.bloodType) setBloodType(String(donorContext.bloodType))
  }, [donorContext, isEditMode])

  const mapPreview = useMemo(() => {
    const lat = Number(latitude)
    const lng = Number(longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    const bbox = `${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}`
    return { lat, lng, src: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}` }
  }, [latitude, longitude])

  const donorMapPreview = useMemo(() => {
    if (!donorContext) return null
    const lat = Number(donorContext.location?.latitude)
    const lng = Number(donorContext.location?.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    const bbox = `${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}`
    return {
      lat,
      lng,
      src: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`,
    }
  }, [donorContext])

  const reset = () => {
    setPatientName('')
    setHospital('')
    setCity('')
    setBloodType(donorContext?.bloodType || BLOOD_TYPES[0])
    setUrgency(URGENCY_LEVELS[0])
    setContactNumber('')
    setLatitude('')
    setLongitude('')
    setLocationLabel('')
  }

  const useDonorLocation = () => {
    if (!donorMapPreview) {
      setError('Selected donor has no pinned location.')
      return
    }

    if (donorContext?.city) setCity(String(donorContext.city))
    setLatitude(String(donorMapPreview.lat))
    setLongitude(String(donorMapPreview.lng))
    setLocationLabel(`Near donor: ${donorContext?.fullName || 'Donor'}`)
    setError('')
  }

  const startChatWithDonor = async () => {
    const user = auth.currentUser
    const donorId = donorContext?.donorId
    if (!user || !donorId) {
      setError('Unable to start chat for this donor.')
      return
    }

    try {
      const conversationId = getConversationId(user.uid, donorId)
      const ref = doc(db, 'conversations', conversationId)
      const snapshot = await getDoc(ref)
      if (!snapshot.exists()) {
        await setDoc(ref, {
          participants: [user.uid, donorId],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
      setMessage('Conversation is ready. Open the floating message icon to chat.')
    } catch (caughtError) {
      const messageText =
        typeof caughtError === 'object' && caughtError !== null && 'message' in caughtError
          ? String(caughtError.message)
          : 'Failed to start chat.'
      setError(messageText)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!patientName.trim() || !hospital.trim() || !city.trim() || !contactNumber.trim()) {
      setError('Please fill all required fields.')
      return
    }

    const user = auth.currentUser
    if (!user) {
      setError('You must be logged in.')
      return
    }

    const lat = Number(latitude)
    const lng = Number(longitude)
    const hasLocation = Number.isFinite(lat) && Number.isFinite(lng)

    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (isEditMode && editRequestId) {
        const payload: Record<string, unknown> = {
          patientName: patientName.trim(),
          hospital: hospital.trim(),
          city: city.trim(),
          bloodTypeNeeded: bloodType,
          urgency,
          contactNumber: contactNumber.trim(),
          location: hasLocation ? { latitude: lat, longitude: lng } : null,
          locationLabel: locationLabel.trim() || (hasLocation ? city.trim() : null),
          updatedAt: serverTimestamp(),
        }

        if (originalStatus === 'pending') {
          payload.slaDeadlineAt = buildSlaDeadlineDate(urgency)
        }

        await updateDoc(doc(db, 'requests', editRequestId), payload)
        await syncPublicCityAvailability(db)
        navigate(`/app/my-requests/${editRequestId}`)
        return
      }

      await addDoc(collection(db, 'requests'), {
        requesterId: user.uid,
        patientName: patientName.trim(),
        hospital: hospital.trim(),
        city: city.trim(),
        bloodTypeNeeded: bloodType,
        urgency,
        contactNumber: contactNumber.trim(),
        location: hasLocation ? { latitude: lat, longitude: lng } : null,
        locationLabel: locationLabel.trim() || (hasLocation ? city.trim() : null),
        status: 'pending',
        createdAt: serverTimestamp(),
        slaDeadlineAt: buildSlaDeadlineDate(urgency),
      })
      await syncPublicCityAvailability(db)

      setMessage('Request submitted successfully.')
      reset()
    } catch (caughtError) {
      const messageText =
        typeof caughtError === 'object' && caughtError !== null && 'message' in caughtError
          ? String(caughtError.message)
          : isEditMode
          ? 'Failed to update request.'
          : 'Failed to submit request.'
      setError(messageText)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel">
      <div className="quick-actions">
        <button type="button" className="ghost-btn" onClick={() => navigate('/app/my-requests')}>
          Back to My Requests
        </button>
      </div>

      <h2>{isEditMode ? 'Edit Blood Request' : 'Create Blood Request'}</h2>
      <p className="panel-sub">
        {isEditMode
          ? 'Update details so donors get the latest information.'
          : 'Share accurate details so nearby donors can respond quickly.'}
      </p>

      {message ? <p className="auth-message auth-message-info">{message}</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      {donorContext ? (
        <div className="donor-assist-card">
          <h3>Selected Donor</h3>
          <p>{donorContext.fullName || 'Donor'} | {donorContext.bloodType || 'N/A'}</p>
          <p>{donorContext.city || 'Unknown City'}</p>

          <div className="request-actions">
            <button type="button" className="ghost-btn" onClick={() => void startChatWithDonor()}>
              Chat
            </button>
          </div>

          {donorMapPreview ? (
            <>
              <iframe title="selected-donor-map" className="map-frame" src={donorMapPreview.src} />
              <div className="request-actions">
                <button type="button" className="ghost-btn" onClick={useDonorLocation}>
                  Use Donor Location
                </button>
                <a
                  className="ghost-btn btn-link map-open-btn"
                  href={`https://www.google.com/maps?q=${donorMapPreview.lat},${donorMapPreview.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Donor Map
                </a>
              </div>
            </>
          ) : (
            <p className="panel-sub">Selected donor has no pinned map location.</p>
          )}
        </div>
      ) : null}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="request-patient">Patient Name</label>
        <input id="request-patient" value={patientName} onChange={(event) => setPatientName(event.target.value)} required />

        <label htmlFor="request-hospital">Hospital</label>
        <input id="request-hospital" value={hospital} onChange={(event) => setHospital(event.target.value)} required />

        <label htmlFor="request-city">City</label>
        <input id="request-city" value={city} onChange={(event) => setCity(event.target.value)} required />

        <label htmlFor="request-blood">Blood Type Needed</label>
        <select id="request-blood" value={bloodType} onChange={(event) => setBloodType(event.target.value)}>
          {BLOOD_TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <label htmlFor="request-urgency">Urgency</label>
        <select id="request-urgency" value={urgency} onChange={(event) => setUrgency(event.target.value)}>
          {URGENCY_LEVELS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <p className="panel-sub">Target response time: this request should be accepted within {getSlaMinutes(urgency)} minutes.</p>

        <label htmlFor="request-contact">Contact Number</label>
        <input
          id="request-contact"
          value={contactNumber}
          onChange={(event) => setContactNumber(event.target.value)}
          placeholder="e.g. 09123456789"
          required
        />

        <div className="map-input-grid">
          <div>
            <label htmlFor="request-lat">Latitude (optional)</label>
            <input
              id="request-lat"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              placeholder="e.g. 14.5995"
            />
          </div>
          <div>
            <label htmlFor="request-lng">Longitude (optional)</label>
            <input
              id="request-lng"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              placeholder="e.g. 120.9842"
            />
          </div>
        </div>

        <label htmlFor="request-location-label">Location Label (optional)</label>
        <input
          id="request-location-label"
          value={locationLabel}
          onChange={(event) => setLocationLabel(event.target.value)}
          placeholder="e.g. Near ER entrance"
        />

        {mapPreview ? (
          <>
            <iframe title="request-map-preview" className="map-frame" src={mapPreview.src} />
            <a
              className="ghost-btn btn-link map-open-btn"
              href={`https://www.google.com/maps?q=${mapPreview.lat},${mapPreview.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps
            </a>
          </>
        ) : null}

        <button type="submit" className="solid-btn auth-submit" disabled={loading}>
          {loading ? (isEditMode ? 'Saving...' : 'Submitting...') : isEditMode ? 'Save Changes' : 'Submit Request'}
        </button>
      </form>

      {!isEditMode ? (
        <div className="utility-actions">
          <Link to="/app/search-donors" className="ghost-btn btn-link">Back to Find Donors</Link>
        </div>
      ) : null}
    </section>
  )
}

export default CreateRequestPage


