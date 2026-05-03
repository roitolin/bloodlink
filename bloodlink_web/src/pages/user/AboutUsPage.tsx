import { useState } from 'react'

type AboutSection = {
  title: string
  description: string
  symbol: string
}

type Member = {
  name: string
  role: string
  photoURL: string
  quote: string
}

const highlights = [
  { value: '24/7', label: 'Urgent Support' },
  { value: 'Fast', label: 'Donor Matching' },
  { value: 'Safe', label: 'Verified Process' },
]

const sections: AboutSection[] = [
  {
    title: 'LifeCycle',
    symbol: 'P',
    description:
      'LifeCycle connects donors and requesters faster during urgent blood needs. Our mission is to make blood donation more accessible, reliable, and community-driven.',
  },
  {
    title: 'Why We Built This',
    symbol: 'M',
    description:
      'Many families struggle to find blood donors during emergencies, often posting repeatedly on social media to be noticed. LifeCycle gives them a dedicated place where urgent requests can be seen quickly and matched with willing donors.',
  },
  {
    title: 'Our Mission',
    symbol: 'H',
    description:
      'We help patients and families find blood donors quickly while promoting safe, responsible donation practices.',
  },
  {
    title: 'Our Vision',
    symbol: 'S',
    description:
      'A connected community where no blood request is ignored and every willing donor can help save lives.',
  },
]

const systemMembers: Member[] = [
  {
    name: 'Roi Veinze A. Tolin',
    role: 'Team Member',
    photoURL: '/member-photos/roi-veinze-tolin.png',
    quote:
      'Your blood is a small gift with a monumental impact. Together, we can build a stronger, healthier world through compassion. Donate today.',
  },
  {
    name: 'Mary Sheen Punay',
    role: 'Team Member',
    photoURL: '/member-photos/mary-sheen-punay.png',
    quote:
      'Every donor gives more than blood. They give hope, time, and another chance for someone to keep living.',
  },
  {
    name: 'Daisy Derial',
    role: 'Team Member',
    photoURL: '/member-photos/daisy-derial.jpg',
    quote:
      'Compassion becomes powerful when it moves quickly. LifeCycle helps communities respond when every minute matters.',
  },
  {
    name: 'Ezra Baguhin',
    role: 'Team Member',
    photoURL: '/member-photos/ezra-baguhin.png',
    quote:
      'One simple act of donation can connect strangers, strengthen families, and save lives in the moments that count most.',
  },
  {
    name: 'Samuel Monares',
    role: 'Team Member',
    photoURL: '/member-photos/samuel-monares-jr.png',
    quote:
      'When people come together for a shared purpose, urgent blood needs turn into stories of survival and community.',
  },
  {
    name: 'Cyrus Dan Coyoca',
    role: 'Team Member',
    photoURL: '/member-photos/cyrus-coyoca.jpg',
    quote:
      'Technology should serve humanity. LifeCycle is built to make help visible, reachable, and immediate for those in need.',
  },
]

function AboutUsPage() {
  const [activeMember, setActiveMember] = useState<Member | null>(null)

  return (
    <section className="panel">
      <h2>About Us</h2>
      <div className="blood-locator-divider" />
      <div className="about-grid">
        <article className="about-mobile-hero">
          <div className="about-mobile-hero-glow about-mobile-hero-glow-top" />
          <div className="about-mobile-hero-glow about-mobile-hero-glow-bottom" />
          <p className="about-mobile-badge">Community Powered</p>
          <h3>About LifeCycle</h3>
          <p className="about-mobile-subtitle">
            We are building a faster, more human way to connect blood donors and people in urgent
            need.
          </p>
          <div className="about-mobile-highlight-row">
            {highlights.map((item) => (
              <article key={item.label} className="about-mobile-highlight-card">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>
        </article>

        {sections.map((section) => (
          <article key={section.title} className="about-card about-mobile-section-card">
            <div className="about-mobile-card-head">
              <span className="about-mobile-icon-wrap" aria-hidden="true">
                {section.symbol}
              </span>
              <h3>{section.title}</h3>
            </div>
            <p>{section.description}</p>
          </article>
        ))}

        <article className="about-card members-showcase">
          <div className="about-mobile-card-head">
            <span className="about-mobile-icon-wrap" aria-hidden="true">
              U
            </span>
            <h3>System Members</h3>
          </div>
          <div className="members-showcase-meta">{systemMembers.length} Members</div>
          <p>Core team behind LifeCycle. Click a member to view details.</p>
          <div className="members-grid">
            {systemMembers.map((member) => (
              <button
                key={member.name}
                type="button"
                className="member-tile member-tile-btn"
                onClick={() => setActiveMember(member)}
              >
                <img src={member.photoURL} alt={member.name} className="member-photo" />
                <strong>{member.name}</strong>
                <span className="member-role">{member.role}</span>
              </button>
            ))}
          </div>
        </article>
      </div>

      {activeMember ? (
        <div className="about-member-modal-overlay" role="presentation" onClick={() => setActiveMember(null)}>
          <article
            className="about-member-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label={`${activeMember.name} profile`}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="ghost-btn about-member-modal-close" onClick={() => setActiveMember(null)}>
              Close
            </button>
            <div className="about-member-fallback about-member-banner">
              <header className="about-member-banner-head">
                <h3>{activeMember.name}</h3>
                <p>{activeMember.role}</p>
              </header>
              <div className="about-member-banner-body">
                <div className="about-member-banner-photo-wrap">
                  <img
                    src={activeMember.photoURL}
                    alt={activeMember.name}
                    className="about-member-fallback-photo about-member-banner-photo"
                  />
                </div>
                <blockquote className="about-member-banner-quote">&quot;{activeMember.quote}&quot;</blockquote>
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  )
}

export default AboutUsPage
