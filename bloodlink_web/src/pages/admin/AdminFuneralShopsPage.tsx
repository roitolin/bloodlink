import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

type ShopItem = {
  id: string
  email?: string
  fullName?: string
  funeralShopStatus?: string
  funeralShopRejectionReason?: string | null
  funeralShopInfo?: {
    shopName?: string
    shopAddress?: string
    shopPhoneNumber?: string
  } | null
  funeralBusinessInfo?: {
    individualRegisteredName?: string
    businessName?: string
    generalLocation?: string
    registeredAddress?: string
    zipCode?: string
    tin?: string
    vatRegistrationStatus?: string
    birCertificateUrl?: string | null
  } | null
}

function normalize(value: string | undefined | null) {
  return String(value || '').trim().toLowerCase()
}

function AdminFuneralShopsPage() {
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [items, setItems] = useState<ShopItem[]>([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [queryText, setQueryText] = useState('')
  const { openConfirm, confirmDialog } = useConfirmDialog()

  const load = async () => {
    setLoading(true)
    try {
      const funeralStatusQuery = query(
        collection(db, 'users'),
        where('funeralShopStatus', 'in', ['pending', 'verified', 'rejected']),
      )
      const snapshot = await getDocs(funeralStatusQuery)
      const list = snapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as Omit<ShopItem, 'id'>) }))
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
      list = list.filter((item) => normalize(item.funeralShopStatus) === statusFilter)
    }
    if (!q) return list
    return list.filter((item) =>
      [
        item.fullName,
        item.email,
        item.funeralShopInfo?.shopName,
        item.funeralBusinessInfo?.businessName,
        item.funeralBusinessInfo?.generalLocation,
      ].some((value) => normalize(value).includes(q)),
    )
  }, [items, statusFilter, queryText])

  const setShopStatus = async (itemId: string, nextStatus: 'verified' | 'rejected') => {
    const item = items.find((entry) => entry.id === itemId)
    openConfirm({
      title: nextStatus === 'verified' ? 'Approve this funeral shop?' : 'Reject this funeral shop?',
      message: `You are about to ${nextStatus === 'verified' ? 'approve' : 'reject'} ${item?.funeralShopInfo?.shopName || item?.email || 'this shop'}.`,
      details:
        nextStatus === 'verified'
          ? ['The shop status will become verified.']
          : ['The shop status will become rejected.'],
      tone: nextStatus === 'verified' ? 'success' : 'danger',
      confirmLabel: nextStatus === 'verified' ? 'Approve Shop' : 'Reject Shop',
      onConfirm: async () => {
        setSavingId(itemId)
        try {
          await updateDoc(doc(db, 'users', itemId), {
            funeralShopStatus: nextStatus,
            funeralShopRejectionReason: nextStatus === 'rejected' ? 'Rejected by admin' : null,
            updatedAt: serverTimestamp(),
          })
          await load()
        } finally {
          setSavingId('')
        }
      },
    })
  }

  return (
    <>
      <section className="panel">
        <h2>Funeral Shop Management</h2>
        <p className="panel-sub">Review funeral shop registrations and approve or reject submitted shop records.</p>

        <div className="donor-filters donor-filters-advanced">
          <div>
            <label htmlFor="admin-funeral-search">Search</label>
            <input
              id="admin-funeral-search"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Shop, owner, email, business, location"
            />
          </div>
          <div>
            <label htmlFor="admin-funeral-status">Shop Status</label>
            <select id="admin-funeral-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {loading ? <p className="panel-sub">Loading funeral shops...</p> : null}
        {!loading && filtered.length === 0 ? <p className="panel-sub">No funeral shops found.</p> : null}

        <div className="table-wrap">
          <table className="request-table">
            <thead>
              <tr>
                <th>Shop</th>
                <th>Owner</th>
                <th>Email</th>
                <th>Business</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const status = normalize(item.funeralShopStatus) || 'none'
                const busy = savingId === item.id
                return (
                  <tr key={item.id}>
                    <td>{item.funeralShopInfo?.shopName || '-'}</td>
                    <td>{item.fullName || '-'}</td>
                    <td>{item.email || '-'}</td>
                    <td>{item.funeralBusinessInfo?.businessName || '-'}</td>
                    <td>{item.funeralBusinessInfo?.generalLocation || '-'}</td>
                    <td>
                      <span className={`status-pill ${status}`}>{status}</span>
                      {item.funeralShopRejectionReason ? <div>{item.funeralShopRejectionReason}</div> : null}
                    </td>
                    <td>
                      <div className="request-actions">
                        {item.funeralBusinessInfo?.birCertificateUrl ? (
                          <a
                            href={item.funeralBusinessInfo.birCertificateUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ghost-btn btn-link table-action"
                          >
                            View BIR
                          </a>
                        ) : null}
                        {status === 'pending' ? (
                          <>
                            <button type="button" className="ghost-btn table-action" disabled={busy} onClick={() => void setShopStatus(item.id, 'verified')}>
                              Approve
                            </button>
                            <button type="button" className="ghost-btn table-action" disabled={busy} onClick={() => void setShopStatus(item.id, 'rejected')}>
                              Reject
                            </button>
                          </>
                        ) : null}
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

export default AdminFuneralShopsPage
