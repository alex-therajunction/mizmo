import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { nip19 } from 'nostr-tools'
import { AuthPanel } from '../components/AuthPanel'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { MizmoCard } from '../components/MizmoCard'
import { useIdentity } from '../context/useIdentity'
import { useMizmos } from '../hooks/useMizmos'
import { useProfile } from '../hooks/useProfile'
import type { Identity } from '../lib/identity'
import {
  copyText,
  displayName,
  formatDeadline,
  shortenId,
  toDateTimeLocalValue,
} from '../lib/format'
import {
  normalizeNostrId,
  sendMizmo,
  type ProfileData,
} from '../lib/nostr'

type ProfilePageProps = {
  onOpenAuth: () => void
}

export function ProfilePage({ onOpenAuth }: ProfilePageProps) {
  const { id } = useParams()
  const { identity } = useIdentity()
  const pubkey = useMemo(() => (id ? normalizeNostrId(id) : null), [id])
  const { profile, loading } = useProfile(pubkey)

  if (!pubkey) return <InvalidAddress />

  const isOwn = identity?.pubkey === pubkey

  return (
    <div className="page profile-page">
      <ProfileHero
        isOwn={isOwn}
        loading={loading}
        profile={profile}
        pubkey={pubkey}
      />

      {isOwn && identity ? (
        <OwnDashboard identity={identity} />
      ) : identity ? (
        <SendMizmo
          identity={identity}
          profile={profile}
          pubkey={pubkey}
        />
      ) : (
        <section className="signed-out-contact">
          <div className="auth-callout-copy">
            <p className="eyebrow">Your move</p>
            <h2>Sign in to send a mizmo.</h2>
            <p>
              You need a Nostr key to sign and encrypt the ask. Create one here
              or bring an existing key — either way it stays in this browser.
            </p>
            <button
              className="text-button"
              onClick={onOpenAuth}
              type="button"
            >
              Prefer a pop-up? Sign in here
              <Icon name="arrow-right" size={16} />
            </button>
          </div>
          <div className="onboarding-card onboarding-card--contact">
            <AuthPanel />
          </div>
        </section>
      )}
    </div>
  )
}

function ProfileHero({
  pubkey,
  profile,
  isOwn,
  loading,
}: {
  pubkey: string
  profile: ProfileData | null
  isOwn: boolean
  loading: boolean
}) {
  const [copied, setCopied] = useState(false)
  const name = displayName(pubkey, profile?.displayName || profile?.name)
  const handle = profile?.nip05 || shortenId(pubkey, 16, 10)
  const address = `${window.location.origin}/${nip19.npubEncode(pubkey)}`

  const copyAddress = async () => {
    try {
      await copyText(address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="profile-hero">
      <div className="profile-main">
        <Avatar
          name={name}
          picture={profile?.picture}
          pubkey={pubkey}
          size={82}
        />
        <div className="profile-copy">
          <p className="eyebrow">
            {isOwn ? 'Your mizmo address' : 'Send a mizmo to'}
          </p>
          <h1>{isOwn ? 'Your mi & mo' : loading ? 'Finding…' : name}</h1>
          <p className="profile-handle" title={pubkey}>
            {handle}
          </p>
          {profile?.about && !isOwn && (
            <p className="profile-about">{profile.about}</p>
          )}
        </div>
      </div>

      <button
        className="button button--secondary button--small"
        onClick={copyAddress}
        type="button"
      >
        <Icon name={copied ? 'check' : 'copy'} size={16} />
        {copied ? 'Address copied' : isOwn ? 'Copy my address' : 'Copy address'}
      </button>
    </section>
  )
}

function SendMizmo({
  identity,
  pubkey,
  profile,
}: {
  identity: Identity
  pubkey: string
  profile: ProfileData | null
}) {
  const [ask, setAsk] = useState('')
  const [deadline, setDeadline] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState<{ deadline: number | null } | null>(null)
  const recipientName = displayName(
    pubkey,
    profile?.displayName || profile?.name,
  )
  const [minimumDeadline] = useState(() => toDateTimeLocalValue(new Date()))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const cleanAsk = ask.trim()

    if (!cleanAsk) {
      setError('Write the ask first.')
      return
    }

    const deadlineTime = deadline ? new Date(deadline).getTime() : null

    if (deadlineTime !== null && deadlineTime <= Date.now()) {
      setError('Choose a deadline in the future, or leave it empty.')
      return
    }

    setSending(true)

    try {
      await sendMizmo(
        {
          recipient: pubkey,
          ask: cleanAsk,
          deadline: deadlineTime,
        },
        identity.secretKey,
      )
      setSent({ deadline: deadlineTime })
      setAsk('')
      setDeadline('')
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The mizmo could not be sent. Try again.',
      )
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <section className="sent-card">
        <span className="sent-icon">
          <Icon name="check" size={28} />
        </span>
        <p className="eyebrow">Mizmo sent</p>
        <h2>It&apos;s in {recipientName}&apos;s mi.</h2>
        <p>
          The ask was encrypted and published to your Nostr relays.
          {sent.deadline
            ? ` The deadline is ${formatDeadline(sent.deadline)}.`
            : ' No deadline was set.'}
        </p>
        <div className="button-row button-row--center">
          <button
            className="button button--primary"
            onClick={() => setSent(null)}
            type="button"
          >
            Send another
            <Icon name="arrow-right" />
          </button>
          <Link className="button button--ghost" to={`/${identity.npub}`}>
            Go to my mi
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="compose-card">
      <div className="compose-heading">
        <div>
          <p className="eyebrow">Write a mizmo</p>
          <h2>What do you need?</h2>
        </div>
        <span className="encrypted-badge">
          <Icon name="key" size={14} /> encrypted
        </span>
      </div>

      <form className="compose-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">
            The ask <span className="field-optional">required</span>
          </span>
          <textarea
            className="text-area"
            maxLength={2000}
            onChange={(event) => setAsk(event.target.value)}
            placeholder={`Ask ${recipientName} for something specific…`}
            rows={6}
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
            onChange={(event) => setDeadline(event.target.value)}
            type="datetime-local"
            value={deadline}
          />
          <span className="field-hint">
            Leave it empty if there&apos;s no particular rush.
          </span>
        </label>

        {error && <p className="form-error">{error}</p>}

        <button
          className="button button--primary button--wide"
          disabled={sending}
          type="submit"
        >
          <Icon name="send" />
          {sending ? 'Encrypting & publishing…' : `Send mizmo to ${recipientName}`}
        </button>
      </form>

      <p className="compose-note">
        Your ask is NIP-44 encrypted. The recipient and deadline tags remain
        public relay metadata.
      </p>
    </section>
  )
}

function OwnDashboard({ identity }: { identity: Identity }) {
  const { inbox, outbox, status } = useMizmos(identity)
  const [tab, setTab] = useState<'mi' | 'mo'>('mi')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const current = tab === 'mi' ? inbox : outbox

  return (
    <section className="dashboard-card">
      <div className="dashboard-top">
        <div className="tabs" role="tablist" aria-label="Mizmo boxes">
          <button
            aria-selected={tab === 'mi'}
            className={tab === 'mi' ? 'is-active' : ''}
            onClick={() => setTab('mi')}
            role="tab"
            type="button"
          >
            <span className="tab-word">mi</span>
            <span className="tab-detail">inbox</span>
            <span className="tab-count">{inbox.length}</span>
          </button>
          <button
            aria-selected={tab === 'mo'}
            className={tab === 'mo' ? 'is-active' : ''}
            onClick={() => setTab('mo')}
            role="tab"
            type="button"
          >
            <span className="tab-word">mo</span>
            <span className="tab-detail">outbox</span>
            <span className="tab-count">{outbox.length}</span>
          </button>
        </div>
        <span className="sync-status">
          <span className={`status-dot ${status === 'syncing' ? 'is-pulsing' : ''}`} />
          {status === 'syncing'
            ? 'Syncing relays…'
            : status === 'live'
              ? 'Listening live'
              : 'Waiting'}
        </span>
      </div>

      <div className="mizmo-list" role="tabpanel">
        {current.length > 0 ? (
          current.map((record) => (
            <MizmoCard key={record.event.id} now={now} record={record} />
          ))
        ) : (
          <EmptyBox tab={tab} syncing={status === 'syncing'} />
        )}
      </div>
    </section>
  )
}

function EmptyBox({
  tab,
  syncing,
}: {
  tab: 'mi' | 'mo'
  syncing: boolean
}) {
  return (
    <div className="empty-box">
      <span className="empty-glyph">
        <Icon name={tab === 'mi' ? 'inbox' : 'outbox'} size={30} />
      </span>
      <h3>{syncing ? 'Checking the relays…' : `Your ${tab} is clear.`}</h3>
      <p>
        {tab === 'mi'
          ? 'Mizmos sent to your address will appear here.'
          : 'Mizmos you send to other people will appear here.'}
      </p>
    </div>
  )
}

function InvalidAddress() {
  return (
    <div className="page empty-page">
      <span className="empty-glyph">
        <Icon name="link" size={30} />
      </span>
      <p className="eyebrow">Not a mizmo address</p>
      <h1>That npub didn&apos;t decode.</h1>
      <p>
        A mizmo address is a Nostr public key. It should start with{' '}
        <code>npub1</code> or be a 64-character hex key.
      </p>
      <Link className="button button--primary" to="/">
        Back home
        <Icon name="arrow-right" />
      </Link>
    </div>
  )
}
