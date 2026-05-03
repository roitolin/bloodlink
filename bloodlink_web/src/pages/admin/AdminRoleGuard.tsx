import { Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

type AdminRoleGuardProps = {
  allowedRoles: string[]
  redirectTo?: string
}

function AdminRoleGuard({ allowedRoles, redirectTo = '/admin' }: AdminRoleGuardProps) {
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const currentUser = auth.currentUser
    if (!currentUser) {
      setRole('')
      setLoading(false)
      return
    }

    const unsubscribe = onSnapshot(
      doc(db, 'users', currentUser.uid),
      (snapshot) => {
        setRole(String(snapshot.data()?.role || 'user').toLowerCase())
        setLoading(false)
      },
      () => {
        setRole('user')
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [])

  if (loading) {
    return <section className="panel"><p className="panel-sub">Checking permissions...</p></section>
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to={redirectTo} replace />
  }

  return <Outlet />
}

export default AdminRoleGuard
