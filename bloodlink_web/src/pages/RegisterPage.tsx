import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

type Gender = 'male' | 'female' | 'other' | ''

function getRegisterErrorMessage(errorCode: string): string {
  if (errorCode === 'auth/email-already-in-use') return 'Email already in use.'
  if (errorCode === 'auth/weak-password') return 'Password should be at least 6 characters.'
  if (errorCode === 'auth/invalid-email') return 'Please enter a valid email address.'
  if (errorCode === 'auth/network-request-failed') return 'Network error. Please check your internet connection.'
  return 'Registration failed. Please try again.'
}

function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [gender, setGender] = useState<Gender>('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/')
  }

  const redirectAfterRegister = (() => {
    const search = new URLSearchParams(location.search)
    const next = search.get('next') || ''
    return next.startsWith('/') ? next : ''
  })()

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!fullName.trim() || !gender || !dateOfBirth || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password)
      const user = userCredential.user

      await setDoc(doc(db, 'users', user.uid), {
        email: email.trim(),
        fullName: fullName.trim(),
        gender,
        dateOfBirth: new Date(dateOfBirth).toISOString(),
        role: 'user',
        termsAccepted: false,
        termsAcceptedAt: null,
        createdAt: new Date(),
      })

      await sendEmailVerification(user)
      await signOut(auth)

      const target = redirectAfterRegister
        ? `/login?registered=1&next=${encodeURIComponent(redirectAfterRegister)}`
        : '/login?registered=1'
      navigate(target)
    } catch (caughtError) {
      const errorCode =
        typeof caughtError === 'object' && caughtError !== null && 'code' in caughtError
          ? String(caughtError.code)
          : ''
      setError(getRegisterErrorMessage(errorCode))
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

        <section className="auth-card" aria-label="Register form">
          <img className="auth-logo" src="/Logo.png" alt="Bloodlink" />
          <h1>Create Account</h1>
          <p className="auth-subtitle">Set up your donor/requester profile in one step.</p>

          {error ? <p className="auth-message auth-message-error">{error}</p> : null}

          <form onSubmit={handleRegister} className="auth-form">
            <label htmlFor="register-fullname">Full Name</label>
            <input
              id="register-fullname"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              required
            />

            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />

            <label htmlFor="register-password">Password</label>
            <div className="password-field">
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={6}
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

            <label htmlFor="register-confirm-password">Confirm Password</label>
            <input
              id="register-confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />

            <label htmlFor="register-gender">Gender</label>
            <select
              id="register-gender"
              value={gender}
              onChange={(event) => setGender(event.target.value as Gender)}
              required
            >
              <option value="">Select gender...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>

            <label htmlFor="register-dob">Date of Birth</label>
            <input
              id="register-dob"
              type="date"
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              required
            />

            <button type="submit" className="solid-btn auth-submit" disabled={loading}>
              {loading ? 'Registering...' : 'Sign up'}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to={redirectAfterRegister ? `/login?next=${encodeURIComponent(redirectAfterRegister)}` : '/login'}>Login</Link>
          </p>
        </section>
      </div>
    </main>
  )
}

export default RegisterPage

