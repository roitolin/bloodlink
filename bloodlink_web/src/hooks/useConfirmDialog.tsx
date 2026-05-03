import { useMemo, useState } from 'react'

type ConfirmTone = 'primary' | 'success' | 'warning' | 'danger'

type ConfirmConfig = {
  title: string
  message: string
  details?: string[]
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
  onConfirm?: () => void | Promise<void>
}

const toneMeta: Record<ConfirmTone, { kicker: string; className: string }> = {
  primary: { kicker: 'Please Confirm', className: 'primary' },
  success: { kicker: 'Ready To Continue', className: 'success' },
  warning: { kicker: 'Check This First', className: 'warning' },
  danger: { kicker: 'Confirm Action', className: 'danger' },
}

export function useConfirmDialog() {
  const [config, setConfig] = useState<ConfirmConfig | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const closeConfirm = () => {
    if (submitting) return
    setConfig(null)
  }

  const openConfirm = (nextConfig: ConfirmConfig) => {
    setConfig({
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      tone: 'primary',
      ...nextConfig,
    })
  }

  const confirmDialog = useMemo(() => {
    if (!config) return null

    const tone = toneMeta[config.tone || 'primary']

    return (
      <div className="info-modal-overlay" role="presentation" onClick={closeConfirm}>
        <div
          className={`info-modal-card confirm-modal-card ${tone.className}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="info-modal-head confirm-modal-head">
            <div>
              <span className="confirm-modal-kicker">{tone.kicker}</span>
              <h3 id="confirm-dialog-title">{config.title}</h3>
            </div>
            <button type="button" className="ghost-btn info-modal-close" onClick={closeConfirm} disabled={submitting}>
              Close
            </button>
          </div>
          <div className="info-modal-body confirm-modal-body">
            <p>{config.message}</p>
            {config.details?.length ? (
              <ul className="confirm-modal-list">
                {config.details.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            <div className="quick-actions confirm-modal-actions">
              <button type="button" className="ghost-btn" onClick={closeConfirm} disabled={submitting}>
                {config.cancelLabel}
              </button>
              <button
                type="button"
                className={`solid-btn confirm-modal-confirm ${tone.className}`}
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true)
                  try {
                    await config.onConfirm?.()
                    setConfig(null)
                  } finally {
                    setSubmitting(false)
                  }
                }}
              >
                {submitting ? 'Working...' : config.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }, [closeConfirm, config, submitting])

  return { openConfirm, closeConfirm, confirmDialog }
}
