import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDoc, arrayRemove, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { getAdminId } from '@/utils/adminConfig'
import { ensureConversationForUsers } from '@/utils/chatHelpers'

const SUPPORT_EMAIL = 'support@bloodlink.app'
const isPermissionDeniedError = (error: unknown) => {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : ''
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : ''
  return code === 'permission-denied' || /missing or insufficient permissions/i.test(message)
}

function ContactSupportPage() {
  const navigate = useNavigate()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('')
  const user = auth.currentUser

  const canSend = useMemo(() => subject.trim().length > 0 && message.trim().length > 0 && !sending, [subject, message, sending])

  const ensureSupportConversation = async () => {
    if (!user) {
      throw new Error('Please log in again before contacting support.')
    }

    const adminId = await getAdminId({
      excludeUserId: user.uid,
      allowExcludedFallback: true,
    })
    if (!adminId) {
      throw new Error('Support chat is unavailable because no admin support account is configured yet.')
    }

    const conversationId = await ensureConversationForUsers(db, user.uid, adminId)
    const conversationRef = doc(db, 'conversations', conversationId)

    return { adminId, conversationId, conversationRef }
  }

  const sendInAppSupportMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      setStatus('Please log in again before sending support messages.')
      return
    }
    const cleanSubject = subject.trim()
    const cleanMessage = message.trim()
    if (!cleanSubject || !cleanMessage) {
      setStatus('Please enter both subject and message.')
      return
    }

    setSending(true)
    setStatus('')
    try {
      const { adminId, conversationId, conversationRef } = await ensureSupportConversation()

      const text = `${cleanSubject}\n\n${cleanMessage}`
      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        text,
        senderId: user.uid,
        timestamp: serverTimestamp(),
        readBy: [user.uid],
      })

      await updateDoc(conversationRef, {
        updatedAt: serverTimestamp(),
        hiddenFor: arrayRemove(user.uid, adminId),
        lastMessage: {
          text,
          senderId: user.uid,
          timestamp: serverTimestamp(),
          readBy: [user.uid],
        },
      })

      await addDoc(collection(db, 'notifications'), {
        userId: adminId,
        type: 'support_message',
        title: `New Support Message from ${user.email || 'User'}`,
        body: text.length > 100 ? `${text.slice(0, 100)}...` : text,
        read: false,
        createdAt: serverTimestamp(),
        data: { conversationId, otherUserId: user.uid },
      })

      setSubject('')
      setMessage('')
      setStatus('Support message sent. Opening your messages...')
      navigate(`/app?openMessages=1&conversation=${encodeURIComponent(conversationId)}&otherUserId=${encodeURIComponent(adminId)}`)
    } catch (caughtError) {
      if (isPermissionDeniedError(caughtError)) {
        try {
          await addDoc(collection(db, 'supportMessages'), {
            userId: user.uid,
            email: user.email || null,
            subject: cleanSubject,
            message: cleanMessage,
            read: false,
            status: 'open',
            createdAt: serverTimestamp(),
            channel: 'contact_fallback',
          })
          setSubject('')
          setMessage('')
          setStatus('Live chat could not open, but your message was still sent to the support inbox.')
          return
        } catch {
          // Fall through to the friendly status below.
        }
      }

      const messageText =
        typeof caughtError === 'object' && caughtError !== null && 'message' in caughtError
          ? String(caughtError.message)
          : 'Unable to send support message right now.'
      setStatus(
        isPermissionDeniedError(caughtError)
          ? 'Support chat is currently unavailable for this account, and the fallback inbox could not be reached.'
          : messageText,
      )
    } finally {
      setSending(false)
    }
  }

  const sendViaGmail = () => {
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${encodeURIComponent(subject || 'LifeCycle Support')}&body=${encodeURIComponent(message || 'Hello Support Team, I need help with LifeCycle.')}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="panel">
      <h2>Contact Support</h2>
      <p className="panel-sub">Send an in-app support message so it appears directly in Support Inbox.</p>

      {status ? <p className="auth-message auth-message-info">{status}</p> : null}

      <form className="auth-form" onSubmit={(event) => void sendInAppSupportMessage(event)}>
        <label htmlFor="support-subject">Subject</label>
        <input id="support-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />

        <label htmlFor="support-message">Message</label>
        <textarea id="support-message" className="app-textarea" value={message} onChange={(e) => setMessage(e.target.value)} />

        <div className="request-actions">
          <button className="solid-btn auth-submit" type="submit" disabled={!canSend}>
            {sending ? 'Sending...' : 'Send In-App'}
          </button>
          <button className="ghost-btn auth-submit" type="button" onClick={sendViaGmail}>
            Send via Gmail
          </button>
        </div>
      </form>
    </section>
  )
}

export default ContactSupportPage
