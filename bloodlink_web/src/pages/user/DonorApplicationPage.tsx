import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, db, storage } from '@/lib/firebase'
import { createAdminNotification } from '@/utils/createAdminNotification'
import { syncPublicCityAvailability } from '../../utils/publicCityAvailability'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { useSmartBack } from '@/hooks/useSmartBack'

type DonorStatus = 'none' | 'pending' | 'verified' | 'rejected'
type AvailabilityStatus = 'available' | 'unavailable'

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

function parseStoredDate(value: unknown): Date | null {
  if (!value) return null
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
    const dateValue = value.toDate()
    return dateValue instanceof Date && !Number.isNaN(dateValue.getTime()) ? dateValue : null
  }
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function DonorApplicationPage() {
  const [fullName, setFullName] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [bloodType, setBloodType] = useState(BLOOD_TYPES[0])
  const [city, setCity] = useState('')
  const [street, setStreet] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [medicalCertificateURL, setMedicalCertificateURL] = useState('')
  const [validIdURL, setValidIdURL] = useState('')
  const [selectedCertificateFile, setSelectedCertificateFile] = useState<File | null>(null)
  const [selectedValidIdFile, setSelectedValidIdFile] = useState<File | null>(null)
  const [certificatePreviewUrl, setCertificatePreviewUrl] = useState('')
  const [validIdPreviewUrl, setValidIdPreviewUrl] = useState('')
  const [donorStatus, setDonorStatus] = useState<DonorStatus>('none')
  const [donorAvailability, setDonorAvailability] = useState<AvailabilityStatus>('unavailable')
  const [donationCooldownUntil, setDonationCooldownUntil] = useState<Date | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [editingVerifiedDonor, setEditingVerifiedDonor] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingCertificate, setUploadingCertificate] = useState(false)
  const [uploadingValidId, setUploadingValidId] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const { openConfirm, confirmDialog } = useConfirmDialog()
  const goBack = useSmartBack('/app/profile')

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const snapshot = await getDoc(doc(db, 'users', user.uid))
        const data = snapshot.data() as Record<string, unknown> | undefined
        if (!data) return

        setFullName(String(data.fullName || ''))
        setContactNumber(String(data.contactNumber || ''))
        setBloodType(String(data.bloodType || BLOOD_TYPES[0]))
        setCity(String(data.city || ''))
        setStreet(String(data.street || ''))
        setMedicalCertificateURL(String(data.medicalCertificateURL || ''))
        setValidIdURL(String(data.validIdURL || ''))
        setDonorStatus((String(data.donorStatus || 'none') as DonorStatus) || 'none')
        setDonorAvailability((String(data.availabilityStatus || 'unavailable') as AvailabilityStatus) || 'unavailable')
        setRejectionReason(String(data.donorVerificationRejectionReason || ''))
        setDonationCooldownUntil(parseStoredDate(data.donationCooldownUntil))

        const storedLocation = data.location as { latitude?: unknown; longitude?: unknown } | undefined
        const nextLatitude = typeof storedLocation?.latitude === 'number' ? String(storedLocation.latitude) : ''
        const nextLongitude = typeof storedLocation?.longitude === 'number' ? String(storedLocation.longitude) : ''
        setLatitude(nextLatitude)
        setLongitude(nextLongitude)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  useEffect(() => {
    return () => {
      if (certificatePreviewUrl) {
        URL.revokeObjectURL(certificatePreviewUrl)
      }
      if (validIdPreviewUrl) {
        URL.revokeObjectURL(validIdPreviewUrl)
      }
    }
  }, [certificatePreviewUrl, validIdPreviewUrl])

  const mapPreview = useMemo(() => {
    const latText = latitude.trim()
    const lngText = longitude.trim()
    if (!latText || !lngText) return null

    const lat = Number(latText)
    const lng = Number(lngText)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    const bbox = `${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}`
    return {
      lat,
      lng,
      src: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`,
    }
  }, [latitude, longitude])

  const donorStatusLabel = donorStatus === 'verified'
    ? 'Verified'
    : donorStatus === 'pending'
    ? 'Pending'
    : donorStatus === 'rejected'
    ? 'Rejected'
    : 'Not Applied'

  const parseLocationInput = () => {
    const latText = latitude.trim()
    const lngText = longitude.trim()

    if (!latText && !lngText) {
      return null
    }

    if (!latText || !lngText) {
      throw new Error('Enter both latitude and longitude, or leave both blank.')
    }

    const lat = Number(latText)
    const lng = Number(lngText)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error('Latitude and longitude must both be valid numbers.')
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error('Latitude must be between -90 and 90, and longitude must be between -180 and 180.')
    }

    return { latitude: lat, longitude: lng }
  }

  const handleFileSelection = (
    event: ChangeEvent<HTMLInputElement>,
    options: {
      label: string
      setFile: (file: File | null) => void
      previewUrl: string
      setPreviewUrl: (value: string) => void
    },
  ) => {
    const file = event.target.files?.[0] || null
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError(`Please choose an image file for the ${options.label.toLowerCase()}.`)
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      setError(`Please choose a ${options.label.toLowerCase()} image smaller than 8MB.`)
      return
    }

    setError('')
    options.setFile(file)

    if (options.previewUrl) {
      URL.revokeObjectURL(options.previewUrl)
    }
    options.setPreviewUrl(URL.createObjectURL(file))
  }

  const uploadVerificationImage = async (
    userId: string,
    options: {
      file: File | null
      currentUrl: string
      folder: string
      setUrl: (value: string) => void
      setFile: (value: File | null) => void
      previewUrl: string
      setPreviewUrl: (value: string) => void
      setUploading: (value: boolean) => void
    },
  ) => {
    if (!options.file) {
      return options.currentUrl.trim()
    }

    options.setUploading(true)
    try {
      const extension = options.file.name.split('.').pop() || 'jpg'
      const uploadRef = ref(storage, `${options.folder}/${userId}/${Date.now()}.${extension}`)
      await uploadBytes(uploadRef, options.file)
      const downloadURL = await getDownloadURL(uploadRef)
      options.setUrl(downloadURL)
      options.setFile(null)
      if (options.previewUrl) {
        URL.revokeObjectURL(options.previewUrl)
      }
      options.setPreviewUrl('')
      return downloadURL
    } finally {
      options.setUploading(false)
    }
  }

  const toggleDonorAvailability = async () => {
    const user = auth.currentUser
    if (!user) {
      setError('You must be logged in.')
      return
    }

    const next = donorAvailability === 'available' ? 'unavailable' : 'available'
    if (next === 'available' && donationCooldownUntil && donationCooldownUntil.getTime() > Date.now()) {
      setError(`Donation cooldown active until ${donationCooldownUntil.toLocaleString()}.`)
      setMessage('')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          availabilityStatus: next,
          availableSince: next === 'available' ? serverTimestamp() : null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      await syncPublicCityAvailability(db)

      setDonorAvailability(next)
      setMessage(`Donor availability is now ${next === 'available' ? 'ON' : 'OFF'}.`)
    } catch (caughtError) {
      const messageText =
        typeof caughtError === 'object' && caughtError !== null && 'message' in caughtError
          ? String(caughtError.message)
          : 'Failed to update donor availability.'
      setError(messageText)
    } finally {
      setSaving(false)
    }
  }

  const saveVerifiedDonorDetails = async () => {
    const user = auth.currentUser
    if (!user) {
      setError('You must be logged in.')
      return
    }

    if (!bloodType || !city.trim() || !contactNumber.trim()) {
      setError('Please complete blood type, city, and contact number before saving.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const location = parseLocationInput()
      await setDoc(
        doc(db, 'users', user.uid),
        {
          bloodType,
          city: city.trim(),
          street: street.trim() || null,
          contactNumber: contactNumber.trim(),
          location,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      await syncPublicCityAvailability(db)

      setEditingVerifiedDonor(false)
      setMessage('Donor details updated successfully.')
    } catch (caughtError) {
      const messageText =
        typeof caughtError === 'object' && caughtError !== null && 'message' in caughtError
          ? String(caughtError.message)
          : 'Failed to update donor details.'
      setError(messageText)
    } finally {
      setSaving(false)
    }
  }

  const submitDonorVerification = async () => {
    const user = auth.currentUser
    if (!user) {
      setError('You must be logged in.')
      return
    }

    if (!bloodType || !city.trim() || !contactNumber.trim()) {
      setError('Please complete blood type, city, and contact number before submitting.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const location = parseLocationInput()
      const certificateUrl = await uploadVerificationImage(user.uid, {
        file: selectedCertificateFile,
        currentUrl: medicalCertificateURL,
        folder: 'medicalCertificates',
        setUrl: setMedicalCertificateURL,
        setFile: setSelectedCertificateFile,
        previewUrl: certificatePreviewUrl,
        setPreviewUrl: setCertificatePreviewUrl,
        setUploading: setUploadingCertificate,
      })
      const nextValidIdUrl = await uploadVerificationImage(user.uid, {
        file: selectedValidIdFile,
        currentUrl: validIdURL,
        folder: 'validIds',
        setUrl: setValidIdURL,
        setFile: setSelectedValidIdFile,
        previewUrl: validIdPreviewUrl,
        setPreviewUrl: setValidIdPreviewUrl,
        setUploading: setUploadingValidId,
      })

      if (!certificateUrl) {
        setError('Please upload a medical certificate before submitting.')
        setSaving(false)
        return
      }

      if (!nextValidIdUrl) {
        setError('Please upload 1 valid ID before submitting.')
        setSaving(false)
        return
      }

      await setDoc(
        doc(db, 'users', user.uid),
        {
          bloodType,
          city: city.trim(),
          street: street.trim() || null,
          contactNumber: contactNumber.trim(),
          location,
          medicalCertificateURL: certificateUrl,
          validIdURL: nextValidIdUrl,
          donorStatus: 'pending',
          donorVerificationRejectionReason: null,
          availabilityStatus: 'unavailable',
          donorVerificationRequestedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      await syncPublicCityAvailability(db)

      await createAdminNotification(
        'donor_pending',
        'New Donor Verification Request',
        `${fullName || 'A user'} submitted donor verification (${bloodType}).`,
        {
          userId: user.uid,
          fullName: fullName || null,
          bloodType,
          city: city.trim(),
        },
      )

      setDonorStatus('pending')
      setDonorAvailability('unavailable')
      setRejectionReason('')
      setMessage('Donor verification request submitted. Please wait for admin review.')
    } catch (caughtError) {
      const messageText =
        typeof caughtError === 'object' && caughtError !== null && 'message' in caughtError
          ? String(caughtError.message)
          : 'Failed to submit donor verification.'
      setError(messageText)
    } finally {
      setSaving(false)
    }
  }

  const certificateImageSrc = certificatePreviewUrl || medicalCertificateURL
  const validIdImageSrc = validIdPreviewUrl || validIdURL
  const donorStatusTitle = donorStatus === 'verified'
    ? 'Verified donor account'
    : donorStatus === 'pending'
    ? 'Application under review'
    : donorStatus === 'rejected'
    ? 'Application needs updates'
    : 'Start your donor verification'
  const donorStatusMessage = donorStatus === 'verified'
    ? 'Keep your documents current and manage availability from one place.'
    : donorStatus === 'pending'
    ? 'Your details are already submitted. Admin just needs to finish the review.'
    : donorStatus === 'rejected'
    ? 'Refresh your files or donor details below, then send a new application.'
    : 'Upload your donor details, medical certificate, and 1 valid ID in one clean flow.'

  const confirmSubmitDonorVerification = () => {
    if (!bloodType || !city.trim() || !contactNumber.trim()) {
      setError('Please complete blood type, city, and contact number before submitting.')
      return
    }

    if (!selectedCertificateFile && !medicalCertificateURL.trim()) {
      setError('Please upload a medical certificate before submitting.')
      return
    }

    if (!selectedValidIdFile && !validIdURL.trim()) {
      setError('Please upload 1 valid ID before submitting.')
      return
    }

    openConfirm({
      title: 'Submit donor verification?',
      message: 'Your donor application will be sent to admin for review.',
      details: [
        `Blood Type: ${bloodType}`,
        `City: ${city.trim()}`,
        `Contact Number: ${contactNumber.trim()}`,
      ],
      tone: 'warning',
      confirmLabel: 'Submit Now',
      onConfirm: async () => {
        await submitDonorVerification()
      },
    })
  }

  return (
    <section className="panel donor-application-shell">
      <div className="quick-actions">
        <button type="button" className="ghost-btn" onClick={goBack}>Back</button>
      </div>

      <h2>Donor Application</h2>

      {loading ? <p className="panel-sub">Loading donor application...</p> : null}
      {message ? <p className="auth-message auth-message-info">{message}</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      <div className="donor-section donor-application-card donor-hero-card">
        <div className="donor-hero-head">
          <div className="donor-hero-copy">
            <span className="donor-kicker">Donor Verification</span>
            <h3>{donorStatusTitle}</h3>
            <p>{donorStatusMessage}</p>
          </div>
          <span className={`status-pill ${donorStatus}`}>{donorStatusLabel}</span>
        </div>

        <div className="donor-requirements-grid">
          <div className={`donor-requirement-card${certificateImageSrc ? ' complete' : ''}`}>
            <span className="donor-requirement-label">Medical Certificate</span>
            <strong>{certificateImageSrc ? 'Uploaded' : 'Required'}</strong>
          </div>
          <div className={`donor-requirement-card${validIdImageSrc ? ' complete' : ''}`}>
            <span className="donor-requirement-label">1 Valid ID</span>
            <strong>{validIdImageSrc ? 'Uploaded' : 'Required'}</strong>
          </div>
          <div className={`donor-requirement-card${mapPreview ? ' complete optional' : ' optional'}`}>
            <span className="donor-requirement-label">Map Pin</span>
            <strong>{mapPreview ? 'Added' : 'Optional'}</strong>
          </div>
        </div>

        {donorStatus === 'verified' ? (
          <>
            <div className="donor-note-banner">
              Your donor account is verified. You can still refresh donor details or replace uploaded files here.
            </div>
            {donationCooldownUntil && donationCooldownUntil.getTime() > Date.now() ? (
              <div className="donor-note-banner warning">
                Cooldown active until {donationCooldownUntil.toLocaleString()}.
              </div>
            ) : null}
          </>
        ) : null}

        {donorStatus === 'pending' ? (
          <div className="donor-note-banner warning">
            Your donor verification request is under admin review.
          </div>
        ) : null}

        {donorStatus === 'rejected' ? (
          <>
            <div className="donor-note-banner danger">
              Your previous donor application was rejected. Review the reason, update the files below, then apply again.
            </div>
            {rejectionReason ? <p className="panel-sub donor-reason">Reason: {rejectionReason}</p> : null}
          </>
        ) : null}
      </div>

      {(donorStatus === 'none' || donorStatus === 'rejected') ? (
        <div className="donor-section donor-application-card">
          <h3>Before You Submit</h3>
          <div className="donor-checklist">
            <div className="donor-checklist-item">
              <strong>Medical Certificate</strong>
              <span>Upload a readable, recent image.</span>
            </div>
            <div className="donor-checklist-item">
              <strong>1 Valid ID</strong>
              <span>Upload one government or school ID image.</span>
            </div>
            <div className="donor-checklist-item">
              <strong>Location Pin</strong>
              <span>Optional, but helpful for donor search and routing.</span>
            </div>
          </div>
        </div>
      ) : null}

      {donorStatus === 'verified' ? (
        <div className="donor-section donor-application-card">
          <div className="donor-status-row">
            <h3>Verified Donor Tools</h3>
          </div>

          <div className="donor-actions-wrap">
            <button type="button" className="ghost-btn" onClick={() => void toggleDonorAvailability()} disabled={saving}>
              {saving
                ? 'Saving...'
                : donorAvailability === 'available'
                ? 'ON - Available to Donate'
                : 'OFF - Unavailable'}
            </button>
            {medicalCertificateURL ? (
              <a className="ghost-btn btn-link" href={medicalCertificateURL} target="_blank" rel="noreferrer">
                View Medical Certificate
              </a>
            ) : null}
            {validIdURL ? (
              <a className="ghost-btn btn-link" href={validIdURL} target="_blank" rel="noreferrer">
                View Valid ID
              </a>
            ) : null}
          </div>

          {!editingVerifiedDonor ? (
            <>
              <div className="donor-summary-grid">
                <div className="donor-summary-item">
                  <span>Blood Type</span>
                  <strong>{bloodType || 'Not set'}</strong>
                </div>
                <div className="donor-summary-item">
                  <span>Availability</span>
                  <strong>{donorAvailability === 'available' ? 'Available' : 'Unavailable'}</strong>
                </div>
                <div className="donor-summary-item">
                  <span>City</span>
                  <strong>{city || 'Not set'}</strong>
                </div>
                <div className="donor-summary-item">
                  <span>Contact Number</span>
                  <strong>{contactNumber || 'Not set'}</strong>
                </div>
                <div className="donor-summary-item">
                  <span>Street / Landmark</span>
                  <strong>{street || 'Not set'}</strong>
                </div>
              </div>

              {mapPreview ? (
                <div className="donor-map-preview">
                  <iframe title="donor-map-preview" className="map-frame" src={mapPreview.src} />
                </div>
              ) : null}

              <div className="document-upload-grid donor-doc-grid">
                <div className="document-upload-card">
                  <h4>Medical Certificate</h4>
                  <p>Keep a clear certificate image on file for admin review.</p>
                  {certificateImageSrc ? <div className="certificate-preview-card"><img src={certificateImageSrc} alt="Medical certificate preview" /></div> : null}
                </div>

                <div className="document-upload-card">
                  <h4>1 Valid ID</h4>
                  <p>Keep one clear ID image on file for identity confirmation.</p>
                  {validIdImageSrc ? <div className="certificate-preview-card"><img src={validIdImageSrc} alt="Valid ID preview" /></div> : null}
                </div>
              </div>

              <div className="donor-actions-wrap">
                <button type="button" className="solid-btn" onClick={() => setEditingVerifiedDonor(true)}>
                  Edit Donor Details
                </button>
              </div>
            </>
          ) : (
            <div className="auth-form donor-form-grid">
              <div>
                <label htmlFor="donor-verified-blood">Blood Type</label>
                <select id="donor-verified-blood" value={bloodType} onChange={(event) => setBloodType(event.target.value)}>
                  {BLOOD_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="donor-verified-city">City</label>
                <input id="donor-verified-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Manila" />
              </div>

              <div>
                <label htmlFor="donor-verified-contact">Contact Number</label>
                <input id="donor-verified-contact" value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} placeholder="09XXXXXXXXX" />
              </div>

              <div className="field-span-2">
                <label htmlFor="donor-verified-street">Street / Landmark</label>
                <input id="donor-verified-street" value={street} onChange={(event) => setStreet(event.target.value)} placeholder="Optional" />
              </div>

              <div>
                <label htmlFor="donor-verified-latitude">Latitude</label>
                <input id="donor-verified-latitude" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="Optional" />
              </div>

              <div>
                <label htmlFor="donor-verified-longitude">Longitude</label>
                <input id="donor-verified-longitude" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="Optional" />
              </div>

              {mapPreview ? (
                <div className="field-span-2 donor-map-preview">
                  <iframe title="donor-verified-map" className="map-frame" src={mapPreview.src} />
                </div>
              ) : null}

              <div className="field-span-2 donor-actions-wrap">
                <button type="button" className="solid-btn" onClick={() => void saveVerifiedDonorDetails()} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Donor Details'}
                </button>
                <button type="button" className="ghost-btn" onClick={() => setEditingVerifiedDonor(false)} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {(donorStatus === 'none' || donorStatus === 'rejected') ? (
        <div className="donor-section donor-application-card">
          <h3>Apply for Verification</h3>
          <div className="auth-form donor-form-grid">
            <div>
              <label htmlFor="donor-apply-blood">Blood Type</label>
              <select id="donor-apply-blood" value={bloodType} onChange={(event) => setBloodType(event.target.value)}>
                {BLOOD_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="donor-apply-city">City</label>
              <input id="donor-apply-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Manila" />
            </div>

            <div>
              <label htmlFor="donor-apply-contact">Contact Number</label>
              <input id="donor-apply-contact" value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} placeholder="09XXXXXXXXX" />
            </div>

            <div className="field-span-2">
              <label htmlFor="donor-apply-street">Street / Landmark</label>
              <input id="donor-apply-street" value={street} onChange={(event) => setStreet(event.target.value)} placeholder="Optional" />
            </div>

            <div>
              <label htmlFor="donor-apply-latitude">Latitude</label>
              <input id="donor-apply-latitude" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="Optional" />
            </div>

            <div>
              <label htmlFor="donor-apply-longitude">Longitude</label>
              <input id="donor-apply-longitude" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="Optional" />
            </div>

            {mapPreview ? (
              <div className="field-span-2 donor-map-preview">
                <iframe title="donor-apply-map" className="map-frame" src={mapPreview.src} />
              </div>
            ) : null}

            <div className="field-span-2 document-upload-grid">
              <div className="document-upload-card">
                <h4>Medical Certificate</h4>
                <p>Upload a clear image of your medical certificate.</p>
                <input
                  id="donor-certificate-file"
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    handleFileSelection(event, {
                      label: 'Medical Certificate',
                      setFile: setSelectedCertificateFile,
                      previewUrl: certificatePreviewUrl,
                      setPreviewUrl: setCertificatePreviewUrl,
                    })
                  }
                />
                {certificateImageSrc ? (
                  <div className="certificate-preview-card">
                    <img src={certificateImageSrc} alt="Medical certificate preview" />
                  </div>
                ) : null}
              </div>

              <div className="document-upload-card">
                <h4>1 Valid ID</h4>
                <p>Upload one government or school ID image.</p>
                <input
                  id="donor-valid-id-file"
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    handleFileSelection(event, {
                      label: 'Valid ID',
                      setFile: setSelectedValidIdFile,
                      previewUrl: validIdPreviewUrl,
                      setPreviewUrl: setValidIdPreviewUrl,
                    })
                  }
                />
                {validIdImageSrc ? (
                  <div className="certificate-preview-card">
                    <img src={validIdImageSrc} alt="Valid ID preview" />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="field-span-2 donor-actions-wrap">
              <button
                type="button"
                className="solid-btn"
                onClick={confirmSubmitDonorVerification}
                disabled={saving || uploadingCertificate || uploadingValidId || !contactNumber.trim()}
              >
                {saving || uploadingCertificate || uploadingValidId ? 'Submitting...' : 'Submit for Verification'}
              </button>
              {medicalCertificateURL ? (
                <a className="ghost-btn btn-link" href={medicalCertificateURL} target="_blank" rel="noreferrer">
                  View Current Certificate
                </a>
              ) : null}
              {validIdURL ? (
                <a className="ghost-btn btn-link" href={validIdURL} target="_blank" rel="noreferrer">
                  View Current Valid ID
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {(donorStatus === 'pending' || donorStatus === 'verified') && (medicalCertificateURL || validIdURL) ? (
        <div className="donor-section donor-application-card">
          <h3>Verification Documents</h3>
          <div className="document-upload-grid donor-doc-grid">
            {medicalCertificateURL ? (
              <div className="document-upload-card">
                <h4>Medical Certificate</h4>
                <div className="certificate-preview-card">
                  <img src={medicalCertificateURL} alt="Medical certificate" />
                </div>
                <div className="donor-actions-wrap">
                  <a className="ghost-btn btn-link" href={medicalCertificateURL} target="_blank" rel="noreferrer">
                    Open Certificate
                  </a>
                </div>
              </div>
            ) : null}

            {validIdURL ? (
              <div className="document-upload-card">
                <h4>1 Valid ID</h4>
                <div className="certificate-preview-card">
                  <img src={validIdURL} alt="Valid ID" />
                </div>
                <div className="donor-actions-wrap">
                  <a className="ghost-btn btn-link" href={validIdURL} target="_blank" rel="noreferrer">
                    Open Valid ID
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {confirmDialog}
    </section>
  )
}

export default DonorApplicationPage
