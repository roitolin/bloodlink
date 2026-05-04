import { Link } from 'react-router-dom'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { auth } from '@/lib/firebase'

function WebWelcomePage() {
  const [viewer, setViewer] = useState<User | null>(auth.currentUser)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setViewer(nextUser)
    })

    return () => unsubscribe()
  }, [])

  return (
    <div className="service-choice-shell">
      <div className="service-choice-card web-welcome-card">
        <span className="service-choice-kicker">Welcome</span>
        <h1>{viewer ? 'Open LifeCycle on web' : 'Log in to continue to LifeCycle'}</h1>
        <p>
          {viewer
            ? 'Your account is already active. Continue to the LifeCycle hub to choose the blood or funeral web experience.'
            : 'Sign in or create an account first, then choose the service you want to open from the LifeCycle web hub.'}
        </p>

        <div className="web-welcome-actions">
          {viewer ? (
            <Link to="/services" className="solid-btn btn-link web-welcome-primary">
              Open LifeCycle Hub
            </Link>
          ) : (
            <>
              <Link to="/login?next=/services" className="solid-btn btn-link web-welcome-primary">
                Enter App
              </Link>
              <Link to="/register?next=/services" className="ghost-btn btn-link web-welcome-secondary">
                Get Started
              </Link>
            </>
          )}
        </div>

        <div className="web-welcome-note">
          <strong>Next step</strong>
          <span>After account access, you can choose between Blood Web and Funeral Web from one shared hub.</span>
        </div>
      </div>
    </div>
  )
}

export default WebWelcomePage
