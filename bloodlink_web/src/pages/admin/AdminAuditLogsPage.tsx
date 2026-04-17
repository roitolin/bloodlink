import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

type AuditLog = {
  id: string
  summary?: string
  action?: string
  targetType?: string
  targetId?: string
  adminId?: string
  createdAt?: { toDate?: () => Date } | string | null
}

function toDateText(value: AuditLog['createdAt']) {
  if (!value) return '-'
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return value.toDate?.()?.toLocaleString() || '-'
  }
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString()
}

function AdminAuditLogsPage() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AuditLog[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const snapshot = await getDocs(collection(db, 'admin_audit_logs'))
        const list = snapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as Omit<AuditLog, 'id'>) }))
        list.sort((a, b) => new Date(toDateText(b.createdAt)).getTime() - new Date(toDateText(a.createdAt)).getTime())
        setItems(list)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  return (
    <section className="panel">
      <h2>Audit Logs</h2>
      <p className="panel-sub">Review admin actions for traceability.</p>
      {loading ? <p className="panel-sub">Loading audit logs...</p> : null}
      {!loading && items.length === 0 ? <p className="panel-sub">No audit logs found.</p> : null}

      <div className="table-wrap">
        <table className="request-table">
          <thead>
            <tr>
              <th>Summary</th>
              <th>Action</th>
              <th>Target</th>
              <th>Admin</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 120).map((item) => (
              <tr key={item.id}>
                <td>{item.summary || '-'}</td>
                <td>{item.action || '-'}</td>
                <td>{item.targetType || '-'} {item.targetId ? `(${item.targetId})` : ''}</td>
                <td>{item.adminId || '-'}</td>
                <td>{toDateText(item.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AdminAuditLogsPage

