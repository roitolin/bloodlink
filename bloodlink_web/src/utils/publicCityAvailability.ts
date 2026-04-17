import { collection, doc, getDocs, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore'

type CityCountItem = {
  cityKey: string
  cityLabel: string
  donors: number
  requests: number
}

function normalizeCity(value: string | undefined | null) {
  const base = String(value || '').trim().toLowerCase()
  if (!base) return ''

  const noPrefix = base.replace(/^(city|municipality) of\s+/, '')
  const noSuffix = noPrefix.replace(/\s+(city|municipality)$/, '')
  return noSuffix
}

function toCityLabel(normalizedCity: string) {
  return normalizedCity
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export async function syncPublicCityAvailability(db: Firestore) {
  const [usersSnap, requestsSnap, publicSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'requests')),
    getDocs(collection(db, 'public_city_availability')),
  ])

  const cityMap = new Map<string, CityCountItem>()

  usersSnap.docs
    .map((itemDoc) => itemDoc.data() as { role?: string; availabilityStatus?: string; city?: string })
    .filter((item) => String(item.role || '').toLowerCase() !== 'admin')
    .filter((item) => String(item.availabilityStatus || '').toLowerCase() === 'available')
    .forEach((item) => {
      const cityKey = normalizeCity(item.city)
      if (!cityKey) return
      const current = cityMap.get(cityKey) || { cityKey, cityLabel: toCityLabel(cityKey), donors: 0, requests: 0 }
      current.donors += 1
      cityMap.set(cityKey, current)
    })

  requestsSnap.docs
    .map((itemDoc) => itemDoc.data() as { status?: string; city?: string })
    .filter((item) => {
      const status = String(item.status || '').toLowerCase()
      return status === 'pending' || status === 'accepted'
    })
    .forEach((item) => {
      const cityKey = normalizeCity(item.city)
      if (!cityKey) return
      const current = cityMap.get(cityKey) || { cityKey, cityLabel: toCityLabel(cityKey), donors: 0, requests: 0 }
      current.requests += 1
      cityMap.set(cityKey, current)
    })

  const batch = writeBatch(db)
  const nextKeys = new Set(cityMap.keys())

  publicSnap.docs.forEach((itemDoc) => {
    if (!nextKeys.has(itemDoc.id)) {
      batch.delete(itemDoc.ref)
    }
  })

  cityMap.forEach((item, cityKey) => {
    batch.set(doc(db, 'public_city_availability', cityKey), {
      cityKey,
      cityLabel: item.cityLabel,
      donors: item.donors,
      requests: item.requests,
      updatedAt: serverTimestamp(),
    })
  })

  await batch.commit()
}
