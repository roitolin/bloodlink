import { useState } from 'react'

function ContactSupportPage() {
  const supportEmail = 'support@bloodlink.app'
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  const openGmail = () => {
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(supportEmail)}&su=${encodeURIComponent(subject || 'BloodLink Support')}&body=${encodeURIComponent(message || 'Hello Support Team, I need help with BloodLink.')}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="panel">
      <h2>Contact Support</h2>
      <p className="panel-sub">Send an email support request.</p>
      <form className="auth-form" onSubmit={(e) => { e.preventDefault(); openGmail() }}>
        <label htmlFor="support-subject">Subject</label>
        <input id="support-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <label htmlFor="support-message">Message</label>
        <textarea id="support-message" className="app-textarea" value={message} onChange={(e) => setMessage(e.target.value)} />
        <button className="solid-btn auth-submit" type="submit">Send via Gmail</button>
      </form>
    </section>
  )
}

export default ContactSupportPage
