import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, sendEmailVerification, signOut, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { useLocation, useNavigate } from 'react-router-dom'
import { auth, db } from '@/lib/firebase'

const VERIFICATION_WINDOW_MS = 30 * 60 * 1000

function getRoleRedirect(role: string) {
  if (role === 'super_admin') return '/admin/dashboard'
  if (role === 'blood_admin') return '/admin/donors'
  if (role === 'funeral_admin') return '/admin/funeral-shops'
  return role === 'admin' ? '/admin' : '/app'
}

function getDeadlineKey(uid: string) {
  return `verification_deadline_${uid}`
}

function VerifyEmailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<User | null>(auth.currentUser)
  const [remainingMs, setRemainingMs] = useState(VERIFICATION_WINDOW_MS)
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [status, setStatus] = useState('')

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const raw = params.get('next') || ''
    return raw.startsWith('/') ? raw : ''
  }, [location.search])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      if (!nextUser) {
        navigate('/login', { replace: true })
      }
    })
    return () => unsubscribe()
  }, [navigate])

  useEffect(() => {
    const autoForwardVerifiedUser = async () => {
      if (!user?.emailVerified) return
      const profileSnap = await getDoc(doc(db, 'users', user.uid))
      const role = String(profileSnap.data()?.role || 'user').toLowerCase()
      window.localStorage.removeItem(getDeadlineKey(user.uid))
      navigate(nextPath || getRoleRedirect(role), { replace: true })
    }
    void autoForwardVerifiedUser()
  }, [navigate, nextPath, user])

  useEffect(() => {
    if (!user) return

    const key = getDeadlineKey(user.uid)
    const savedDeadline = Number(window.localStorage.getItem(key) || 0)
    const initialDeadline = Number.isFinite(savedDeadline) && savedDeadline > Date.now()
      ? savedDeadline
      : Date.now() + VERIFICATION_WINDOW_MS

    window.localStorage.setItem(key, String(initialDeadline))
    setRemainingMs(Math.max(0, initialDeadline - Date.now()))

    const timer = window.setInterval(() => {
      const left = Math.max(0, initialDeadline - Date.now())
      setRemainingMs(left)
      if (left > 0) return

      window.clearInterval(timer)
      window.localStorage.removeItem(key)
      void signOut(auth)
      navigate('/login?verifyExpired=1', { replace: true })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [navigate, user])

  const refreshVerification = async () => {
    if (!user) return
    setChecking(true)
    setStatus('')
    try {
      await user.reload()
      const refreshed = auth.currentUser
      if (!refreshed?.emailVerified) {
        setStatus('Email is still not verified. Please check your inbox and click the verification link.')
        return
      }

      const profileSnap = await getDoc(doc(db, 'users', refreshed.uid))
      const role = String(profileSnap.data()?.role || 'user').toLowerCase()
      window.localStorage.removeItem(getDeadlineKey(refreshed.uid))
      navigate(nextPath || getRoleRedirect(role), { replace: true })
    } finally {
      setChecking(false)
    }
  }

  const resendVerification = async () => {
    if (!user) return
    setResending(true)
    setStatus('')
    try {
      await sendEmailVerification(user)
      setStatus('Verification email sent again. Please check your inbox.')
    } catch {
      setStatus('Failed to resend verification email. Please try again.')
    } finally {
      setResending(false)
    }
  }

  const logoutNow = async () => {
    if (user) {
      window.localStorage.removeItem(getDeadlineKey(user.uid))
    }
    await signOut(auth)
    navigate('/login', { replace: true })
  }

  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const timeLabel = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-card" aria-label="Verify email">
          <img className="auth-logo" src="/Logo.png" alt="Bloodlink" />
          <h1>Verify Your Email</h1>
          <p className="auth-subtitle">You are logged in as: <strong>{user?.email || 'Unknown email'}</strong></p>
          <p className="auth-subtitle">Session expires in {timeLabel}. You will be logged out if still unverified.</p>

          {status ? <p className="auth-message auth-message-info">{status}</p> : null}

          <div className="verification-actions">
            <button
              type="button"
              className="solid-btn auth-submit"
              onClick={() => void refreshVerification()}
              disabled={checking}
            >
              {checking ? 'Checking...' : "I've Verified My Email"}
            </button>
            <button
              type="button"
              className="ghost-btn auth-submit"
              onClick={() => void resendVerification()}
              disabled={resending}
            >
              {resending ? 'Sending...' : 'Resend Verification Email'}
            </button>
            <button type="button" className="ghost-btn auth-submit" onClick={() => void logoutNow()}>
              Logout Now
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

export default VerifyEmailPage
