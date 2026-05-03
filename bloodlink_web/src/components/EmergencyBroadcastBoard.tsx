import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

type BroadcastRecord = {
  id: string
  message?: string
  urgency?: 'Critical' | 'Urgent' | 'Normal'
  status?: 'active' | 'resolved'
  targetCity?: string | null
  targetBloodType?: string | null
  createdAt?: { toDate?: () => Date } | string | null
  expiresAt?: { toDate?: () => Date } | string | null
}

type Props = {
  viewerCity?: string
  viewerBloodType?: string
  limit?: number
  title?: string
}

function normalize(value: string | undefined | null) {
  return String(value || '').trim().toLowerCase()
}

function toDate(value: BroadcastRecord['createdAt'] | BroadcastRecord['expiresAt']) {
  if (!value) return null
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return value.toDate?.() || null
  }
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function urgencyClass(urgency: string | undefined) {
  if (urgency === 'Critical') return 'critical'
  if (urgency === 'Urgent') return 'urgent'
  return 'normal'
}

function timeLeftLabel(expiresAt: BroadcastRecord['expiresAt']) {
  const expiryDate = toDate(expiresAt)
  if (!expiryDate) return 'No expiry set'
  const remainingMs = expiryDate.getTime() - Date.now()
  if (remainingMs <= 0) return 'Expired'
  const minutes = Math.floor(remainingMs / 60000)
  if (minutes < 60) return `${minutes}m left`
  const hours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  if (hours < 24) return remMinutes === 0 ? `${hours}h left` : `${hours}h ${remMinutes}m left`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours === 0 ? `${days}d left` : `${days}d ${remHours}h left`
}

function EmergencyBroadcastBoard({
  viewerCity = '',
  viewerBloodType = '',
  limit = 2,
  title = 'Emergency Broadcasts',
}: Props) {
  const [items, setItems] = useState<BroadcastRecord[]>([])

  useEffect(() => {
    const emergencyQuery = query(collection(db, 'emergency_broadcasts'), where('status', '==', 'active'))
    const unsubscribe = onSnapshot(emergencyQuery, (snapshot) => {
      const now = Date.now()
      const list = snapshot.docs
        .map((itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as Omit<BroadcastRecord, 'id'>) }))
        .filter((item) => {
          const expiresAt = toDate(item.expiresAt)
          if (expiresAt && expiresAt.getTime() <= now) return false
          const cityTarget = normalize(item.targetCity || '')
          const bloodTarget = normalize(item.targetBloodType || '')
          if (cityTarget && cityTarget !== normalize(viewerCity)) return false
          if (bloodTarget && bloodTarget !== normalize(viewerBloodType)) return false
          return true
        })
        .sort((a, b) => {
          const aTime = toDate(a.createdAt)?.getTime() || 0
          const bTime = toDate(b.createdAt)?.getTime() || 0
          return bTime - aTime
        })
      setItems(list)
    })

    return () => unsubscribe()
  }, [viewerBloodType, viewerCity])

  const visibleItems = useMemo(() => items.slice(0, limit), [items, limit])
  if (visibleItems.length === 0) return null

  return (
    <article className="panel feed-block emergency-card">
      <header className="emergency-card-head">
        <h3>{title}</h3>
        <span className="emergency-live-pill">Live: {visibleItems.length}</span>
      </header>
      <p className="emergency-card-sub">
        Priority alerts relevant to your location and blood type.
      </p>
      <div className="notification-list emergency-list">
        {visibleItems.map((item) => (
          <article key={item.id} className="notification-item emergency-item">
            <header className="emergency-item-head">
              <span className={`status-pill ${urgencyClass(item.urgency)}`}>
                {item.urgency || 'Emergency'}
              </span>
              <span className="emergency-time-pill">{timeLeftLabel(item.expiresAt)}</span>
            </header>
            <p className="emergency-message">{item.message || 'Emergency alert posted.'}</p>
            <div className="emergency-meta-row">
              <span className="emergency-meta-pill">
                {item.targetCity ? `City: ${item.targetCity}` : 'Coverage: Nationwide'}
              </span>
              {item.targetBloodType ? (
                <span className="emergency-meta-pill">Blood: {item.targetBloodType}</span>
              ) : null}
              {toDate(item.expiresAt) ? (
                <span className="emergency-meta-pill">Until {toDate(item.expiresAt)?.toLocaleString()}</span>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </article>
  )
}

export default EmergencyBroadcastBoard
