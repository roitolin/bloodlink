import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { collection, getDocs } from 'firebase/firestore'
import HowToDonateFaq from '../components/HowToDonateFaq'
import { fetchPhilippineCitiesAndMunicipalities } from '../data/philippineCities'
import { getPhilippinePlaceSuggestions } from '../data/philippinePlaces'
import { auth, db } from '@/lib/firebase'
import { syncPublicCityAvailability } from '../utils/publicCityAvailability'

const capabilities = [
  {
    title: 'Smart Donor Search',
    body: 'AI-driven matching based on proximity, blood type, and historical availability.',
    icon: 'search',
    tone: 'danger',
  },
  {
    title: 'Request Tracking',
    body: 'Real-time visibility into the status of your blood request from dispatch to arrival.',
    icon: 'tracking',
    tone: 'primary',
  },
  {
    title: 'Built-in Messaging',
    body: 'Secure, encrypted communication between requesters and potential donors.',
    icon: 'message',
    tone: 'danger',
  },
  {
    title: 'Verified Workflow',
    body: 'Rigorous multi-step verification process ensuring donor medical eligibility.',
    icon: 'shield',
    tone: 'primary',
  },
  {
    title: 'Location Sharing',
    body: 'Privacy-first GPS mapping to coordinate the fastest donation logistics.',
    icon: 'map',
    tone: 'danger',
  },
  {
    title: 'Emergency Broadcast',
    body: 'Urgent blood alerts can be pushed by city and blood type so the right donors are reached quickly.',
    icon: 'broadcast',
    tone: 'primary',
  },
]

const steps = [
  {
    title: 'Create Account',
    body: 'Register once and use the same profile across mobile and web.',
  },
  {
    title: 'Request or Donate',
    body: 'Post a request or volunteer as an available donor in your area.',
  },
  {
    title: 'Connect & Save Lives',
    body: 'Coordinate faster and complete blood donations safely.',
  },
]

type CityCountItem = {
  cityKey: string
  cityLabel: string
  donors: number
  requests: number
}

type BloodTypeSummary = {
  donors: number
  requests: number
}

type InfoModalType = 'privacy' | 'terms' | 'support' | 'contact'

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

function normalizeCity(value: string | undefined | null) {
  const base = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9]+/i, '')
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

function normalizeBloodType(value: string | undefined | null) {
  return String(value || '').trim().toUpperCase()
}

function buildCityMapWithAllPhilippinePlaces(placeLabels: string[]) {
  const cityMap: Record<string, CityCountItem> = {}

  placeLabels.forEach((cityLabel) => {
    const cityKey = normalizeCity(cityLabel)
    if (!cityKey) return
    if (!cityMap[cityKey]) {
      cityMap[cityKey] = { cityKey, cityLabel, donors: 0, requests: 0 }
    }
  })

  return cityMap
}

function CapabilityIcon({ icon }: { icon: string }) {
  if (icon === 'search') {
    return (
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
        <circle cx="10" cy="10" r="5.5" />
        <path d="M14 14l5 5" />
      </svg>
    )
  }
  if (icon === 'tracking') {
    return (
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
        <path d="M4 16l4-5 3 3 4-6 5 8" />
        <circle cx="11" cy="17" r="2.6" />
      </svg>
    )
  }
  if (icon === 'message') {
    return (
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
        <path d="M4 6h12v8H8l-4 4z" />
        <path d="M10 10h10v8h-8" />
      </svg>
    )
  }
  if (icon === 'shield') {
    return (
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
        <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    )
  }
  if (icon === 'broadcast') {
    return (
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
        <path d="M3 10l12-6v12L3 10z" />
        <path d="M15 8.5a4 4 0 010 7" />
        <path d="M17.5 6a7 7 0 010 12" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
      <path d="M4 6l8-3 8 3v12l-8 3-8-3z" />
      <path d="M8 7v10M16 7v10" />
    </svg>
  )
}

function LandingPage() {
  const [activeSection, setActiveSection] = useState('home')
  const [viewer, setViewer] = useState<User | null>(auth.currentUser)
  const [statsLoading, setStatsLoading] = useState(true)
  const [cityCounts, setCityCounts] = useState<CityCountItem[]>([])
  const [bloodTypeCounts, setBloodTypeCounts] = useState<Record<string, BloodTypeSummary>>({})
  const [cityQuery, setCityQuery] = useState('')
  const [bloodTypeFilter, setBloodTypeFilter] = useState('')
  const [infoModal, setInfoModal] = useState<InfoModalType | null>(null)

  useEffect(() => {
    const ids = ['home', 'features', 'about-us', 'how', 'how-donate', 'city-availability']
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((item): item is HTMLElement => Boolean(item))

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target?.id) {
          setActiveSection(visible.target.id)
        }
      },
      {
        rootMargin: '-32% 0px -50% 0px',
        threshold: [0.2, 0.4, 0.65],
      },
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setViewer(nextUser)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const loadCounts = async () => {
      const placeLabels = await fetchPhilippineCitiesAndMunicipalities()

      setStatsLoading(true)

      try {
        if (viewer) {
          await syncPublicCityAvailability(db)
        }
        const publicSnap = await getDocs(collection(db, 'public_city_availability'))

        const cityMap = buildCityMapWithAllPhilippinePlaces(placeLabels)
        const nextBloodTypeCounts: Record<string, BloodTypeSummary> = {}

        publicSnap.docs.forEach((itemDoc) => {
          const item = itemDoc.data() as Partial<CityCountItem>
          const cityKey = normalizeCity(item.cityKey || item.cityLabel)
          if (!cityKey) return
          cityMap[cityKey] = {
            cityKey,
            cityLabel: String(item.cityLabel || toCityLabel(cityKey)),
            donors: Number(item.donors || 0),
            requests: Number(item.requests || 0),
          }
        })

        if (viewer) {
          const [usersSnap, requestsSnap] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'requests')),
          ])

          usersSnap.docs
            .map((itemDoc) => itemDoc.data() as { role?: string; availabilityStatus?: string; city?: string; bloodType?: string })
            .filter((item) => String(item.role || '').toLowerCase() !== 'admin')
            .filter((item) => String(item.availabilityStatus || '').toLowerCase() === 'available')
            .forEach((item) => {
              const cityKey = normalizeCity(item.city)
              const bloodType = normalizeBloodType(item.bloodType)
              if (!cityKey || !bloodType) return
              const mapKey = `${cityKey}::${bloodType}`
              const current = nextBloodTypeCounts[mapKey] || { donors: 0, requests: 0 }
              current.donors += 1
              nextBloodTypeCounts[mapKey] = current
            })

          requestsSnap.docs
            .map((itemDoc) => itemDoc.data() as { status?: string; city?: string; bloodTypeNeeded?: string })
            .filter((item) => {
              const status = String(item.status || '').toLowerCase()
              return status === 'pending' || status === 'accepted'
            })
            .forEach((item) => {
              const cityKey = normalizeCity(item.city)
              const bloodType = normalizeBloodType(item.bloodTypeNeeded)
              if (!cityKey || !bloodType) return
              const mapKey = `${cityKey}::${bloodType}`
              const current = nextBloodTypeCounts[mapKey] || { donors: 0, requests: 0 }
              current.requests += 1
              nextBloodTypeCounts[mapKey] = current
            })
        }

        const nextCityCounts = Object.values(cityMap)
          .sort((a, b) => (b.donors + b.requests) - (a.donors + a.requests) || a.cityLabel.localeCompare(b.cityLabel))

        setCityCounts(nextCityCounts)
        setBloodTypeCounts(nextBloodTypeCounts)
      } catch {
        setCityCounts([])
        setBloodTypeCounts({})
      } finally {
        setStatsLoading(false)
      }
    }

    void loadCounts()
  }, [viewer])

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id)
    if (!target) return
    setActiveSection(id)
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const filteredCityCounts = useMemo(() => {
    const query = cityQuery.trim().toLowerCase()
    if (!query) return []
    return cityCounts.filter((item) => item.cityLabel.toLowerCase().includes(query)).slice(0, 30)
  }, [cityCounts, cityQuery])

  const selectedCity = useMemo(() => {
    const query = normalizeCity(cityQuery)
    if (!query) return null
    return cityCounts.find((item) => item.cityKey === query || normalizeCity(item.cityLabel) === query) || filteredCityCounts[0] || null
  }, [cityQuery, cityCounts, filteredCityCounts])

  const filteredTotals = useMemo(() => {
    if (!selectedCity) return { donors: 0, requests: 0 }
    if (!bloodTypeFilter) return { donors: selectedCity.donors, requests: selectedCity.requests }
    return bloodTypeCounts[`${selectedCity.cityKey}::${bloodTypeFilter}`] || { donors: 0, requests: 0 }
  }, [selectedCity, bloodTypeFilter, bloodTypeCounts])

  const citySuggestions = useMemo(() => getPhilippinePlaceSuggestions(cityQuery, 12), [cityQuery])

  const infoModalMeta: Record<InfoModalType, { title: string; paragraphs: string[] }> = {
    privacy: {
      title: 'Privacy Policy',
      paragraphs: [
        'Bloodlink collects only the information needed to coordinate blood donation requests, including profile and contact details shared by users.',
        'This data is used for matching, communication, and operational safety. We do not sell personal data to third parties.',
        'For data review or account concerns, contact support at Bloodlink@gmail.com.',
      ],
    },
    terms: {
      title: 'Terms of Service',
      paragraphs: [
        'Users must provide accurate information and use Bloodlink only for legitimate donation and request coordination.',
        'Abuse, impersonation, or misuse of donor/request data may lead to suspension or permanent account restrictions.',
        'Bloodlink supports coordination workflows and does not replace licensed medical judgment.',
      ],
    },
    support: {
      title: 'Support Center',
      paragraphs: [
        'Need help with account access, donor verification, request updates, or reports? Our support team can assist.',
        'For faster support, include your city, blood type, and request ID when applicable.',
        'Email: Bloodlink@gmail.com | Phone: 09959281914',
      ],
    },
    contact: {
      title: 'Contact Us',
      paragraphs: [
        'You can reach Bloodlink for coordination concerns, technical questions, and platform feedback.',
        'Email: Bloodlink@gmail.com',
        'Phone: 09959281914',
      ],
    },
  }

  return (
    <div className="landing-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/Logo.png" alt="Bloodlink logo" className="brand-logo" />
          <strong>Bloodlink</strong>
        </Link>

        <nav className="topnav" aria-label="Main">
          <a
            href="#home"
            className={activeSection === 'home' ? 'active' : ''}
            aria-current={activeSection === 'home' ? 'page' : undefined}
            onClick={(event) => { event.preventDefault(); scrollToSection('home') }}
          >
            Home
          </a>
          <a
            href="#features"
            className={activeSection === 'features' ? 'active' : ''}
            aria-current={activeSection === 'features' ? 'page' : undefined}
            onClick={(event) => { event.preventDefault(); scrollToSection('features') }}
          >
            Features
          </a>
          <a
            href="#how"
            className={activeSection === 'how' ? 'active' : ''}
            aria-current={activeSection === 'how' ? 'page' : undefined}
            onClick={(event) => { event.preventDefault(); scrollToSection('how') }}
          >
            How It Works
          </a>
          <a
            href="#how-donate"
            className={activeSection === 'how-donate' ? 'active' : ''}
            aria-current={activeSection === 'how-donate' ? 'page' : undefined}
            onClick={(event) => { event.preventDefault(); scrollToSection('how-donate') }}
          >
            How to Donate
          </a>
          <a
            href="#city-availability"
            className={activeSection === 'city-availability' ? 'active' : ''}
            aria-current={activeSection === 'city-availability' ? 'page' : undefined}
            onClick={(event) => { event.preventDefault(); scrollToSection('city-availability') }}
          >
            Availability
          </a>
          <a
            href="#about-us"
            className={activeSection === 'about-us' ? 'active' : ''}
            aria-current={activeSection === 'about-us' ? 'page' : undefined}
            onClick={(event) => { event.preventDefault(); scrollToSection('about-us') }}
          >
            About Us
          </a>
          <a
            href="#contact"
            className={activeSection === 'contact' ? 'active' : ''}
            aria-current={activeSection === 'contact' ? 'page' : undefined}
            onClick={(event) => { event.preventDefault(); scrollToSection('contact') }}
          >
            Contact Us
          </a>
        </nav>

        <div className="top-actions">
          <Link to="/login" className="ghost-btn btn-link">Login</Link>
          <Link to="/register" className="solid-btn btn-link">Register</Link>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-copy reveal">
            <p className="kicker">BLOOD DONATION NETWORK</p>
            <h1>Connecting lives through faster blood donation response.</h1>
            <p className="hero-sub">
              Bloodlink connects donors, requesters, and hospitals in one shared platform so urgent
              blood requests are handled quickly.
            </p>
            <div className="hero-buttons">
              <Link to="/login" className="solid-btn btn-link">Request Blood</Link>
              <Link to="/login" className="ghost-btn btn-link">Become a Donor</Link>
            </div>
          </div>

          <div className="hero-visual reveal" role="img" aria-label="Doctor holding blood bag">
            <div className="hero-radial" aria-hidden="true" />
            <img src="/Doctor.png" alt="Doctor holding blood bag" />
          </div>
        </section>

        <section className="how capabilities-section" id="features">
          <div className="section-head section-head-centered reveal">
            <h2>Life-saving infrastructure.</h2>
            <p className="features-subtitle">Advanced tools designed for clinical precision and human urgency.</p>
          </div>
          <div className="capability-grid">
            {capabilities.map((item) => (
              <article className={`capability-card reveal capability-card-${item.tone}`} key={item.title}>
                <span className="capability-icon" aria-hidden="true">
                  <CapabilityIcon icon={item.icon} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="how how-steps-spotlight" id="how">
          <div className="section-head reveal">
            <p className="kicker">HOW BLOODLINK WORKS</p>
            <h2>Three steps to save a life.</h2>
            <p className="how-steps-subtitle">Simplified logistics for complex emergencies.</p>
          </div>
          <div className="steps how-steps-grid">
            {steps.map((item, index) => (
              <article className="step-card step-card-dark reveal" key={item.title}>
                <span className="step-index step-index-ghost">{index + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="how-donate reveal" id="how-donate">
          <HowToDonateFaq />
        </section>

        <section className="how realtime-availability-section" id="city-availability">
          <div className="realtime-layout">
            <aside className="realtime-search-panel reveal">
              <h2>Real-time Availability</h2>
              <p>
                Search across cities in the Philippines to find available donors or view current emergency blood
                requests.
              </p>
              <div className="availability-badges">
                <span className="availability-badge">Public Visibility</span>
                <span className="availability-badge">Live Donor Count</span>
                <span className="availability-badge">Live Request Count</span>
              </div>
              <div className="realtime-city-search">
                <label htmlFor="city-search-input">Search city</label>
                <div className="realtime-city-input-wrap">
                  <span aria-hidden="true">⌕</span>
                  <input
                    id="city-search-input"
                    type="text"
                    list="philippine-place-suggestions"
                    value={cityQuery}
                    onChange={(event) => setCityQuery(event.target.value)}
                    placeholder="Manila"
                  />
                </div>
                <datalist id="philippine-place-suggestions">
                  {citySuggestions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
              <div className="realtime-city-search">
                <label htmlFor="blood-type-filter">Blood type</label>
                <div className="realtime-select-wrap">
                  <select id="blood-type-filter" value={bloodTypeFilter} onChange={(event) => setBloodTypeFilter(event.target.value)}>
                    <option value="">All Blood Types</option>
                    {BLOOD_TYPES.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
              </div>
            </aside>

            <div className="realtime-results-panel reveal">
              {statsLoading ? <p className="panel-sub">Loading city and municipality data...</p> : null}
              {!statsLoading && cityQuery.trim() && filteredCityCounts.length === 0 ? <p className="panel-sub">No matching city or municipality found.</p> : null}
              <div className="availability-summary-head">
                <h3>{selectedCity?.cityLabel || "Choose a city to view totals"}</h3>
                <p>
                  Guests can view donor and request totals. Login is required to request blood or accept donation tasks.
                </p>
              </div>
              <div className="realtime-summary-grid">
                <article className="summary-stat-card summary-stat-card-danger">
                  <h4>Active Requests</h4>
                  <p>{filteredTotals.requests}</p>
                </article>
                <article className="summary-stat-card summary-stat-card-primary">
                  <h4>Available Donors</h4>
                  <p>{filteredTotals.donors}</p>
                </article>
              </div>
              <div className="availability-cta-row">
                <Link to="/login" className="ghost-btn btn-link">Login to Request Blood</Link>
                <Link to="/register" className="solid-btn btn-link">Join as Donor</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="how about-mission-section" id="about-us">
          <div className="about-mission-grid">
            <article className="about-mission-copy reveal">
              <h2>Our Compassionate Mission</h2>
              <p>
                Bloodlink was founded on a simple realization: the technology exists to order a meal in minutes, but
                finding life-saving blood often takes hours of frantic social media posts and phone calls.
              </p>
              <p>
                We provide a digital bridge between donors, requesters, and hospitals so urgent cases move faster and
                decisions are made with clearer data.
              </p>
              <p>
                Our goal is practical and human: reduce waiting time, improve trust, and make blood donation
                coordination safer for everyone involved.
              </p>
            </article>

            <article className="about-mission-visual reveal">
              <p>&quot;In the moments where time stands still, Bloodlink makes the move.&quot;</p>
              <div className="about-mission-pillars">
                <div className="about-mission-pillar">
                  <h4>Speed With Purpose</h4>
                  <p>Match urgent requests to available donors in real time.</p>
                </div>
                <div className="about-mission-pillar">
                  <h4>Verified Coordination</h4>
                  <p>Support safer workflows with traceable, accountable updates.</p>
                </div>
                <div className="about-mission-pillar">
                  <h4>Community Lifeline</h4>
                  <p>Serve cities and municipalities across the Philippines with one shared network.</p>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="cta-banner reveal">
          <div>
            <h2>Ready to make a difference today?</h2>
            <p>Create your account and start saving lives with Bloodlink.</p>
          </div>
          <Link to="/register" className="solid-btn btn-link cta-link">Create Account</Link>
        </section>
      </main>

      <footer className="footer" id="contact">
        <div className="footer-main">
          <div className="footer-column footer-brand-column">
            <h3>Bloodlink</h3>
            <p>
              Empowering the Philippine medical community through instantaneous donation logistics and verified donor
              networks.
            </p>
            <div className="footer-social-links" aria-label="Social links">
              <a href="#home" aria-label="Back to top" onClick={(event) => { event.preventDefault(); scrollToSection('home') }}>◎</a>
              <a href="#city-availability" aria-label="Go to availability" onClick={(event) => { event.preventDefault(); scrollToSection('city-availability') }}>✚</a>
              <a href="mailto:Bloodlink@gmail.com?subject=Bloodlink%20Support" aria-label="Email Bloodlink">✉</a>
            </div>
          </div>
          <div className="footer-column">
            <h4>Quick Links</h4>
            <div className="footer-links">
              <button type="button" className="footer-link-btn" onClick={() => setInfoModal('privacy')}>Privacy Policy</button>
              <button type="button" className="footer-link-btn" onClick={() => setInfoModal('terms')}>Terms of Service</button>
              <button type="button" className="footer-link-btn" onClick={() => setInfoModal('contact')}>Contact Us</button>
            </div>
          </div>
          <div className="footer-column">
            <h4>Support</h4>
            <div className="footer-support-list">
              <a href="mailto:Bloodlink@gmail.com"><span aria-hidden="true">✉</span> Bloodlink@gmail.com</a>
              <a href="tel:09959281914"><span aria-hidden="true">☎</span> 09959281914</a>
              <a href="#city-availability" onClick={(event) => { event.preventDefault(); scrollToSection('city-availability') }}>
                <span aria-hidden="true">◌</span> 24/7 Emergency Response
              </a>
            </div>
          </div>
        </div>
        <p className="footer-bottom">© 2026 BloodLink. All rights reserved.</p>
      </footer>

      {infoModal ? (
        <div className="info-modal-overlay" role="presentation" onClick={() => setInfoModal(null)}>
          <div
            className="info-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="info-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="info-modal-head">
              <h3 id="info-modal-title">{infoModalMeta[infoModal].title}</h3>
              <button type="button" className="ghost-btn info-modal-close" onClick={() => setInfoModal(null)}>
                Close
              </button>
            </div>
            <div className="info-modal-body">
              {infoModalMeta[infoModal].paragraphs.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default LandingPage





