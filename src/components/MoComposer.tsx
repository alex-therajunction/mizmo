import { useMemo, useState, type FormEvent } from 'react'
import {
  isEmailAddress,
  normalizeEmail,
  type EmailContact,
} from '../hooks/useEmailContacts'
import {
  buildEmailInviteMailto,
  buildEmailInviteUrl,
  createEmailInvite,
  rememberSentEmailInvite,
} from '../lib/emailInvites'
import { copyText, displayName, toDateTimeLocalValue } from '../lib/format'
import type { Identity } from '../lib/identity'
import { sendMizmo, type ProfileData } from '../lib/nostr'
import { Icon } from './Icon'

type MoComposerProps = {
  identity: Identity
  contacts: string[]
  emailContacts: EmailContact[]
  profiles: Record<string, ProfileData | null>
  inviterName: string
  onAddContact: (pubkey: string) => Promise<void>
  onAddEmailContact: (email: string) => void
  onEmailSent: () => void
}

type SendNotice =
  | { kind: 'contact'; name: string }
  | {
      kind: 'email'
      email: string
      link: string
      mailto: string
      metadataSynced: boolean
    }

export function MoComposer({
  identity,
  contacts,
  emailContacts,
  profiles,
  inviterName,
  onAddContact,
  onAddEmailContact,
  onEmailSent,
}: MoComposerProps) {
  const [ask, setAsk] = useState('')
  const [deadline, setDeadline] = useState('')
  const [selectedRecipient, setSelectedRecipient] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState<SendNotice | null>(null)
  const [minimumDeadline] = useState(() => toDateTimeLocalValue(new Date()))
  const sortedContacts = useMemo(
    () =>
      [...contacts].sort((a, b) =>
        contactName(a, profiles).localeCompare(contactName(b, profiles)),
      ),
    [contacts, profiles],
  )
  const sendsByEmail =
    Boolean(email.trim()) || selectedRecipient.startsWith('email:')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice(null)
    setCopied(false)

    const cleanAsk = ask.trim()
    const cleanEmail = normalizeEmail(email)
    const selectedEmail = selectedRecipient.startsWith('email:')
      ? selectedRecipient.slice('email:'.length)
      : ''
    const selectedContact = selectedRecipient.startsWith('nostr:')
      ? selectedRecipient.slice('nostr:'.length)
      : ''

    if (!cleanAsk) {
      setError('Write the task or ask you want to send.')
      return
    }

    if (cleanEmail && !isEmailAddress(cleanEmail)) {
      setError('Enter a valid email address, or clear it to pick a contact.')
      return
    }

    const deadlineTime = deadline ? new Date(deadline).getTime() : null

    if (deadlineTime !== null && deadlineTime <= Date.now()) {
      setError('Choose a deadline in the future, or leave it empty.')
      return
    }

    const emailTarget = cleanEmail || selectedEmail

    if (!emailTarget && !selectedContact) {
      setError('Select a contact or enter an email address.')
      return
    }

    setSending(true)

    try {
      if (emailTarget) {
        const invite = await createEmailInvite(identity, {
          recipientEmail: emailTarget,
          ask: cleanAsk,
          deadline: deadlineTime,
        })
        const link = buildEmailInviteUrl(invite.event.id, invite.secretKey)
        const mailto = buildEmailInviteMailto({
          recipientEmail: emailTarget,
          inviterName,
          link,
        })
        const metadataSync = rememberSentEmailInvite(identity, {
          id: invite.inviteId,
          eventId: invite.event.id,
          email: emailTarget,
          createdAt: invite.event.created_at * 1000,
        })

        onAddEmailContact(emailTarget)
        setNotice({
          kind: 'email',
          email: emailTarget,
          link,
          mailto,
          metadataSynced: true,
        })
        setAsk('')
        setDeadline('')
        setSelectedRecipient('')
        setEmail('')
        window.location.href = mailto

        const metadataSynced = await metadataSync
        setNotice((current) =>
          current?.kind === 'email'
            ? { ...current, metadataSynced }
            : current,
        )
        onEmailSent()
        return
      }

      const recipient = selectedContact
      await sendMizmo(
        {
          recipient,
          ask: cleanAsk,
          deadline: deadlineTime,
        },
        identity.secretKey,
      )
      setNotice({
        kind: 'contact',
        name: contactName(recipient, profiles),
      })
      setAsk('')
      setDeadline('')
      setSelectedRecipient('')
      onAddContact(recipient).catch(() => undefined)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Your ask could not be sent. Try again.',
      )
    } finally {
      setSending(false)
    }
  }

  const copyInviteLink = async () => {
    if (notice?.kind !== 'email') return

    try {
      await copyText(notice.link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="mo-composer">
      <div className="mo-composer-head">
        <div>
          <p className="eyebrow">Quick send</p>
          <h2>What do you need?</h2>
        </div>
        <span className="encrypted-badge">
          <Icon name="lock" size={14} /> private
        </span>
      </div>

      <form className="compose-form mo-composer-form" onSubmit={handleSubmit}>
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
            placeholder="Ask for something specific…"
            rows={4}
            value={ask}
          />
          <span className="field-count">{ask.length} / 2000</span>
        </label>

        <div className="mo-recipient-grid">
          <label className="field">
            <span className="field-label">Choose a contact</span>
            <select
              className="text-input"
              onChange={(event) => {
                setSelectedRecipient(event.target.value)
                if (event.target.value) setEmail('')
                setError('')
              }}
              value={selectedRecipient}
            >
              <option value="">Choose a contact…</option>
              {sortedContacts.length > 0 && (
                <optgroup label="My contacts">
                  {sortedContacts.map((pubkey) => (
                    <option key={pubkey} value={`nostr:${pubkey}`}>
                      {contactName(pubkey, profiles)}
                    </option>
                  ))}
                </optgroup>
              )}
              {emailContacts.length > 0 && (
                <optgroup label="Email contacts">
                  {emailContacts.map((contact) => (
                    <option
                      key={contact.email}
                      value={`email:${contact.email}`}
                    >
                      {contact.email}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

          <span className="mo-recipient-or">or</span>

          <label className="field">
            <span className="field-label">Enter an email</span>
            <input
              autoComplete="email"
              className="text-input"
              onChange={(event) => {
                setEmail(event.target.value)
                if (event.target.value) setSelectedRecipient('')
                setError('')
              }}
              placeholder="friend@example.com"
              type="email"
              value={email}
            />
          </label>
        </div>

        <label className="field">
          <span className="field-label">
            Deadline <span className="field-optional">optional</span>
          </span>
          <input
            className="text-input"
            min={minimumDeadline}
            onChange={(event) => setDeadline(event.target.value)}
            type="datetime-local"
            value={deadline}
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button
          className="button button--primary button--wide"
          disabled={sending}
          type="submit"
        >
          <Icon name={sendsByEmail ? 'mail' : 'send'} />
          {sending
            ? 'Sending…'
            : sendsByEmail
              ? 'Send by email'
              : 'Send ask'}
        </button>
      </form>

      {notice && (
        <div className="mo-composer-notice" role="status">
          {notice.kind === 'contact' ? (
            <p>
              <Icon name="check" size={16} /> Sent to {notice.name}. It&apos;s
              now in your sent asks.
            </p>
          ) : (
            <>
              <p>
                <Icon name="mail" size={16} /> Email draft opened for{' '}
                {notice.email}.
              </p>
              {!notice.metadataSynced && (
                <p className="form-error">
                  The email is ready, but we couldn&apos;t update your sent list
                  yet.
                </p>
              )}
              <div className="button-row">
                <a
                  className="button button--secondary button--small"
                  href={notice.mailto}
                >
                  <Icon name="send" size={14} />
                  Open email app
                </a>
                <button
                  className="button button--ghost button--small"
                  onClick={copyInviteLink}
                  type="button"
                >
                  <Icon name={copied ? 'check' : 'copy'} size={14} />
                  {copied ? 'Copied' : 'Copy invite link'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}

function contactName(
  pubkey: string,
  profiles: Record<string, ProfileData | null>,
): string {
  const profile = profiles[pubkey]
  return displayName(pubkey, profile?.displayName || profile?.name)
}
