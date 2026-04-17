import { useState } from 'react'
import type { FormEvent } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

function ReportCenterPage() {
  const [targetUserId, setTargetUserId] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const user = auth.currentUser
    if (!user || !reason.trim()) return
    await addDoc(collection(db, 'reports'), {
      reporterId: user.uid,
      targetUserId: targetUserId.trim() || null,
      reason: reason.trim(),
      createdAt: serverTimestamp(),
      status: 'open',
    })
    setTargetUserId('')
    setReason('')
    setMessage('Report submitted.')
  }

  return (
    <section className="panel">
      <h2>Report Center</h2>
      <p className="panel-sub">Report abusive behavior or suspicious activity.</p>
      {message ? <p className="auth-message auth-message-info">{message}</p> : null}
      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="report-target">Target User ID (optional)</label>
        <input id="report-target" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} />
        <label htmlFor="report-reason">Reason</label>
        <textarea id="report-reason" className="app-textarea" value={reason} onChange={(e) => setReason(e.target.value)} required />
        <button type="submit" className="solid-btn auth-submit">Submit Report</button>
      </form>
    </section>
  )
}

export default ReportCenterPage
