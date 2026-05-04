import { Link } from 'react-router-dom'

function ServiceChoicePage() {
  return (
    <div className="service-choice-shell">
      <div className="service-choice-card">
        <span className="service-choice-kicker">LifeCycle Web</span>
        <h1>Choose a service</h1>
        <p>
          You are inside the LifeCycle hub. Choose which web experience you want to open next.
        </p>

        <div className="service-choice-grid">
          <Link to="/blood" className="service-choice-option service-choice-link-card blood-option" aria-label="Open Blood Web">
            <div className="service-choice-icon" aria-hidden="true">BL</div>
            <h2>Blood</h2>
            <p>Continue to the blood donation web experience for requests, donors, and updates.</p>
            <span className="solid-btn btn-link service-choice-cta">Enter Blood Web</span>
          </Link>

          <Link to="/funeral" className="service-choice-option service-choice-link-card funeral-option" aria-label="Open Funeral Web">
            <div className="service-choice-icon" aria-hidden="true">FN</div>
            <h2>Funeral</h2>
            <p>Continue to the funeral web experience for marketplace browsing, shop access, and service information.</p>
            <span className="service-choice-cta service-choice-cta-funeral">Enter Funeral Web</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ServiceChoicePage
