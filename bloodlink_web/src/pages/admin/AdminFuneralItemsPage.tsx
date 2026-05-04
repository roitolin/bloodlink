import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

type ShopProduct = {
  id?: string
  name?: string
  description?: string
  price?: string
  stock?: number
  active?: boolean
  updatedAt?: string
}

type ShopRecord = {
  id: string
  fullName?: string
  email?: string
  funeralShopInfo?: {
    shopName?: string
  } | null
  funeralProducts?: ShopProduct[]
}

type ProductRow = {
  id: string
  shopId: string
  shopName: string
  ownerName: string
  ownerEmail: string
  name: string
  price: string
  stock: number
  active: boolean
  updatedAt: string
}

type UserProductRecord = {
  id?: string
  name?: string
  description?: string
  price?: string
  stock?: number
  active?: boolean
  updatedAt?: string
}

function normalize(value: string | undefined | null) {
  return String(value || '').trim().toLowerCase()
}

function AdminFuneralItemsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState<ProductRow[]>([])
  const [queryText, setQueryText] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [savingKey, setSavingKey] = useState('')
  const shopFilter = searchParams.get('shop') || ''
  const { openConfirm, confirmDialog } = useConfirmDialog()

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const snapshot = await getDocs(collection(db, 'users'))
      const rows = snapshot.docs.flatMap((itemDoc) => {
        const data = itemDoc.data() as Omit<ShopRecord, 'id'>
        const products = Array.isArray(data.funeralProducts) ? data.funeralProducts : []
        return products.map((product, index) => ({
          id: String(product.id || `${itemDoc.id}_${index}`),
          shopId: itemDoc.id,
          shopName: String(data.funeralShopInfo?.shopName || data.fullName || 'Unnamed Shop'),
          ownerName: String(data.fullName || '-'),
          ownerEmail: String(data.email || '-'),
          name: String(product.name || 'Untitled Item'),
          price: String(product.price || '-'),
          stock: Number(product.stock) || 0,
          active: Boolean(product.active),
          updatedAt: String(product.updatedAt || ''),
        }))
      })
      setItems(rows)
    } catch {
      setError('Unable to load funeral items right now.')
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

    if (shopFilter) {
      list = list.filter((item) => item.shopId === shopFilter)
    }

    if (statusFilter === 'available') {
      list = list.filter((item) => item.active && item.stock > 0)
    } else if (statusFilter === 'soldout') {
      list = list.filter((item) => item.stock <= 0)
    } else if (statusFilter === 'hidden') {
      list = list.filter((item) => !item.active)
    }

    if (!q) return list

    return list.filter((item) =>
      [item.name, item.shopName, item.ownerName, item.ownerEmail].some((value) => normalize(value).includes(q)),
    )
  }, [items, queryText, shopFilter, statusFilter])

  const activeShopName = useMemo(() => {
    if (!shopFilter) return ''
    return items.find((item) => item.shopId === shopFilter)?.shopName || ''
  }, [items, shopFilter])

  const deleteItem = async (item: ProductRow) => {
    openConfirm({
      title: 'Delete this funeral item?',
      message: `This will remove ${item.name} from ${item.shopName}.`,
      details: ['The item will be removed from the shop product list stored on the owner account.'],
      tone: 'danger',
      confirmLabel: 'Delete Item',
      onConfirm: async () => {
        setSavingKey(`${item.shopId}_${item.id}`)
        try {
          const shopDoc = await getDoc(doc(db, 'users', item.shopId))
          if (!shopDoc.exists()) throw new Error('Shop owner record not found.')
          const data = shopDoc.data() as Omit<ShopRecord, 'id'>
          const products = Array.isArray(data.funeralProducts) ? data.funeralProducts : []
          const nextProducts = products.filter((product: UserProductRecord, index) => {
            const productId = String(product.id || `${item.shopId}_${index}`)
            return productId !== item.id
          })

          await updateDoc(doc(db, 'users', item.shopId), {
            funeralProducts: nextProducts,
            updatedAt: serverTimestamp(),
          })
          await load()
        } finally {
          setSavingKey('')
        }
      },
    })
  }

  return (
    <>
      <section className="panel">
        <h2>Funeral Items</h2>
        <p className="panel-sub">
          Review published shop items from funeral accounts.
          {activeShopName ? ` Showing items for ${activeShopName}.` : ''}
        </p>

      <div className="donor-filters donor-filters-advanced">
        <div>
          <label htmlFor="admin-funeral-item-search">Search</label>
          <input
            id="admin-funeral-item-search"
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            placeholder="Item, shop, owner, email"
          />
        </div>
        <div>
          <label htmlFor="admin-funeral-item-status">Item State</label>
          <select id="admin-funeral-item-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="available">Available</option>
            <option value="soldout">Sold Out</option>
            <option value="hidden">Hidden</option>
          </select>
        </div>
        {shopFilter ? (
          <div>
            <label>&nbsp;</label>
            <button type="button" className="ghost-btn table-action" onClick={() => setSearchParams({})}>
              Clear Shop Filter
            </button>
          </div>
        ) : null}
      </div>

      {loading ? <p className="panel-sub">Loading funeral items...</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}
      {!loading && filtered.length === 0 ? <p className="panel-sub">No funeral items found.</p> : null}

        <div className="table-wrap">
          <table className="request-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Shop</th>
                <th>Owner</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const busy = savingKey === `${item.shopId}_${item.id}`
                return (
                  <tr key={`${item.shopId}_${item.id}`}>
                    <td>{item.name}</td>
                    <td>{item.shopName}</td>
                    <td>
                      <strong>{item.ownerName}</strong>
                      <div>{item.ownerEmail}</div>
                    </td>
                    <td>{item.price || '-'}</td>
                    <td>{item.stock}</td>
                    <td>
                      <span className={`status-pill ${item.active ? (item.stock > 0 ? 'verified' : 'pending') : 'rejected'}`}>
                        {item.active ? (item.stock > 0 ? 'available' : 'sold out') : 'hidden'}
                      </span>
                    </td>
                    <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}</td>
                    <td>
                      <div className="request-actions">
                        <button type="button" className="ghost-btn table-action" disabled={busy} onClick={() => void deleteItem(item)}>
                          Delete Item
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

export default AdminFuneralItemsPage
