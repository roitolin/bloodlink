import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
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
  const [banDialog, setBanDialog] = useState<{ reason: string; banEndsLabel: string } | null>(null)
  const [checking, setChecking] = useState(true)

  const toDate = (value: unknown): Date | null => {
    if (!value) return null
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
    if (typeof value === 'object' && value !== null && 'toDate' in value) {
      const converted = (value as { toDate?: () => Date }).toDate?.()
      return converted && !Number.isNaN(converted.getTime()) ? converted : null
    }
    const parsed = new Date(String(value))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      profileUnsubscribe?.()
      profileUnsubscribe = null
      setUser(nextUser)
      if (!nextUser) {
        setUserRole('')
        setChecking(false)
        return
      }

      setChecking(true)
      profileUnsubscribe = onSnapshot(doc(db, 'users', nextUser.uid), (snapshot) => {
        const data = snapshot.data() as
          | {
              role?: string
              disabled?: boolean
              banReason?: string | null
              bannedUntil?: unknown
            }
          | undefined
        const disabled = Boolean(data?.disabled)
        const bannedUntil = toDate(data?.bannedUntil)
        const hasValidBanEnd = bannedUntil !== null

        if (disabled && hasValidBanEnd && bannedUntil.getTime() <= Date.now()) {
          void updateDoc(doc(db, 'users', nextUser.uid), {
            disabled: false,
            banReason: null,
            bannedBy: null,
            bannedAt: null,
            bannedUntil: null,
          }).catch(() => {})
        }

        if (disabled && (!hasValidBanEnd || bannedUntil.getTime() > Date.now())) {
          setBanDialog({
            reason: String(data?.banReason || '').trim() || 'No reason provided by admin.',
            banEndsLabel: hasValidBanEnd ? bannedUntil.toLocaleString() : 'No end date (permanent)',
          })
          setUser(null)
          setUserRole('')
          setChecking(false)
          void signOut(auth)
          return
        }

        setBanDialog(null)
        setUserRole(String(data?.role || 'user').toLowerCase())
        setChecking(false)
      })
    })

    return () => {
      profileUnsubscribe?.()
      unsubscribe()
    }
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
    if (banDialog) {
      return <Navigate to="/login" replace state={{ banDialog }} />
    }
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
