import { Link } from 'react-router-dom'

function ServiceChoicePage() {
  return (
    <div className="service-choice-shell">
      <div className="service-choice-card">
        <span className="service-choice-kicker">LifeCycle Web</span>
        <h1>Choose a service</h1>
        <p>
          Select where you want to continue. You can open the blood web section or the funeral web section directly.
        </p>

        <div className="service-choice-grid">
          <article className="service-choice-option blood-option">
            <div className="service-choice-icon" aria-hidden="true">🩸</div>
            <h2>Blood</h2>
            <p>Open the blood donation web experience for requests, donors, and updates.</p>
            <Link to="/blood" className="solid-btn btn-link">
              Open Blood Web
            </Link>
          </article>

          <article className="service-choice-option funeral-option">
            <div className="service-choice-icon" aria-hidden="true">⚘</div>
            <h2>Funeral</h2>
            <p>Open the funeral web section for funeral shop access and service information.</p>
            <Link to="/funeral" className="ghost-btn btn-link">
              Open Funeral Web
            </Link>
          </article>
        </div>
      </div>
    </div>
  )
}

export default ServiceChoicePage
