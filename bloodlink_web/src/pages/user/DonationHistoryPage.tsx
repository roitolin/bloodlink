import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

type Donation = { id: string; bloodType?: string; status?: string; createdAt?: { toDate?: () => Date } | string | null }

function DonationHistoryPage() {
  const [items, setItems] = useState<Donation[]>([])

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser
      if (!user) return
      try {
        const snap = await getDocs(query(collection(db, 'donations'), where('donorId', '==', user.uid)))
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Donation, 'id'>) })))
      } catch {
        setItems([])
      }
    }
    void load()
  }, [])

  return (
    <section className="panel">
      <h2>Donation History & Certificates</h2>
      <p className="panel-sub">Your donation history appears here.</p>
      <div className="notification-list">
        {items.length === 0 ? <p className="panel-sub">No donation records yet.</p> : null}
        {items.map((item) => <article key={item.id} className="notification-item"><h3>{item.bloodType || 'Unknown'} donation</h3><p>Status: {item.status || 'N/A'}</p></article>)}
      </div>
    </section>
  )
}

export default DonationHistoryPage
