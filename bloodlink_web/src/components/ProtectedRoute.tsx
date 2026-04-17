import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

type ProtectedRouteProps = {
  redirectTo?: string
  allowedRoles?: string[]
  redirectUnauthorizedTo?: string
}

function ProtectedRoute({
  redirectTo = '/',
  allowedRoles,
  redirectUnauthorizedTo = '/app',
}: ProtectedRouteProps) {
  const location = useLocation()
  const [user, setUser] = useState<User | null>(auth.currentUser)
  const [userRole, setUserRole] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      if (!nextUser) {
        setUserRole('')
        setChecking(false)
        return
      }

      const loadRole = async () => {
        try {
          const snapshot = await getDoc(doc(db, 'users', nextUser.uid))
          const data = snapshot.data() as { role?: string } | undefined
          setUserRole(String(data?.role || 'user').toLowerCase())
        } catch {
          setUserRole('user')
        } finally {
          setChecking(false)
        }
      }

      void loadRole()
    })

    return () => unsubscribe()
  }, [])

  if (checking) {
    return (
      <main className="auth-page">
        <div className="auth-layout">
          <section className="auth-card">
            <h1>Loading...</h1>
          </section>
        </div>
      </main>
    )
  }

  if (!user) {
    const target =
      redirectTo === '/'
        ? '/'
        : `${redirectTo}?next=${encodeURIComponent(location.pathname + location.search)}`
    return <Navigate to={target} replace />
  }

  if (!user.emailVerified) {
    const verifyTarget = `/verify-email?next=${encodeURIComponent(location.pathname + location.search)}`
    return <Navigate to={verifyTarget} replace />
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return <Navigate to={redirectUnauthorizedTo} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
