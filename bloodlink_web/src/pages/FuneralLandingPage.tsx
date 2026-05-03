import { Link } from 'react-router-dom'

function FuneralLandingPage() {
  return (
    <div className="funeral-landing-shell">
      <div className="funeral-landing-card">
        <span className="service-choice-kicker funeral-kicker">LifeCycle Funeral</span>
        <h1>Funeral Web</h1>
        <p className="funeral-landing-copy">
          This is the funeral web entry page. From here, users can continue through the shared account flow before
          accessing funeral-related features.
        </p>

        <div className="funeral-landing-actions">
          <Link to="/login" className="solid-btn btn-link">
            Login
          </Link>
          <Link to="/register" className="ghost-btn btn-link">
            Register
          </Link>
          <Link to="/" className="back-btn btn-link funeral-back-btn">
            Back to Choices
          </Link>
        </div>
      </div>
    </div>
  )
}

export default FuneralLandingPage
