import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

type ProfileData = {
  fullName: string
  photoURL: string
  gender: string
}

type OtherProfile = {
  fullName?: string
  email?: string
  photoURL?: string
  gender?: string
}

type Conversation = {
  id: string
  participants?: string[]
  updatedAt?: { toDate?: () => Date } | string | null
  lastMessage?: {
    text?: string
    senderId?: string
    timestamp?: { toDate?: () => Date } | string | null
  }
}

type ChatMessage = {
  id: string
  text?: string
  senderId?: string
  timestamp?: { toDate?: () => Date } | string | null
}

function getDefaultAvatar(gender: string) {
  if (gender === 'female') return '/Female_Default_Profile.png'
  return '/Male_Default_Profile.png'
}

function formatTime(value: { toDate?: () => Date } | string | null | undefined) {
  if (!value) return ''
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return value.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || ''
  }
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function UserLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<User | null>(auth.currentUser)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [nameMap, setNameMap] = useState<Record<string, string>>({})
  const [conversationProfileMap, setConversationProfileMap] = useState<Record<string, OtherProfile>>({})
  const [profile, setProfile] = useState<ProfileData>({ fullName: 'User', photoURL: '', gender: '' })
  const [activeConversation, setActiveConversation] = useState<{ id: string; title: string } | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return

      const snapshot = await getDoc(doc(db, 'users', user.uid))
      const data = snapshot.data() as { fullName?: string; photoURL?: string; gender?: string } | undefined

      setProfile({
        fullName: data?.fullName?.trim() || user.displayName || 'User',
        photoURL: data?.photoURL?.trim() || user.photoURL || '',
        gender: String(data?.gender || '').toLowerCase(),
      })
    }

    void loadProfile()

    const refreshProfile = () => {
      void loadProfile()
    }
    window.addEventListener('profile-updated', refreshProfile)
    return () => {
      window.removeEventListener('profile-updated', refreshProfile)
    }
  }, [user])

  useEffect(() => {
    setMenuOpen(false)
    setMessagesOpen(false)
    setActiveConversation(null)
  }, [location.pathname])

  useEffect(() => {
    const loadConversations = async () => {
      if (!messagesOpen || !user) return

      setLoadingMessages(true)
      try {
        const snapshot = await getDocs(query(collection(db, 'conversations'), where('participants', 'array-contains', user.uid)))
        const list = snapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as Omit<Conversation, 'id'>) }))

        list.sort((a, b) => {
          const aDate = typeof a.updatedAt === 'object' && a.updatedAt && 'toDate' in a.updatedAt ? a.updatedAt.toDate?.()?.getTime?.() || 0 : new Date(String(a.updatedAt || 0)).getTime() || 0
          const bDate = typeof b.updatedAt === 'object' && b.updatedAt && 'toDate' in b.updatedAt ? b.updatedAt.toDate?.()?.getTime?.() || 0 : new Date(String(b.updatedAt || 0)).getTime() || 0
          return bDate - aDate
        })

        setConversations(list)

        const ids = Array.from(
          new Set(
            list
              .map((item) => item.participants?.find((id) => id !== user.uid))
              .filter(Boolean) as string[],
          ),
        )

        const nextMap: Record<string, string> = {}
        const nextProfileMap: Record<string, OtherProfile> = {}
        await Promise.all(
          ids.map(async (id) => {
            try {
              const userSnap = await getDoc(doc(db, 'users', id))
              const data = userSnap.data() as OtherProfile | undefined
              nextMap[id] = data?.fullName?.trim() || data?.email || id
              nextProfileMap[id] = data || {}
            } catch {
              nextMap[id] = id
              nextProfileMap[id] = {}
            }
          }),
        )

        setNameMap(nextMap)
        setConversationProfileMap(nextProfileMap)
      } finally {
        setLoadingMessages(false)
      }
    }

    void loadConversations()
  }, [messagesOpen, user])

  const openConversation = async (id: string, title: string) => {
    setActiveConversation({ id, title })
    setThreadLoading(true)
    try {
      const snapshot = await getDocs(query(collection(db, 'conversations', id, 'messages'), orderBy('timestamp', 'asc')))
      const list = snapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as Omit<ChatMessage, 'id'>) }))
      setThreadMessages(list)
    } catch {
      setThreadMessages([])
    } finally {
      setThreadLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!user || !activeConversation || !chatInput.trim() || sending) return

    const text = chatInput.trim()
    setSending(true)
    try {
      await addDoc(collection(db, 'conversations', activeConversation.id, 'messages'), {
        text,
        senderId: user.uid,
        timestamp: serverTimestamp(),
      })

      await updateDoc(doc(db, 'conversations', activeConversation.id), {
        updatedAt: serverTimestamp(),
        lastMessage: {
          text,
          senderId: user.uid,
          timestamp: serverTimestamp(),
          readBy: [user.uid],
        },
      })

      setChatInput('')
      await openConversation(activeConversation.id, activeConversation.title)
      setConversations((prev) => {
        const found = prev.find((item) => item.id === activeConversation.id)
        if (!found) return prev
        const next = prev
          .map((item) =>
            item.id === activeConversation.id
              ? {
                  ...item,
                  lastMessage: { ...item.lastMessage, text, senderId: user.uid, timestamp: new Date().toISOString() },
                  updatedAt: new Date().toISOString(),
                }
              : item,
          )
          .sort((a, b) => {
            const aDate = typeof a.updatedAt === 'object' && a.updatedAt && 'toDate' in a.updatedAt ? a.updatedAt.toDate?.()?.getTime?.() || 0 : new Date(String(a.updatedAt || 0)).getTime() || 0
            const bDate = typeof b.updatedAt === 'object' && b.updatedAt && 'toDate' in b.updatedAt ? b.updatedAt.toDate?.()?.getTime?.() || 0 : new Date(String(b.updatedAt || 0)).getTime() || 0
            return bDate - aDate
          })
        return next
      })
    } finally {
      setSending(false)
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    navigate('/')
  }

  const avatarSrc = profile.photoURL || getDefaultAvatar(profile.gender)

  const conversationItems = useMemo(() => {
    if (!user) return []

    return conversations.map((item) => {
      const otherId = item.participants?.find((id) => id !== user.uid) || ''
      const title = nameMap[otherId] || otherId || 'Conversation'
      const preview = item.lastMessage?.text || 'No messages yet'
      const time = formatTime(item.lastMessage?.timestamp)
      const profileData = conversationProfileMap[otherId]
      return {
        id: item.id,
        title,
        preview,
        time,
        otherId,
        avatarSrc: profileData?.photoURL?.trim() || getDefaultAvatar(String(profileData?.gender || '').toLowerCase()),
      }
    })
  }, [conversationProfileMap, conversations, nameMap, user])

  return (
    <div className={`user-shell${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
      <aside className="user-sidebar">
        <Link to="/" className="brand user-brand">
          <img src="/Logo.png" alt="Bloodlink logo" className="brand-logo" />
          <strong className="sidebar-label">Bloodlink</strong>
        </Link>

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

        <nav className="user-nav" aria-label="User navigation">
          <NavLink to="/app" end className={({ isActive }) => `user-nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M3 10.5L12 3L21 10.5V21H14V15H10V21H3V10.5Z" strokeWidth="1.8" strokeLinejoin="round" /></svg></span>
            <span className="sidebar-label">Dashboard</span>
          </NavLink>
          <NavLink to="/app/search-donors" className={({ isActive }) => `user-nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" strokeWidth="1.8" /><path d="M20 20L16.65 16.65" strokeWidth="1.8" strokeLinecap="round" /></svg></span>
            <span className="sidebar-label">Search Donors</span>
          </NavLink>
          <NavLink to="/app/create-request" className={({ isActive }) => `user-nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 4C12 4 7 9.2 7 12.5A5 5 0 0 0 17 12.5C17 9.2 12 4 12 4Z" strokeWidth="1.8" /><path d="M12 9V16" strokeWidth="1.8" strokeLinecap="round" /><path d="M8.5 12.5H15.5" strokeWidth="1.8" strokeLinecap="round" /></svg></span>
            <span className="sidebar-label">Request Blood</span>
          </NavLink>
          <NavLink to="/app/my-requests" className={({ isActive }) => `user-nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="1.8" /><path d="M8 9H16" strokeWidth="1.8" strokeLinecap="round" /><path d="M8 13H16" strokeWidth="1.8" strokeLinecap="round" /><path d="M8 17H13" strokeWidth="1.8" strokeLinecap="round" /></svg></span>
            <span className="sidebar-label">My Requests</span>
          </NavLink>
          <NavLink to="/app/notifications" className={({ isActive }) => `user-nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3C9.2 3 7 5.2 7 8V10.7L5.4 13.4A1 1 0 0 0 6.3 15H17.7A1 1 0 0 0 18.6 13.4L17 10.7V8C17 5.2 14.8 3 12 3Z" strokeWidth="1.8" /><path d="M10 18C10.4 19.2 11.1 20 12 20C12.9 20 13.6 19.2 14 18" strokeWidth="1.8" strokeLinecap="round" /></svg></span>
            <span className="sidebar-label">Notifications</span>
          </NavLink>
          <NavLink to="/app/profile" className={({ isActive }) => `user-nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" strokeWidth="1.8" /><path d="M4 20C4 16.7 7.6 14 12 14C16.4 14 20 16.7 20 20" strokeWidth="1.8" strokeLinecap="round" /></svg></span>
            <span className="sidebar-label">Profile</span>
          </NavLink>
        </nav>
      </aside>

      <main className="user-main">
        <header className="user-header user-landing-header">
          <nav className="user-header-links" aria-label="Utility links">
            <Link to="/app/how-to-donate">How to Donate Blood</Link>
            <Link to="/app/contact">Contact Support</Link>
            <Link to="/app/about">About Us</Link>
            <Link to="/app/report-center">Report Center</Link>
          </nav>

          <div className="user-header-right">
            <div className="user-menu-wrap">
              <button
                type="button"
                className="user-profile-trigger"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                aria-controls="user-profile-menu"
              >
                <img src={avatarSrc} alt="Profile" className="user-avatar" />
                <span className="user-profile-name">{profile.fullName}</span>
                <svg viewBox="0 0 24 24" fill="none" className={`user-arrow${menuOpen ? ' open' : ''}`} aria-hidden="true">
                  <path d="M6 9L12 15L18 9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {menuOpen ? (
                <div id="user-profile-menu" className="user-dropdown" role="dialog" aria-label="Profile menu" aria-modal="false">
                  <button type="button" className="user-dropdown-item" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="user-content">
          <Outlet />
        </div>
      </main>

      <button
        type="button"
        className="floating-message-btn"
        aria-label="Messages"
        aria-haspopup="dialog"
        aria-expanded={messagesOpen}
        aria-controls="messages-panel"
        title={messagesOpen ? 'Close messages' : 'Open messages'}
        onClick={() => setMessagesOpen((prev) => !prev)}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4.5 6.5C4.5 5.7 5.2 5 6 5H18C18.8 5 19.5 5.7 19.5 6.5V14C19.5 14.8 18.8 15.5 18 15.5H9L5.5 18.7V6.5Z" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 9.5H16" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M8 12.5H13.5" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>

      {messagesOpen ? (
        <div id="messages-panel" className="messages-popup" role="dialog" aria-label="Messages" aria-modal="false">
          <div className="messages-popup-head">
            <strong>{activeConversation ? activeConversation.title : 'Messages'}</strong>
            <button
              type="button"
              onClick={() => {
                if (activeConversation) {
                  setActiveConversation(null)
                  return
                }
                setMessagesOpen(false)
              }}
            >
              {activeConversation ? '←' : '✕'}
            </button>
          </div>

          {!activeConversation ? (
            <div className="messages-popup-body">
              {loadingMessages ? <p>Loading conversations...</p> : null}
              {!loadingMessages && conversationItems.length === 0 ? <p>No conversations yet.</p> : null}
              {conversationItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="message-row message-row-btn"
                  onClick={() => void openConversation(item.id, item.title)}
                >
                  <img src={item.avatarSrc} alt={item.title} className="chat-avatar" />
                  <div className="message-row-copy">
                    <h4>{item.title}</h4>
                    <p>{item.preview}</p>
                    <span>{item.time}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="messages-thread">
              <div className="messages-thread-list">
                {threadLoading ? <p>Loading chat...</p> : null}
                {!threadLoading && threadMessages.length === 0 ? <p>No messages yet.</p> : null}
                {threadMessages.map((item) => {
                  const mine = item.senderId === user?.uid
                  const activeItem = conversationItems.find((conversation) => conversation.id === activeConversation.id)
                  const avatarForThread = mine ? avatarSrc : activeItem?.avatarSrc || '/Male_Default_Profile.png'
                  return (
                    <div key={item.id} className={`thread-row${mine ? ' mine' : ''}`}>
                      {!mine ? <img src={avatarForThread} alt="" className="chat-avatar thread-avatar" /> : null}
                      <article className={`thread-bubble${mine ? ' mine' : ''}`}>
                        <p>{item.text || ''}</p>
                        <span>{formatTime(item.timestamp)}</span>
                      </article>
                      {mine ? <img src={avatarForThread} alt="" className="chat-avatar thread-avatar" /> : null}
                    </div>
                  )
                })}
              </div>

              <div className="messages-thread-input">
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Type a message..."
                />
                <button type="button" onClick={() => void sendMessage()} disabled={sending || !chatInput.trim()}>
                  {sending ? '...' : 'Send'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default UserLayout
