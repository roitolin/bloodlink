import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

type ProfileData = {
  fullName: string
  photoURL: string
  gender: string
}

type AdminNotification = {
  id: string
  title?: string
  message?: string
  body?: string
  type?: string
  read?: boolean
  createdAt?: { toDate?: () => Date } | string | null
}

function getDefaultAvatar(gender: string) {
  if (gender === 'female') return '/Female_Default_Profile.png'
  return '/Male_Default_Profile.png'
}

function getTimeLabel(value: { toDate?: () => Date } | string | null | undefined) {
  if (!value) return ''
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return value.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || ''
  }
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getTimestampMs(value: { toDate?: () => Date } | string | null | undefined) {
  if (!value) return 0
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return value.toDate?.()?.getTime?.() || 0
  }
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

function AdminLayout() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(auth.currentUser)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [profile, setProfile] = useState<ProfileData>({ fullName: 'Admin', photoURL: '', gender: '' })

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return
      try {
        const snapshot = await getDoc(doc(db, 'users', user.uid))
        const data = snapshot.data() as { fullName?: string; photoURL?: string; gender?: string } | undefined
        setProfile({
          fullName: data?.fullName?.trim() || user.displayName || 'Admin',
          photoURL: data?.photoURL?.trim() || user.photoURL || '',
          gender: String(data?.gender || '').toLowerCase(),
        })
      } catch {
        setProfile({ fullName: user.displayName || 'Admin', photoURL: user.photoURL || '', gender: '' })
      }
    }
    void loadProfile()
  }, [user])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'notifications'), where('userId', '==', user.uid))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as Omit<AdminNotification, 'id'>) }))
      list.sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt))
      setNotifications(list)
    })
    return () => unsubscribe()
  }, [user])

  const visibleNotifications = useMemo(() => (user ? notifications : []), [notifications, user])
  const unreadCount = useMemo(() => visibleNotifications.filter((item) => !item.read).length, [visibleNotifications])
  const avatarSrc = profile.photoURL || getDefaultAvatar(profile.gender)

  const handleLogout = async () => {
    await signOut(auth)
    navigate('/')
  }

  return (
    <div className={`user-shell${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
      <aside className="user-sidebar">
        <Link to="/" className="brand user-brand">
          <img src="/Logo.png" alt="Bloodlink logo" className="brand-logo" />
          <strong className="sidebar-label">Bloodlink Admin</strong>
        </Link>

        <nav className="user-nav" aria-label="Admin navigation">
          <button
            type="button"
            className="user-nav-link sidebar-toggle-row"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 7H20" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M4 12H20" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M4 17H20" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="sidebar-label">Menu</span>
          </button>

          <NavLink to="/admin" end className={({ isActive }) => `user-nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M3 11L12 3L21 11V21H14V15H10V21H3V11Z" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="sidebar-label">Dashboard</span>
          </NavLink>
          <NavLink to="/admin/requests" className={({ isActive }) => `user-nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 4H19A2 2 0 0 1 21 6V18A2 2 0 0 1 19 20H5A2 2 0 0 1 3 18V6A2 2 0 0 1 5 4Z" strokeWidth="1.8" />
                <path d="M7 9H17" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M7 13H14" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="sidebar-label">Requests</span>
          </NavLink>
          <NavLink to="/admin/donors" className={({ isActive }) => `user-nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 4C12 4 7 9.2 7 12.5A5 5 0 0 0 17 12.5C17 9.2 12 4 12 4Z" strokeWidth="1.8" />
                <path d="M12 9V16" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M8.5 12.5H15.5" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="sidebar-label">Donors</span>
          </NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => `user-nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="9" cy="8" r="3" strokeWidth="1.8" />
                <circle cx="16" cy="10" r="2.5" strokeWidth="1.8" />
                <path d="M3 20C3 16.9 5.8 14.5 9.2 14.5C12.6 14.5 15.4 16.9 15.4 20" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M13.5 20C13.7 17.9 15.2 16.3 17.2 15.8" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="sidebar-label">Users</span>
          </NavLink>
          <NavLink to="/admin/moderation" className={({ isActive }) => `user-nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3L20 6V11C20 16.3 16.6 20.9 12 22C7.4 20.9 4 16.3 4 11V6L12 3Z" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M9.5 12L11.2 13.7L14.8 10.1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="sidebar-label">Moderation</span>
          </NavLink>
          <NavLink to="/admin/announcements" className={({ isActive }) => `user-nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 12V8L14 5V19L4 16V12Z" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M14 8H16C18.2 8 20 9.8 20 12C20 14.2 18.2 16 16 16H14" strokeWidth="1.8" />
                <path d="M7 16L8.5 20" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="sidebar-label">Announcements</span>
          </NavLink>
          <NavLink to="/admin/analytics" className={({ isActive }) => `user-nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 20H20" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M7 17V11" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M12 17V7" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M17 17V13" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="sidebar-label">Analytics</span>
          </NavLink>
          <NavLink to="/admin/feedback" className={({ isActive }) => `user-nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 5H19V14H8L5 17V5Z" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M8 9H16" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M8 12H13" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="sidebar-label">Feedback</span>
          </NavLink>
          <NavLink to="/admin/support" className={({ isActive }) => `user-nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4.5 6.5C4.5 5.7 5.2 5 6 5H18C18.8 5 19.5 5.7 19.5 6.5V14C19.5 14.8 18.8 15.5 18 15.5H9L5.5 18.7V6.5Z" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M8 9.5H16" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M8 12.5H13.5" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="sidebar-label">Support</span>
          </NavLink>
          <NavLink to="/admin/audit-logs" className={({ isActive }) => `user-nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M7 4H17V20H7V4Z" strokeWidth="1.8" />
                <path d="M10 8H14" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M10 12H14" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M10 16H13" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="sidebar-label">Audit Logs</span>
          </NavLink>
        </nav>

        <div className="utility-actions">
          <p className="panel-sub">Signed in as {user?.email || 'admin'}</p>
        </div>
      </aside>

      <main className="user-main">
        <header className="user-header">
          <div className="user-header-right">
            <div className="user-menu-wrap">
              <button
                type="button"
                className="admin-notification-btn"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                aria-haspopup="dialog"
                aria-expanded={notificationsOpen}
                aria-controls="admin-notification-menu"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3C9.2 3 7 5.2 7 8V10.7L5.4 13.4A1 1 0 0 0 6.3 15H17.7A1 1 0 0 0 18.6 13.4L17 10.7V8C17 5.2 14.8 3 12 3Z" strokeWidth="1.8" />
                  <path d="M10 18C10.4 19.2 11.1 20 12 20C12.9 20 13.6 19.2 14 18" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                {unreadCount > 0 ? <span className="admin-notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
              </button>

              {notificationsOpen ? (
                <div id="admin-notification-menu" className="user-dropdown admin-notification-dropdown" role="dialog" aria-label="Admin notifications" aria-modal="false">
                  {visibleNotifications.length === 0 ? <p className="panel-sub">No notifications yet.</p> : null}
                  {visibleNotifications.slice(0, 12).map((item) => (
                    <article key={item.id} className={`admin-notification-row${item.read ? '' : ' unread'}`}>
                      <strong>{item.title || item.type || 'Notification'}</strong>
                      <p>{item.message || item.body || ''}</p>
                      <span>{getTimeLabel(item.createdAt)}</span>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="user-menu-wrap">
              <button
                type="button"
                className="user-profile-trigger"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                aria-controls="admin-profile-menu"
              >
                <img src={avatarSrc} alt="Profile" className="user-avatar" />
                <span className="user-profile-name">{profile.fullName}</span>
                <svg viewBox="0 0 24 24" fill="none" className={`user-arrow${menuOpen ? ' open' : ''}`} aria-hidden="true">
                  <path d="M6 9L12 15L18 9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {menuOpen ? (
                <div id="admin-profile-menu" className="user-dropdown" role="dialog" aria-label="Admin profile menu" aria-modal="false">
                  <button type="button" className="user-dropdown-item" onClick={handleLogout}>Logout</button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <header className="admin-header">
          <h1>Admin Console</h1>
        </header>
        <div className="user-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default AdminLayout
