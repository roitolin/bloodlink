import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { findPhilippinePlaceMatch, getPhilippinePlaceSuggestions } from '../../data/philippinePlaces'

type Donor = {
  id: string
  fullName?: string
  email?: string
  contactNumber?: string
  bloodType?: string
  city?: string
  gender?: string
  role?: string
  donorStatus?: string
  availabilityStatus?: string
  medicalCertificateURL?: string
  donationCooldownUntil?: { toDate?: () => Date } | string | null
  location?: { latitude?: number; longitude?: number } | null
  distanceKm?: number
  smartRankScore?: number
  smartRankReasons?: string[]
}

type RequesterProfile = {
  city?: string
  bloodType?: string
  location?: { latitude: number; longitude: number } | null
}

const BLOOD_TYPES = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const CITY_FALLBACK_CENTERS: Record<string, { latitude: number; longitude: number }> = {
  cebu: { latitude: 10.3157, longitude: 123.8854 },
  'cebu city': { latitude: 10.3157, longitude: 123.8854 },
  manila: { latitude: 14.5995, longitude: 120.9842 },
}

function normalize(value: string | undefined) {
  return String(value || '').trim().toLowerCase()
}

function haversineDistanceKm(start: { latitude: number; longitude: number }, end: { latitude: number; longitude: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(end.latitude - start.latitude)
  const dLon = toRad(end.longitude - start.longitude)
  const lat1 = toRad(start.latitude)
  const lat2 = toRad(end.latitude)

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function parseDate(value: { toDate?: () => Date } | string | null | undefined) {
  if (!value) return null
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const date = value.toDate?.()
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null
  }
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

async function geocodeCity(cityName: string): Promise<{ latitude: number; longitude: number } | null> {
  const queryText = findPhilippinePlaceMatch(cityName) || cityName.trim()
  if (!queryText) return null

  const nominatimQueries = [
    `${queryText}, Philippines`,
    `${queryText} municipality, Philippines`,
    `${queryText} city, Philippines`,
    queryText,
  ]
  for (const q of nominatimQueries) {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ph&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`, {
        headers: { 'Accept-Language': 'en' },
      })
      if (!response.ok) continue
      const payload = await response.json()
      const first = Array.isArray(payload)
        ? payload.find((item) => Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lon)))
        : null
      if (!first) continue

      const latitude = Number(first.lat)
      const longitude = Number(first.lon)
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude }
      }
    } catch {
      // try fallback provider
    }
  }

  try {
    const photonResponse = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(`${queryText} Philippines`)}&limit=1&lang=en`,
    )
    if (photonResponse.ok) {
      const photonPayload = await photonResponse.json()
      const coordinates = photonPayload?.features?.[0]?.geometry?.coordinates
      if (Array.isArray(coordinates) && coordinates.length >= 2) {
        const longitude = Number(coordinates[0])
        const latitude = Number(coordinates[1])
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          return { latitude, longitude }
        }
      }
    }
  } catch {
    // fallback to table
  }

  return CITY_FALLBACK_CENTERS[queryText.toLowerCase()] || null
}

function rankDonors(donors: Donor[], options: { selectedBloodType: string; preferredCity: string }) {
  const blood = normalize(options.selectedBloodType)
  const city = normalize(options.preferredCity)

  return donors
    .map((donor) => {
      let score = 0
      const reasons: string[] = []

      if (blood && normalize(donor.bloodType) === blood) {
        score += 35
        reasons.push('Blood type match')
      }

      if (normalize(donor.donorStatus) === 'verified') {
        score += 20
        reasons.push('Verified donor')
      }

      if (donor.medicalCertificateURL) {
        score += 10
        reasons.push('Certificate on file')
      }

      if (city && normalize(donor.city) === city) {
        score += 15
        reasons.push('Same city or municipality')
      }

      if (typeof donor.distanceKm === 'number' && Number.isFinite(donor.distanceKm)) {
        score += Math.max(0, 18 - donor.distanceKm * 1.4)
        if (donor.distanceKm <= 15) reasons.push('Nearby donor')
      }

      return {
        ...donor,
        smartRankScore: Math.round(Math.max(0, Math.min(100, score))),
        smartRankReasons: reasons,
      }
    })
    .sort((a, b) => (b.smartRankScore || 0) - (a.smartRankScore || 0))
}

function SearchDonorsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Donor[]>([])
  const [loading, setLoading] = useState(false)
  const [cityLookupLoading, setCityLookupLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedBloodType, setSelectedBloodType] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [searchRadiusKm, setSearchRadiusKm] = useState('10')
  const [centerLocation, setCenterLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [requesterProfile, setRequesterProfile] = useState<RequesterProfile | null>(null)
  const [cooldownHiddenCount, setCooldownHiddenCount] = useState(0)
  const citySuggestions = getPhilippinePlaceSuggestions(cityFilter, 12)

  useEffect(() => {
    const loadRequesterProfile = async () => {
      const currentUser = auth.currentUser
      if (!currentUser) {
        setRequesterProfile(null)
        return
      }

      try {
        const snapshot = await getDoc(doc(db, 'users', currentUser.uid))
        const data = snapshot.data() as Record<string, unknown> | undefined
        const hasLocation =
          typeof data?.location === 'object' &&
          data.location !== null &&
          typeof (data.location as { latitude?: unknown }).latitude === 'number' &&
          typeof (data.location as { longitude?: unknown }).longitude === 'number'

        setRequesterProfile({
          city: String(data?.city || ''),
          bloodType: String(data?.bloodType || ''),
          location: hasLocation
            ? {
                latitude: Number((data.location as { latitude: number }).latitude),
                longitude: Number((data.location as { longitude: number }).longitude),
              }
            : null,
        })
      } catch {
        setRequesterProfile(null)
      }
    }

    void loadRequesterProfile()
  }, [])

  const load = async () => {
    setLoading(true)
    setCityLookupLoading(false)
    setError('')

    try {
      let effectiveCenter = centerLocation

      if (showAdvancedFilters && cityFilter.trim()) {
        setCityLookupLoading(true)
        const cityLocation = await geocodeCity(cityFilter)
        if (cityLocation) {
          effectiveCenter = cityLocation
          setCenterLocation(cityLocation)
        }
      }

      const snapshot = await getDocs(collection(db, 'users'))
      const now = Date.now()
      let hiddenCount = 0

      let list = snapshot.docs
        .map((itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as Omit<Donor, 'id'>) }))
        .filter((item) => String(item.role || '').toLowerCase() !== 'admin')
        .filter((item) => String(item.availabilityStatus || '').toLowerCase() === 'available')
        .filter((item) => {
          const cooldown = parseDate(item.donationCooldownUntil)
          if (!cooldown) return true
          if (cooldown.getTime() <= now) return true
          hiddenCount += 1
          return false
        })

      const currentUser = auth.currentUser
      if (currentUser) {
        list = list.filter((item) => item.id !== currentUser.uid)
      }

      const rankingCenter = effectiveCenter || requesterProfile?.location || null
      const radius = Number(searchRadiusKm)

      list = list
        .map((item) => {
          const latitude = Number(item.location?.latitude)
          const longitude = Number(item.location?.longitude)
          if (!rankingCenter || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return item
          }

          return {
            ...item,
            distanceKm: haversineDistanceKm(rankingCenter, { latitude, longitude }),
          }
        })
        .filter((item) => {
          const bloodPass =
            !selectedBloodType || String(item.bloodType || '').toUpperCase() === selectedBloodType.toUpperCase()
          const cityPass =
            !cityFilter.trim() || String(item.city || '').toLowerCase().includes(cityFilter.trim().toLowerCase())
          const radiusPass =
            !showAdvancedFilters || !Number.isFinite(radius) || radius <= 0 || typeof item.distanceKm !== 'number'
              ? true
              : item.distanceKm <= radius

          return bloodPass && cityPass && radiusPass
        })

      setCooldownHiddenCount(hiddenCount)
      setItems(
        rankDonors(list, {
          selectedBloodType,
          preferredCity: cityFilter || requesterProfile?.city || '',
        }),
      )
    } catch (caughtError) {
      const messageText =
        typeof caughtError === 'object' && caughtError !== null && 'message' in caughtError
          ? String(caughtError.message)
          : 'Failed to load donors.'
      setError(messageText)
      setItems([])
    } finally {
      setLoading(false)
      setCityLookupLoading(false)
    }
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenterLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude })
        setError('')
      },
      () => {
        setError('Location permission denied or unavailable.')
      },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }

  const openCreateRequestWithDonor = (item: Donor) => {
    const latitude = Number(item.location?.latitude)
    const longitude = Number(item.location?.longitude)

    navigate('/app/create-request', {
      state: {
        fromFindDonor: true,
        donorContext: {
          donorId: item.id,
          fullName: item.fullName || item.email || 'Donor',
          bloodType: item.bloodType || '',
          contactNumber: item.contactNumber || '',
          city: item.city || '',
          location:
            Number.isFinite(latitude) && Number.isFinite(longitude)
              ? { latitude, longitude }
              : null,
        },
      },
    })
  }

  return (
    <section className="panel">
      <h2>Search Donors</h2>
      <p className="panel-sub">Find nearby donors with advanced filters and smart ranking.</p>

      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      <div className="donor-filters">
        <div>
          <label htmlFor="donor-blood">Blood Type</label>
          <select id="donor-blood" value={selectedBloodType} onChange={(event) => setSelectedBloodType(event.target.value)}>
            {BLOOD_TYPES.map((item) => (
              <option key={item || 'all'} value={item}>
                {item || 'Any'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="donor-city">City / Municipality</label>
          <input
            id="donor-city"
            list="search-donor-place-suggestions"
            value={cityFilter}
            onChange={(event) => setCityFilter(event.target.value)}
            placeholder="e.g. Manila or Bacnotan"
          />
          <datalist id="search-donor-place-suggestions">
            {citySuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>

        <button type="button" className="solid-btn" onClick={() => void load()} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div className="donor-filters donor-filters-advanced">
        <label className={`advanced-filter-toggle${showAdvancedFilters ? ' is-on' : ''}`} htmlFor="advanced-filter-toggle">
          <input
            id="advanced-filter-toggle"
            type="checkbox"
            checked={showAdvancedFilters}
            onChange={(event) => setShowAdvancedFilters(event.target.checked)}
          />
          <span className="advanced-filter-toggle-check" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M3 8.5L6.2 11.7L13 4.9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="advanced-filter-toggle-text">Advanced filters</span>
        </label>

        {showAdvancedFilters ? (
          <>
            <div>
              <label htmlFor="donor-radius">Distance Radius (km)</label>
              <input
                id="donor-radius"
                type="number"
                min="1"
                max="100"
                value={searchRadiusKm}
                onChange={(event) => setSearchRadiusKm(event.target.value)}
                placeholder="10"
              />
            </div>

            <button type="button" className="ghost-btn" onClick={useMyLocation}>
              Use My Location
            </button>
          </>
        ) : null}
      </div>

      {showAdvancedFilters && centerLocation ? (
        <p className="panel-sub">
          Search center: {centerLocation.latitude.toFixed(5)}, {centerLocation.longitude.toFixed(5)}
        </p>
      ) : null}
      {cityLookupLoading ? <p className="panel-sub">Locating city or municipality on map...</p> : null}
      {cooldownHiddenCount > 0 ? (
        <p className="panel-sub">
          {cooldownHiddenCount} donor{cooldownHiddenCount > 1 ? 's were' : ' was'} hidden due to donation cooldown.
        </p>
      ) : null}

      <div className="donor-grid">
        {items.map((item) => {
          const latitude = Number(item.location?.latitude)
          const longitude = Number(item.location?.longitude)
          const hasMap = Number.isFinite(latitude) && Number.isFinite(longitude)

          return (
            <article key={item.id} className="donor-card donor-card-ranked">
              <h3>{item.fullName || item.email || 'Unknown User'}</h3>
              <p>Blood Type: {item.bloodType || 'N/A'}</p>
              <p>Location: {item.city || 'Unknown City'}</p>
              <p>Availability: {String(item.availabilityStatus || 'unknown')}</p>
              {typeof item.distanceKm === 'number' ? <p>Distance: {item.distanceKm.toFixed(1)} km</p> : null}

              {typeof item.smartRankScore === 'number' ? (
                <div className="donor-rank-box">
                  <strong>Smart Rank: {item.smartRankScore}/100</strong>
                  {item.smartRankReasons?.length ? <span>{item.smartRankReasons.join(' | ')}</span> : null}
                </div>
              ) : null}

              <div className="request-actions">
                <button type="button" className="solid-btn" onClick={() => openCreateRequestWithDonor(item)}>
                  Request Blood
                </button>
              </div>

              {hasMap ? (
                <>
                  <iframe
                    title={`map-${item.id}`}
                    className="map-frame"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${latitude + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}`}
                  />
                  <a
                    className="ghost-btn btn-link map-open-btn"
                    href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Google Maps
                  </a>
                </>
              ) : (
                <p className="panel-sub">No map pin shared.</p>
              )}
            </article>
          )
        })}

        {!loading && items.length === 0 ? <p className="panel-sub">No donors matched your filters.</p> : null}
      </div>
    </section>
  )
}

export default SearchDonorsPage
