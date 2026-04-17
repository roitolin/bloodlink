import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, deleteDoc, doc, getDocs, Timestamp, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { getConversationId, normalize } from './adminHelpers'

type UserItem = {
  id: string
  fullName?: string
  email?: string
  role?: string
  city?: string
  contactNumber?: string
  disabled?: boolean
  banReason?: string | null
  bannedUntil?: { toDate?: () => Date } | string | null
}

function AdminUsersPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [items, setItems] = useState<UserItem[]>([])
  const [queryText, setQueryText] = useState('')
  const [banTarget, setBanTarget] = useState<UserItem | null>(null)
  const [banReasonInput, setBanReasonInput] = useState('')
  const [banDaysInput, setBanDaysInput] = useState('7')

  const load = async () => {
    setLoading(true)
    try {
      const snapshot = await getDocs(collection(db, 'users'))
      const list = snapshot.docs
        .map((itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as Omit<UserItem, 'id'>) }))
        .filter((item) => normalize(item.role) !== 'admin')
      setItems(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = normalize(queryText)
    if (!q) return items
    return items.filter((item) => [item.fullName, item.email, item.city, item.contactNumber].some((value) => normalize(value).includes(q)))
  }, [items, queryText])

  const resolveDate = (value: UserItem['bannedUntil']) => {
    if (!value) return null
    if (typeof value === 'object' && value !== null && 'toDate' in value) return value.toDate?.() || null
    const parsed = new Date(String(value))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const isBanned = (item: UserItem) => {
    const bannedUntil = resolveDate(item.bannedUntil)
    if (bannedUntil) return bannedUntil.getTime() > Date.now()
    return Boolean(item.disabled)
  }

  const openBanModal = (item: UserItem) => {
    setBanTarget(item)
    setBanReasonInput(item.banReason || '')
    setBanDaysInput('7')
  }

  const closeBanModal = () => {
    setBanTarget(null)
    setBanReasonInput('')
    setBanDaysInput('7')
  }

  const applyBan = async () => {
    if (!banTarget) return
    const days = Number(banDaysInput)
    const reason = banReasonInput.trim()
    if (!reason || !Number.isFinite(days) || days <= 0) return

    const bannedUntilDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    setSavingId(banTarget.id)
    try {
      await updateDoc(doc(db, 'users', banTarget.id), {
        disabled: true,
        banReason: reason,
        bannedAt: new Date(),
        bannedBy: auth.currentUser?.uid || null,
        bannedUntil: Timestamp.fromDate(bannedUntilDate),
      })
      closeBanModal()
      await load()
    } finally {
      setSavingId('')
    }
  }

  const unbanUser = async (item: UserItem) => {
    setSavingId(item.id)
    try {
      await updateDoc(doc(db, 'users', item.id), {
        disabled: false,
        banReason: null,
        bannedBy: null,
        bannedAt: null,
        bannedUntil: null,
      })
      await load()
    } finally {
      setSavingId('')
    }
  }

  const deleteUser = async (item: UserItem) => {
    setSavingId(item.id)
    try {
      await deleteDoc(doc(db, 'users', item.id))
      await load()
    } finally {
      setSavingId('')
    }
  }

  const openChat = async (item: UserItem) => {
    const adminId = auth.currentUser?.uid
    if (!adminId) return
    const conversationId = getConversationId(adminId, item.id)
    await setDoc(
      doc(db, 'conversations', conversationId),
      {
        participants: [adminId, item.id],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
    navigate(`/admin/support?conversation=${encodeURIComponent(conversationId)}`)
  }

  return (
    <section className="panel">
      <h2>User Management</h2>
      <p className="panel-sub">Manage user status and contact users directly.</p>

      <div className="donor-filters donor-filters-advanced">
        <div>
          <label htmlFor="admin-user-search">Search User</label>
          <input
            id="admin-user-search"
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            placeholder="Name, email, city, phone"
          />
        </div>
      </div>

      {loading ? <p className="panel-sub">Loading users...</p> : null}
      {!loading && filtered.length === 0 ? <p className="panel-sub">No users found.</p> : null}

      <div className="table-wrap">
        <table className="request-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>City</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const busy = savingId === item.id
              const banned = isBanned(item)
              const bannedUntil = resolveDate(item.bannedUntil)
              return (
                <tr key={item.id}>
                  <td>{item.fullName || '-'}</td>
                  <td>{item.email || '-'}</td>
                  <td>{item.role || 'user'}</td>
                  <td>{item.city || '-'}</td>
                  <td>
                    {banned ? <span className="status-pill rejected">banned</span> : <span className="status-pill verified">active</span>}
                    {banned && bannedUntil ? <div>{bannedUntil.toLocaleString()}</div> : null}
                    {item.banReason ? <div>{item.banReason}</div> : null}
                  </td>
                  <td>
                    <div className="request-actions">
                      <Link to={`/admin/users/${item.id}`} className="ghost-btn btn-link table-action">View</Link>
                      <button type="button" className="ghost-btn table-action" disabled={busy} onClick={() => void openChat(item)}>
                        Chat
                      </button>
                      {banned ? (
                        <button type="button" className="ghost-btn table-action" disabled={busy} onClick={() => void unbanUser(item)}>
                          Unban
                        </button>
                      ) : (
                        <button type="button" className="ghost-btn table-action" disabled={busy} onClick={() => openBanModal(item)}>
                          Ban
                        </button>
                      )}
                      <button type="button" className="ghost-btn table-action" disabled={busy} onClick={() => void deleteUser(item)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {banTarget ? (
        <div className="ban-overlay" role="dialog" aria-modal="true" aria-label="Ban user">
          <div className="ban-card">
            <h2>Ban User</h2>
            <p>{banTarget.email || banTarget.fullName || 'Selected user'}</p>
            <label htmlFor="ban-reason">Reason</label>
            <textarea
              id="ban-reason"
              className="app-textarea"
              value={banReasonInput}
              onChange={(event) => setBanReasonInput(event.target.value)}
              placeholder="Explain why this user is being banned."
            />
            <label htmlFor="ban-days">Duration (days)</label>
            <input id="ban-days" value={banDaysInput} onChange={(event) => setBanDaysInput(event.target.value)} />
            <div className="ban-actions">
              <button type="button" className="ghost-btn" onClick={closeBanModal}>Cancel</button>
              <button type="button" className="solid-btn" onClick={() => void applyBan()} disabled={savingId === banTarget.id}>Apply Ban</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default AdminUsersPage
