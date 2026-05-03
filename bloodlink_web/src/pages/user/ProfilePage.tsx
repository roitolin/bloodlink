import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { updateProfile } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, db, storage } from '@/lib/firebase'

type Gender = 'male' | 'female' | 'other' | ''
type DonorStatus = 'none' | 'pending' | 'verified' | 'rejected'
type AvailabilityStatus = 'available' | 'unavailable'

function getDefaultAvatar(gender: Gender) {
  if (gender === 'female') return '/Female_Default_Profile.png'
  return '/Male_Default_Profile.png'
}

function parseStoredDate(value: unknown): Date | null {
  if (!value) return null
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
    const dateValue = value.toDate()
    return dateValue instanceof Date && !Number.isNaN(dateValue.getTime()) ? dateValue : null
  }
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function ProfilePage() {
  const [fullName, setFullName] = useState('')
  const [gender, setGender] = useState<Gender>('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [photoURL, setPhotoURL] = useState('')
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')
  const [bloodType, setBloodType] = useState('')
  const [city, setCity] = useState('')
  const [street, setStreet] = useState('')
  const [donorStatus, setDonorStatus] = useState<DonorStatus>('none')
  const [donorAvailability, setDonorAvailability] = useState<AvailabilityStatus>('unavailable')
  const [donationCooldownUntil, setDonationCooldownUntil] = useState<Date | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
          setContactNumber(String(data.contactNumber || ''))
          setPhotoURL(String(data.photoURL || user.photoURL || ''))
          setBloodType(String(data.bloodType || ''))
          setCity(String(data.city || ''))
          setStreet(String(data.street || ''))
          setDonorStatus((String(data.donorStatus || 'none') as DonorStatus) || 'none')
          setDonorAvailability((String(data.availabilityStatus || 'unavailable') as AvailabilityStatus) || 'unavailable')
          setDonationCooldownUntil(parseStoredDate(data.donationCooldownUntil))
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
          contactNumber: contactNumber.trim(),
          photoURL: nextPhotoURL,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )

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

  const donorStatusLabel = donorStatus === 'verified'
    ? 'Verified'
    : donorStatus === 'pending'
    ? 'Pending'
    : donorStatus === 'rejected'
    ? 'Rejected'
    : 'Not Applied'

  const donorActionLabel = donorStatus === 'verified'
    ? 'Manage Donor Profile'
    : donorStatus === 'pending'
    ? 'View Donor Application'
    : donorStatus === 'rejected'
    ? 'Apply Again as Donor'
    : 'Apply to Be a Donor'

  const donorLocationLabel = [street, city].filter(Boolean).join(', ')
  const profileImageSrc = photoPreviewUrl || photoURL || getDefaultAvatar(gender)

  return (
    <section className="panel">
      <h2>My Profile</h2>
      <p className="panel-sub">Keep your account details updated, and manage donor requirements from a dedicated page.</p>

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
          <>
            <div className="donor-note-banner">
              Your donor account is verified. Use the donor page to manage donor details, certificate, and availability.
            </div>
            {donationCooldownUntil && donationCooldownUntil.getTime() > Date.now() ? (
              <div className="donor-note-banner warning">
                Cooldown active until {donationCooldownUntil.toLocaleString()}.
              </div>
            ) : null}
            <div className="donor-summary-grid">
              <div className="donor-summary-item">
                <span>Availability</span>
                <strong>{donorAvailability === 'available' ? 'Available' : 'Unavailable'}</strong>
              </div>
              <div className="donor-summary-item">
                <span>Blood Type</span>
                <strong>{bloodType || 'Not set'}</strong>
              </div>
              <div className="donor-summary-item">
                <span>Location</span>
                <strong>{donorLocationLabel || 'Not set'}</strong>
              </div>
            </div>
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
              Your last donor application was rejected. Open the donor page to update details and apply again.
            </div>
            {rejectionReason ? <p className="panel-sub donor-reason">Reason: {rejectionReason}</p> : null}
          </>
        ) : null}

        {donorStatus === 'none' ? (
          <p className="panel-sub">Ready to become a donor? The full donor application now has its own page.</p>
        ) : null}

        <div className="donor-actions-wrap">
          <Link to="/app/donor-application" className="solid-btn btn-link">{donorActionLabel}</Link>
        </div>
      </div>

      <div className="utility-actions">
        <Link to="/app/feedback" className="ghost-btn btn-link">Rate & Feedback</Link>
        <Link to="/app/donation-history" className="ghost-btn btn-link">Donation History & Certificates</Link>
      </div>
    </section>
  )
}

export default ProfilePage
