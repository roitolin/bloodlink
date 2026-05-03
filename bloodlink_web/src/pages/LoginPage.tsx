import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { clearLoginAttempts, getLoginBlockState, recordFailedLoginAttempt } from '@/utils/authAttemptGuard'
import { normalizeEmail } from '@/utils/inputSecurity'

type BanDialog = {
  reason: string
  banEndsLabel: string
}

type UserDoc = {
  disabled?: boolean
  banReason?: string
  bannedUntil?: unknown
  role?: string
}

function toDate(value: unknown): Date | null {
  if (!value) return null

  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybeTimestamp = value as { toDate?: () => Date }
    const converted = maybeTimestamp.toDate?.()
    return converted && !Number.isNaN(converted.getTime()) ? converted : null
  }

  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getLoginErrorMessage(errorCode: string): string {
  if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found') {
    return "We couldn't find an account with that email. Please check for typos or sign up first."
  }
  if (errorCode === 'auth/wrong-password') {
    return 'Incorrect password. Please try again.'
  }
  if (errorCode === 'auth/invalid-email') {
    return 'Please enter a valid email address.'
  }
  if (errorCode === 'auth/user-disabled') {
    return 'This account has been disabled.'
  }
  if (errorCode === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  if (errorCode === 'auth/network-request-failed') {
    return 'Network error. Please check your internet connection.'
  }
  return 'Unable to log in right now. Please try again.'
}

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const supportEmail = 'support@bloodlink.app'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [banDialog, setBanDialog] = useState<BanDialog | null>(null)

  useEffect(() => {
    const state = location.state as { banDialog?: BanDialog } | null
    if (state?.banDialog) {
      setBanDialog(state.banDialog)
    }
  }, [location.state])

  const infoMessage = useMemo(() => {
    const search = new URLSearchParams(location.search)
    if (search.get('registered') === '1') return 'Registration successful. Check your email to verify your account.'
    if (search.get('verifyExpired') === '1') return 'Verification session expired after 30 minutes. Please log in again.'
    return ''
  }, [location.search])
  const redirectAfterLogin = useMemo(() => {
    const search = new URLSearchParams(location.search)
    const next = search.get('next') || ''
    return next.startsWith('/') ? next : ''
  }, [location.search])

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/')
  }

  const openSupportChannel = (channel: 'contact' | 'report') => {
    const subject = channel === 'contact' ? 'LifeCycle Login Help' : 'LifeCycle Report Login Issue'
    const body =
      channel === 'contact'
        ? `I need help logging in.\nEmail: ${email || '(not provided)'}\nIssue: `
        : `I want to report a login issue.\nEmail: ${email || '(not provided)'}\nDetails: `
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(supportEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedEmail = normalizeEmail(email)

    if (!normalizedEmail || !password.trim()) {
      setError('Please fill in all fields.')
      return
    }

    const blockState = getLoginBlockState(normalizedEmail)
    if (blockState.blocked) {
      setError(`Too many attempts. Please wait ${blockState.retryAfterSeconds}s before trying again.`)
      return
    }

    setError('')
    setLoading(true)

    try {
      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password)
      const userDocRef = doc(db, 'users', credential.user.uid)
      const userDoc = await getDoc(userDocRef)

      if (!userDoc.exists()) {
        await signOut(auth)
        recordFailedLoginAttempt(normalizedEmail)
        setError('Profile not found for this account. Please contact support.')
        return
      }

      const userData = userDoc.data() as UserDoc
      const userRole = String(userData.role || 'user').toLowerCase()
      const defaultRedirect =
        userRole === 'super_admin'
          ? '/admin/dashboard'
          : userRole === 'blood_admin'
          ? '/admin/donors'
          : userRole === 'funeral_admin'
            ? '/admin/funeral-shops'
            : userRole === 'admin'
              ? '/admin'
              : '/app'
      const targetAfterLogin = redirectAfterLogin || defaultRedirect
      const disabled = Boolean(userData.disabled)
      const banReason = userData.banReason?.trim() || 'No reason provided by admin.'
      const bannedUntil = toDate(userData.bannedUntil)
      const hasValidBanEnd = bannedUntil !== null

      if (disabled && hasValidBanEnd && bannedUntil.getTime() <= Date.now()) {
        await updateDoc(userDocRef, {
          disabled: false,
          banReason: null,
          bannedBy: null,
          bannedAt: null,
          bannedUntil: null,
        })
        navigate(targetAfterLogin)
        return
      }

      if (disabled) {
        await signOut(auth)
        recordFailedLoginAttempt(normalizedEmail)
        setBanDialog({
          reason: banReason,
          banEndsLabel: hasValidBanEnd ? bannedUntil.toLocaleString() : 'No end date (permanent)',
        })
        return
      }

      if (!credential.user.emailVerified) {
        const verifyTarget = redirectAfterLogin ? `/verify-email?next=${encodeURIComponent(redirectAfterLogin)}` : '/verify-email'
        navigate(verifyTarget)
        return
      }

      clearLoginAttempts(normalizedEmail)
      navigate(targetAfterLogin)
    } catch (caughtError) {
      recordFailedLoginAttempt(normalizedEmail)
      const errorCode =
        typeof caughtError === 'object' && caughtError !== null && 'code' in caughtError
          ? String(caughtError.code)
          : ''
      setError(getLoginErrorMessage(errorCode))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <button type="button" className="back-btn" onClick={goBack}>
          {'< Back'}
        </button>

        <section className="auth-card" aria-label="Login form">
          <img className="auth-logo" src="/Logo.png" alt="Bloodlink" />
          <h1>Login</h1>
          <p className="auth-subtitle">Sign in to continue helping your community.</p>

          {infoMessage ? <p className="auth-message auth-message-info">{infoMessage}</p> : null}
          {error ? <p className="auth-message auth-message-error">{error}</p> : null}

          <form onSubmit={handleLogin} className="auth-form">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />

            <label htmlFor="login-password">Password</label>
            <div className="password-field">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M3 3L21 21" strokeWidth="1.8" strokeLinecap="round" />
                    <path
                      d="M10.58 10.58C10.21 10.95 10 11.46 10 12C10 13.1 10.9 14 12 14C12.54 14 13.05 13.79 13.42 13.42"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9.88 5.09C10.56 4.89 11.27 4.79 12 4.79C16.5 4.79 20.27 8.06 21.25 12C20.91 13.36 20.18 14.6 19.15 15.55M14.12 18.91C13.44 19.11 12.73 19.21 12 19.21C7.5 19.21 3.73 15.94 2.75 12C3.31 9.75 4.78 7.83 6.77 6.65"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M2.75 12C3.73 8.06 7.5 4.79 12 4.79C16.5 4.79 20.27 8.06 21.25 12C20.27 15.94 16.5 19.21 12 19.21C7.5 19.21 3.73 15.94 2.75 12Z"
                      strokeWidth="1.8"
                    />
                    <circle cx="12" cy="12" r="3" strokeWidth="1.8" />
                  </svg>
                )}
              </button>
            </div>

            <button type="submit" className={`solid-btn auth-submit${loading ? ' auth-submit-loading' : ''}`} disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="auth-switch">
            No account yet? <Link to="/register">Register</Link>
          </p>

          <section className="support-wrap" aria-label="Login support">
            <p className="support-label">Trouble logging in?</p>
            <div className="support-actions">
              <button type="button" className="ghost-btn support-btn" onClick={() => openSupportChannel('report')}>
                Report Login Issue
              </button>
            </div>
          </section>
        </section>
      </div>

      {banDialog ? (
        <div className="ban-overlay" role="dialog" aria-modal="true" aria-label="Account banned">
          <div className="ban-card">
            <h2>Account Banned</h2>
            <p>This account is currently restricted by admin moderation.</p>

            <div className="ban-item">
              <span>Reason</span>
              <strong>{banDialog.reason}</strong>
            </div>

            <div className="ban-item">
              <span>Ban Ends</span>
              <strong>{banDialog.banEndsLabel}</strong>
            </div>

            <div className="ban-actions">
              <button type="button" className="ghost-btn" onClick={() => setBanDialog(null)}>
                Back
              </button>
              <button type="button" className="solid-btn" onClick={() => openSupportChannel('contact')}>
                Contact Support
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default LoginPage

