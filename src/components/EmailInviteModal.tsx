import { useState, type FormEvent } from 'react'
import type { Identity } from '../lib/identity'
import {
  buildEmailInviteMailto,
  buildEmailInviteUrl,
  createEmailInvite,
  rememberSentEmailInvite,
} from '../lib/emailInvites'
import { copyText, formatDeadline, toDateTimeLocalValue } from '../lib/format'
import { Icon } from './Icon'
import { Modal } from './Modal'

type EmailInviteModalProps = {
  identity: Identity
  initialAsk: string
  initialDeadline: string
  inviterName: string
  onClose: () => void
}

type InviteResult = {
  email: string
  link: string
  mailto: string
  deadline: number | null
  metadataSynced: boolean
}

export function EmailInviteModal({
  identity,
  initialAsk,
  initialDeadline,
  inviterName,
  onClose,
}: EmailInviteModalProps) {
  const [email, setEmail] = useState('')
  const [ask, setAsk] = useState(initialAsk)
  const [deadline, setDeadline] = useState(initialDeadline)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [result, setResult] = useState<InviteResult | null>(null)
  const [minimumDeadline] = useState(() => toDateTimeLocalValue(new Date()))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    const cleanAsk = ask.trim()
    const cleanEmail = email.trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address.')
      return
    }

    if (!cleanAsk) {
      setError('Write the ask before creating the invitation.')
      return
    }

    const deadlineTime = deadline ? new Date(deadline).getTime() : null

    if (deadlineTime !== null && deadlineTime <= Date.now()) {
      setError('Choose a deadline in the future, or leave it empty.')
      return
    }

    setBusy(true)

    try {
      const invite = await createEmailInvite(identity, {
        recipientEmail: cleanEmail,
        ask: cleanAsk,
        deadline: deadlineTime,
      })
      const link = buildEmailInviteUrl(invite.event.id, invite.secretKey)
      const mailto = buildEmailInviteMailto({
        recipientEmail: cleanEmail,
        inviterName,
        link,
      })
      const metadataSync = rememberSentEmailInvite(identity, {
        id: invite.inviteId,
        eventId: invite.event.id,
        email: cleanEmail,
        createdAt: invite.event.created_at * 1000,
      })

      setResult({
        email: cleanEmail,
        link,
        mailto,
        deadline: deadlineTime,
        metadataSynced: true,
      })
      window.location.href = mailto

      const metadataSynced = await metadataSync
      setResult((current) =>
        current ? { ...current, metadataSynced } : current,
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The email invitation could not be created.',
      )
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async () => {
    if (!result) return

    try {
      await copyText(result.link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  if (result) {
    return (
      <Modal
        eyebrow="Email invitation"
        onClose={onClose}
        open
        title="Your ask is ready to send."
      >
        <div className="email-invite-result">
          <span className="sent-icon email-invite-result-icon">
            <Icon name="mail" size={26} />
          </span>
          <p>
            An email draft for <strong>{result.email}</strong> should have
            opened. The message links to a private invitation.
          </p>
          {result.deadline !== null && (
            <span className="deadline-pill">
              <Icon name="clock" size={14} />
              {formatDeadline(result.deadline)}
            </span>
          )}
          {!result.metadataSynced && (
            <p className="form-error">
              The email is ready, but we couldn&apos;t update your sent list
              yet. It may appear without an email label in your sent asks.
            </p>
          )}
          <div className="button-row button-row--center">
            <a className="button button--primary button--small" href={result.mailto}>
              <Icon name="send" size={16} />
              Open email app
            </a>
            <button
              className="button button--secondary button--small"
              onClick={copyLink}
              type="button"
            >
              <Icon name={copied ? 'check' : 'copy'} size={16} />
              {copied ? 'Copied' : 'Copy invite link'}
            </button>
          </div>
          <p className="microcopy">
            Opening the link shows them your ask and adds you to their
            contacts. No password needed.
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      eyebrow="A new person"
      onClose={onClose}
      open
      title="Invite by email"
      wide
    >
      <form className="compose-form email-invite-form" onSubmit={handleSubmit}>
        <p className="auth-lede">
          Send this ask to someone by email. Your email app opens with the
          invitation ready to send.
        </p>

        <label className="field">
          <span className="field-label">Recipient email</span>
          <input
            autoComplete="email"
            className="text-input"
            onChange={(event) => {
              setEmail(event.target.value)
              setError('')
            }}
            placeholder="friend@example.com"
            type="email"
            value={email}
          />
        </label>

        <label className="field">
          <span className="field-label">
            Your ask <span className="field-optional">required</span>
          </span>
          <textarea
            className="text-area"
            maxLength={2000}
            onChange={(event) => {
              setAsk(event.target.value)
              setError('')
            }}
            placeholder="Ask them for something specific…"
            rows={5}
            value={ask}
          />
          <span className="field-count">{ask.length} / 2000</span>
        </label>

        <label className="field">
          <span className="field-label">
            Deadline <span className="field-optional">optional</span>
          </span>
          <input
            className="text-input"
            min={minimumDeadline}
            onChange={(event) => {
              setDeadline(event.target.value)
              setError('')
            }}
            type="datetime-local"
            value={deadline}
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button
          className="button button--primary button--wide"
          disabled={busy}
          type="submit"
        >
          <Icon name="mail" />
          {busy ? 'Sending…' : 'Create & open email'}
        </button>
        <p className="compose-note email-invite-note">
          Opening the link shows them your ask. No password needed.
        </p>
      </form>
    </Modal>
  )
}
