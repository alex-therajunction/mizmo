import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Event } from 'nostr-tools'
import { AuthPanel } from '../components/AuthPanel'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { useIdentity } from '../context/useIdentity'
import { useProfile } from '../hooks/useProfile'
import {
  acceptEmailInvite,
  fetchEmailInviteEvent,
  readEmailInviteFromHash,
  type AcceptedEmailInvite,
} from '../lib/emailInvites'
import { deadlineFromEvent } from '../lib/nostr'
import { displayName, formatDeadline } from '../lib/format'

type PagePhase = 'idle' | 'accepting' | 'accepted' | 'error'

export function JoinPage() {
  const { identity } = useIdentity()
  const [link] = useState(() => readEmailInviteFromHash(window.location.hash))
  const [preview, setPreview] = useState<Event | null>(null)
  const [previewLoading, setPreviewLoading] = useState(Boolean(link))
  const [previewError, setPreviewError] = useState('')
  const [previewAttempt, setPreviewAttempt] = useState(0)
  const [phase, setPhase] = useState<PagePhase>('idle')
  const [error, setError] = useState('')
  const [accepted, setAccepted] = useState<AcceptedEmailInvite | null>(null)
  const acceptStarted = useRef(false)
  const { profile } = useProfile(preview?.pubkey ?? null)

  const inviterName = preview
    ? displayName(preview.pubkey, profile?.displayName || profile?.name)
    : 'Someone'
  const deadline = preview ? deadlineFromEvent(preview) : null

  useEffect(() => {
    if (!link) return

    let active = true

    fetchEmailInviteEvent(link)
      .then((event) => {
        if (!active) return
        setPreview(event)
        setPreviewLoading(false)
      })
      .catch((caught) => {
        if (!active) return
        setPreviewError(
          caught instanceof Error
            ? caught.message
            : 'This invitation could not be loaded.',
        )
        setPreviewLoading(false)
      })

    return () => {
      active = false
    }
  }, [link, previewAttempt])

  const retryPreview = () => {
    setPreviewLoading(true)
    setPreviewError('')
    setPreviewAttempt((attempt) => attempt + 1)
  }

  const runAccept = useCallback(async () => {
    if (!identity || !link) return

    setPhase('accepting')
    setError('')

    try {
      const result = await acceptEmailInvite(identity, link)
      setAccepted(result)
      setPhase('accepted')
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}`,
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'This invitation could not be accepted.',
      )
      setPhase('error')
    }
  }, [identity, link])

  useEffect(() => {
    if (!identity) {
      acceptStarted.current = false
      return
    }

    if (
      !link ||
      previewLoading ||
      previewError ||
      acceptStarted.current ||
      (preview?.pubkey === identity.pubkey)
    ) {
      return
    }

    acceptStarted.current = true
    void runAccept()
  }, [identity, link, preview, previewError, previewLoading, runAccept])

  const retryAccept = () => {
    acceptStarted.current = true
    void runAccept()
  }

  if (!link) {
    return (
      <div className="page empty-page join-page">
        <span className="empty-glyph">
          <Icon name="mail" size={30} />
        </span>
        <p className="eyebrow">Email invitation</p>
        <h1>This invite link is incomplete.</h1>
        <p>The link may have been cut off by the email app. Ask for it again.</p>
        <Link className="button button--primary" to="/">
          Back home
          <Icon name="arrow-right" />
        </Link>
      </div>
    )
  }

  if (phase === 'accepted' && accepted && identity) {
    return (
      <div className="page join-page">
        <section className="join-card join-card--result">
          <span className="sent-icon">
            <Icon name="check" size={28} />
          </span>
          <p className="eyebrow">Mizmo received</p>
          <h1>{inviterName}&apos;s ask is in your mi.</h1>
          <div className="join-mizmo-preview">
            <p>{accepted.invite.ask}</p>
            {accepted.invite.deadline !== null && (
              <span className="deadline-pill">
                <Icon name="clock" size={14} />
                {formatDeadline(accepted.invite.deadline)}
              </span>
            )}
          </div>
          <p className="join-lede">
            {inviterName} was added to your contacts automatically. The mizmo
            is encrypted to your key and synced to your account.
          </p>
          {!accepted.contactAdded && (
            <p className="form-error">
              The mizmo arrived, but {inviterName} could not be added to your
              contacts yet. Reopen this link to retry.
            </p>
          )}
          {!accepted.claimPublished && (
            <p className="form-error">
              The mizmo arrived, but the sender could not be notified yet.
              Reopen this link to retry.
            </p>
          )}
          {!accepted.metadataSynced && (
            <p className="form-error">
              The mizmo is saved on this device, but it could not sync to your
              relays yet.
            </p>
          )}
          <Link
            className="button button--primary button--wide"
            to={`/${identity.npub}`}
          >
            Open my mi
            <Icon name="arrow-right" />
          </Link>
        </section>
      </div>
    )
  }

  if (previewLoading) {
    return (
      <div className="page empty-page join-page">
        <span className="empty-glyph">
          <Icon name="mail" size={30} />
        </span>
        <p className="eyebrow">Email invitation</p>
        <h1>Finding your mizmo…</h1>
        <p>Checking the relays for the encrypted invitation.</p>
      </div>
    )
  }

  if (previewError) {
    return (
      <div className="page empty-page join-page">
        <span className="empty-glyph">
          <Icon name="mail" size={30} />
        </span>
        <p className="eyebrow">Email invitation</p>
        <h1>We couldn&apos;t find it yet.</h1>
        <p>{previewError}</p>
        <div className="button-row button-row--center">
          <button
            className="button button--primary"
            onClick={retryPreview}
            type="button"
          >
            Try again
            <Icon name="arrow-right" />
          </button>
          <Link className="button button--ghost" to="/">
            Back home
          </Link>
        </div>
      </div>
    )
  }

  if (identity && preview?.pubkey === identity.pubkey) {
    return (
      <div className="page join-page">
        <section className="join-card join-card--result">
          <span className="sent-icon email-invite-result-icon">
            <Icon name="mail" size={28} />
          </span>
          <p className="eyebrow">Your invitation</p>
          <h1>You sent this mizmo.</h1>
          <p className="join-lede">
            Open your mo to see whether the recipient has accepted it.
          </p>
          <Link
            className="button button--primary button--wide"
            to={`/${identity.npub}`}
          >
            Open my mo
            <Icon name="arrow-right" />
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="page join-page">
      <section className="join-card">
        <p className="eyebrow">A private invitation</p>
        <h1>{inviterName} sent you a mizmo.</h1>
        <p className="join-lede">
          Sign in with your key or create a new one. Your key stays in this
          browser, and opening the invitation adds {inviterName} to your
          contacts automatically.
        </p>

        <div className="join-sender">
          <Avatar
            name={inviterName}
            picture={profile?.picture}
            pubkey={preview?.pubkey ?? ''}
            size={48}
          />
          <div>
            <span className="settings-label">From</span>
            <strong>{inviterName}</strong>
            <span className="join-private-note">
              <Icon name="key" size={13} /> encrypted ask
            </span>
          </div>
          {deadline !== null && (
            <span className="deadline-pill">
              <Icon name="clock" size={14} />
              {formatDeadline(deadline)}
            </span>
          )}
        </div>

        {phase === 'accepting' || (identity && phase === 'idle') ? (
          <div className="join-accepting" aria-live="polite">
            <span className="status-dot is-pulsing" />
            Adding the mizmo to your mi…
          </div>
        ) : phase === 'error' ? (
          <div className="join-error">
            <p className="form-error">{error}</p>
            <button
              className="button button--primary button--wide"
              onClick={retryAccept}
              type="button"
            >
              Try accepting again
              <Icon name="arrow-right" />
            </button>
          </div>
        ) : (
          <div className="join-auth">
            <AuthPanel />
          </div>
        )}

        <p className="microcopy join-note">
          The invitation link is a private capability. Anyone who receives it
          can open this mizmo.
        </p>
      </section>
    </div>
  )
}
