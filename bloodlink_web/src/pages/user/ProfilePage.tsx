import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { updateProfile } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, db, storage } from '@/lib/firebase'
import { syncPublicCityAvailability } from '../../utils/publicCityAvailability'

type Gender = 'male' | 'female' | 'other' | ''
type DonorStatus = 'none' | 'pending' | 'verified' | 'rejected'
type AvailabilityStatus = 'available' | 'unavailable'

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

function getDefaultAvatar(gender: Gender) {
  if (gender === 'female') return '/Female_Default_Profile.png'
  return '/Male_Default_Profile.png'
}

function ProfilePage() {
  const [fullName, setFullName] = useState('')
  const [gender, setGender] = useState<Gender>('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [bloodType, setBloodType] = useState(BLOOD_TYPES[0])
  const [city, setCity] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [photoURL, setPhotoURL] = useState('')
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')
  const [medicalCertificateURL, setMedicalCertificateURL] = useState('')
  const [donorStatus, setDonorStatus] = useState<DonorStatus>('none')
  const [donorAvailability, setDonorAvailability] = useState<AvailabilityStatus>('unavailable')
  const [rejectionReason, setRejectionReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingDonor, setSavingDonor] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

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
        setPhotoURL(String(user.photoURL || ''))

        if (data) {
          setFullName(String(data.fullName || ''))
          setGender((String(data.gender || '') as Gender) || '')
          setDateOfBirth(String(data.dateOfBirth || '').slice(0, 10))
          setBloodType(String(data.bloodType || BLOOD_TYPES[0]))
          setCity(String(data.city || ''))
          setContactNumber(String(data.contactNumber || ''))
          setPhotoURL(String(data.photoURL || user.photoURL || ''))
          setMedicalCertificateURL(String(data.medicalCertificateURL || ''))
          setDonorStatus((String(data.donorStatus || 'none') as DonorStatus) || 'none')
          setDonorAvailability((String(data.availabilityStatus || 'unavailable') as AvailabilityStatus) || 'unavailable')
          setRejectionReason(String(data.donorVerificationRejectionReason || ''))
        }
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl)
      }
    }
  }, [photoPreviewUrl])

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!fullName.trim() || !gender || !dateOfBirth) {
      setError('Please complete full name, gender, and date of birth.')
      return
    }

    const user = auth.currentUser
    if (!user) {
      setError('You must be logged in.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      let nextPhotoURL = photoURL
      if (selectedPhotoFile) {
        const extension = selectedPhotoFile.name.split('.').pop() || 'jpg'
        const uploadRef = ref(storage, `profilePhotos/${user.uid}/${Date.now()}.${extension}`)
        await uploadBytes(uploadRef, selectedPhotoFile)
        nextPhotoURL = await getDownloadURL(uploadRef)
        await updateProfile(user, { photoURL: nextPhotoURL })
      }

      await setDoc(
        doc(db, 'users', user.uid),
        {
          email: user.email,
          fullName: fullName.trim(),
          gender,
          dateOfBirth,
          bloodType,
          city: city.trim(),
          contactNumber: contactNumber.trim(),
          photoURL: nextPhotoURL,
          updatedAt: new Date(),
        },
        { merge: true },
      )
      await syncPublicCityAvailability(db)

      setPhotoURL(nextPhotoURL)
      setSelectedPhotoFile(null)
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl)
      }
      setPhotoPreviewUrl('')
      window.dispatchEvent(new Event('profile-updated'))
      setMessage('Profile updated successfully.')
    } catch (caughtError) {
      const messageText =
        typeof caughtError === 'object' && caughtError !== null && 'message' in caughtError
          ? String(caughtError.message)
          : 'Failed to update profile.'
      setError(messageText)
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoSelection = (file: File | null) => {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file for your profile picture.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Please choose an image smaller than 5MB.')
      return
    }

    setError('')
    setSelectedPhotoFile(file)
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl)
    }
    setPhotoPreviewUrl(URL.createObjectURL(file))
  }

  const toggleDonorAvailability = async () => {
    const user = auth.currentUser
    if (!user) {
      setError('You must be logged in.')
      return
    }

    const next = donorAvailability === 'available' ? 'unavailable' : 'available'
    setSavingDonor(true)
    setError('')
    setMessage('')

    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          availabilityStatus: next,
          availableSince: next === 'available' ? new Date() : null,
          updatedAt: new Date(),
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
      setSavingDonor(false)
    }
  }

  const submitDonorVerification = async () => {
    const user = auth.currentUser
    if (!user) {
      setError('You must be logged in.')
      return
    }

    if (!bloodType || !city.trim() || !medicalCertificateURL.trim()) {
      setError('Please complete blood type, city, and certificate URL before submitting.')
      return
    }

    setSavingDonor(true)
    setError('')
    setMessage('')

    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          bloodType,
          city: city.trim(),
          medicalCertificateURL: medicalCertificateURL.trim(),
          donorStatus: 'pending',
          availabilityStatus: 'unavailable',
          donorVerificationRequestedAt: new Date(),
          updatedAt: new Date(),
        },
        { merge: true },
      )
      await syncPublicCityAvailability(db)

      setDonorStatus('pending')
      setDonorAvailability('unavailable')
      setMessage('Donor verification request submitted. Please wait for admin review.')
    } catch (caughtError) {
      const messageText =
        typeof caughtError === 'object' && caughtError !== null && 'message' in caughtError
          ? String(caughtError.message)
          : 'Failed to submit donor verification.'
      setError(messageText)
    } finally {
      setSavingDonor(false)
    }
  }

  const donorStatusLabel = donorStatus === 'verified'
    ? 'Verified'
    : donorStatus === 'pending'
    ? 'Pending'
    : donorStatus === 'rejected'
    ? 'Rejected'
    : 'Not Applied'
  const profileImageSrc = photoPreviewUrl || photoURL || getDefaultAvatar(gender)

  return (
    <section className="panel">
      <h2>My Profile</h2>
      <p className="panel-sub">Keep your profile updated for better donor/request matching.</p>

      {loading ? <p className="panel-sub">Loading profile...</p> : null}
      {message ? <p className="auth-message auth-message-info">{message}</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      <form className="auth-form" onSubmit={handleSave}>
        <div className="profile-photo-block">
          <img src={profileImageSrc} alt="Profile" className="profile-photo-preview" />
          <label htmlFor="profile-photo" className="ghost-btn btn-link profile-photo-upload">
            Choose Profile Picture
          </label>
          <input
            id="profile-photo"
            type="file"
            accept="image/*"
            className="profile-photo-input"
            onChange={(event) => handlePhotoSelection(event.target.files?.[0] || null)}
          />
        </div>

        <label htmlFor="profile-full-name">Full Name</label>
        <input id="profile-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />

        <label htmlFor="profile-gender">Gender</label>
        <select id="profile-gender" value={gender} onChange={(event) => setGender(event.target.value as Gender)} required>
          <option value="">Select gender...</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>

        <label htmlFor="profile-dob">Date of Birth</label>
        <input
          id="profile-dob"
          type="date"
          value={dateOfBirth}
          onChange={(event) => setDateOfBirth(event.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          required
        />

        <label htmlFor="profile-blood">Blood Type</label>
        <select id="profile-blood" value={bloodType} onChange={(event) => setBloodType(event.target.value)}>
          {BLOOD_TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <label htmlFor="profile-city">City</label>
        <input id="profile-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Manila" />

        <label htmlFor="profile-contact">Contact Number</label>
        <input
          id="profile-contact"
          value={contactNumber}
          onChange={(event) => setContactNumber(event.target.value)}
          placeholder="e.g. 09123456789"
        />

        <button type="submit" className="solid-btn auth-submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>

      <div className="donor-section">
        <div className="donor-status-row">
          <h3>Donor Status</h3>
          <span className={`status-pill ${donorStatus}`}>{donorStatusLabel}</span>
        </div>

        {donorStatus === 'verified' ? (
          <div className="donor-actions-wrap">
            <p className="panel-sub">Your donor profile is verified. Toggle your availability anytime.</p>
            <button type="button" className="ghost-btn" onClick={() => void toggleDonorAvailability()} disabled={savingDonor}>
              {savingDonor
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
          </div>
        ) : null}

        {donorStatus === 'pending' ? (
          <p className="panel-sub">Your donor verification request is under admin review.</p>
        ) : null}

        {donorStatus === 'rejected' ? (
          <div className="donor-actions-wrap">
            <p className="panel-sub">Your previous donor application was rejected. Update your details and submit again.</p>
            {rejectionReason ? <p className="panel-sub">Reason: {rejectionReason}</p> : null}
          </div>
        ) : null}

        {(donorStatus === 'none' || donorStatus === 'rejected') ? (
          <div className="auth-form donor-apply-form">
            <label htmlFor="profile-cert-url">Medical Certificate URL</label>
            <input
              id="profile-cert-url"
              value={medicalCertificateURL}
              onChange={(event) => setMedicalCertificateURL(event.target.value)}
              placeholder="Paste uploaded certificate URL"
            />

            <button type="button" className="solid-btn auth-submit" onClick={() => void submitDonorVerification()} disabled={savingDonor}>
              {savingDonor ? 'Submitting...' : 'Submit for Donor Verification'}
            </button>
          </div>
        ) : null}
      </div>

      <div className="utility-actions">
        <Link to="/app/feedback" className="ghost-btn btn-link">Rate & Feedback</Link>
        <Link to="/app/donation-history" className="ghost-btn btn-link">Donation History & Certificates</Link>
      </div>
    </section>
  )
}

export default ProfilePage
