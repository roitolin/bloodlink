import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

type DonorItem = {
  id: string
  fullName?: string
  email?: string
  contactNumber?: string
  bloodType?: string
  city?: string
  donorStatus?: string
  donorVerificationRejectionReason?: string | null
  availabilityStatus?: string
  role?: string
}

function normalize(value: string | undefined | null) {
  return String(value || '').trim().toLowerCase()
}

const ALLOWED_DONOR_STATUSES = new Set(['pending', 'verified', 'rejected'])

function getConversationId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join('_')
}

function AdminDonorsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [items, setItems] = useState<DonorItem[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [queryText, setQueryText] = useState('')
  const { openConfirm, confirmDialog } = useConfirmDialog()

  const load = async () => {
    setLoading(true)
    try {
      const snapshot = await getDocs(collection(db, 'users'))
      const list = snapshot.docs
        .map((itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as Omit<DonorItem, 'id'>) }))
        .filter((item) => !normalize(item.role).includes('admin'))
        .filter((item) => ALLOWED_DONOR_STATUSES.has(normalize(item.donorStatus)))
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
    let list = items
    if (statusFilter !== 'all') {
      list = list.filter((item) => normalize(item.donorStatus) === statusFilter)
    }
    if (!q) return list
    return list.filter((item) => [item.fullName, item.email, item.bloodType, item.city].some((value) => normalize(value).includes(q)))
  }, [items, statusFilter, queryText])

  const setDonorStatus = async (itemId: string, donorStatus: 'verified' | 'rejected') => {
    const item = items.find((entry) => entry.id === itemId)
    const actionLabel = donorStatus === 'verified' ? 'verify' : 'reject'
    openConfirm({
      title: donorStatus === 'verified' ? 'Verify this donor?' : 'Reject this donor?',
      message: `You are about to ${actionLabel} ${item?.fullName || item?.email || 'this donor'}.`,
      details:
        donorStatus === 'verified'
          ? ['Their donor status will become verified and availability will switch to available.']
          : ['Their donor status will become rejected and availability will switch to unavailable.'],
      tone: donorStatus === 'verified' ? 'success' : 'danger',
      confirmLabel: donorStatus === 'verified' ? 'Verify Donor' : 'Reject Donor',
      onConfirm: async () => {
        setSavingId(itemId)
        try {
          await updateDoc(doc(db, 'users', itemId), {
            donorStatus,
            donorVerificationRejectionReason: donorStatus === 'rejected' ? 'Rejected by admin' : null,
            availabilityStatus: donorStatus === 'verified' ? 'available' : 'unavailable',
            updatedAt: serverTimestamp(),
          })
          await load()
        } finally {
          setSavingId('')
        }
      },
    })
  }

  const deleteDonorData = async (itemId: string) => {
    const item = items.find((entry) => entry.id === itemId)
    openConfirm({
      title: 'Delete donor data?',
      message: `This will clear donor-only fields for ${item?.fullName || item?.email || 'this user'} but keep the account itself.`,
      details: ['Blood type, location, donor status, certificate, and valid ID fields will be removed.'],
      tone: 'danger',
      confirmLabel: 'Delete Donor Data',
      onConfirm: async () => {
        setSavingId(itemId)
        try {
          await updateDoc(doc(db, 'users', itemId), {
            bloodType: null,
            city: null,
            street: null,
            medicalCertificateURL: null,
            validIdURL: null,
            donorStatus: 'none',
            donorVerificationRejectionReason: null,
            availabilityStatus: null,
            availableSince: null,
            updatedAt: serverTimestamp(),
          })
          await load()
        } finally {
          setSavingId('')
        }
      },
    })
  }

  const openChat = async (targetUserId: string) => {
    const adminId = auth.currentUser?.uid
    if (!adminId) return
    const conversationId = getConversationId(adminId, targetUserId)
    const conversationRef = doc(db, 'conversations', conversationId)
    await setDoc(
      conversationRef,
      {
        participants: [adminId, targetUserId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
    navigate(`/admin/support?conversation=${encodeURIComponent(conversationId)}`)
  }

  return (
    <>
      <section className="panel">
        <h2>Donor Management</h2>
        <p className="panel-sub">Review donor verification and donor profile data.</p>

        <div className="donor-filters donor-filters-advanced">
          <div>
            <label htmlFor="admin-donor-search">Search</label>
            <input id="admin-donor-search" value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Name, email, blood, city" />
          </div>
          <div>
            <label htmlFor="admin-donor-status">Verification Status</label>
            <select id="admin-donor-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {loading ? <p className="panel-sub">Loading donors...</p> : null}
        {!loading && filtered.length === 0 ? <p className="panel-sub">No donors found.</p> : null}

        <div className="table-wrap">
          <table className="request-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Blood</th>
                <th>City</th>
                <th>Donor Status</th>
                <th>Availability</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const donorStatus = normalize(item.donorStatus) || 'none'
                const busy = savingId === item.id
                return (
                  <tr key={item.id}>
                    <td>{item.fullName || '-'}</td>
                    <td>{item.email || '-'}</td>
                    <td>{item.bloodType || '-'}</td>
                    <td>{item.city || '-'}</td>
                    <td>
                      <span className={`status-pill ${donorStatus}`}>{donorStatus}</span>
                      {item.donorVerificationRejectionReason ? <div>{item.donorVerificationRejectionReason}</div> : null}
                    </td>
                    <td>{item.availabilityStatus || '-'}</td>
                    <td>
                      <div className="request-actions">
                        <Link to={`/admin/users/${item.id}`} className="ghost-btn btn-link table-action">View Details</Link>
                        <button type="button" className="ghost-btn table-action" disabled={busy} onClick={() => void openChat(item.id)}>Chat</button>
                        {donorStatus === 'pending' ? (
                          <>
                            <button type="button" className="ghost-btn table-action" disabled={busy} onClick={() => void setDonorStatus(item.id, 'verified')}>
                              Verify
                            </button>
                            <button type="button" className="ghost-btn table-action" disabled={busy} onClick={() => void setDonorStatus(item.id, 'rejected')}>
                              Reject
                            </button>
                          </>
                        ) : null}
                        <button type="button" className="ghost-btn table-action" disabled={busy} onClick={() => void deleteDonorData(item.id)}>
                          Delete Donor Data
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      {confirmDialog}
    </>
  )
}

export default AdminDonorsPage
