import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useIdentity } from '../context/useIdentity'
import { useProfiles } from '../hooks/useProfiles'
import { copyText, displayName } from '../lib/format'
import { RELAYS } from '../lib/nostr'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { ProfileEditor } from './ProfileEditor'

type AppShellProps = {
  children: ReactNode
  onOpenAuth: () => void
}

export function AppShell({ children, onOpenAuth }: AppShellProps) {
  const { identity } = useIdentity()
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { profiles } = useProfiles(identity ? [identity.pubkey] : [])
  const ownProfile = identity ? profiles[identity.pubkey] : null
  const ownName = identity
    ? displayName(
        identity.pubkey,
        ownProfile?.displayName || ownProfile?.name,
      )
    : ''

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link aria-label="miZmo home" className="brand" to="/">
          <span aria-hidden="true" className="brand-mark">
            <span />
            <span />
          </span>
          <span className="brand-word">
            mi<strong>Z</strong>mo<span className="brand-dot">.me</span>
          </span>
        </Link>

        <nav aria-label="Account" className="header-actions">
          {identity ? (
            <>
              <Link className="identity-chip" to={`/${identity.npub}`}>
                <Avatar
                  name={ownName}
                  picture={ownProfile?.picture}
                  pubkey={identity.pubkey}
                  size={28}
                />
                <span>{ownName}</span>
                <span className="identity-chip-label">my mi / mo</span>
              </Link>
              <button
                aria-label="Open settings"
                className="icon-button"
                onClick={() => setSettingsOpen(true)}
                type="button"
              >
                <Icon name="settings" />
              </button>
            </>
          ) : (
            <button
              className="button button--ghost button--small"
              onClick={onOpenAuth}
              type="button"
            >
              Sign in
            </button>
          )}
        </nav>
      </header>

      <main className="site-main" id="main">
        {children}
      </main>

      <footer className="site-footer">
        <span>miZmo.me — a small nudge for a big ask.</span>
        <span className="footer-meta">
          <span className="status-dot" /> Nostr-native · {RELAYS.length} relays ·
          no app server
        </span>
      </footer>

      <SettingsModal
        onClose={() => setSettingsOpen(false)}
        onSignedOut={() => {
          setSettingsOpen(false)
          navigate('/')
        }}
        open={settingsOpen}
      />
    </div>
  )
}

function SettingsModal({
  open,
  onClose,
  onSignedOut,
}: {
  open: boolean
  onClose: () => void
  onSignedOut: () => void
}) {
  const { identity, signOut } = useIdentity()
  const { profiles } = useProfiles(identity ? [identity.pubkey] : [])
  const [showKey, setShowKey] = useState(false)
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const [copied, setCopied] = useState<'address' | 'key' | null>(null)

  if (!identity) return null

  const address = `${window.location.origin}/${identity.npub}`
  const profile = profiles[identity.pubkey] ?? null
  const profileLoaded = identity.pubkey in profiles
  const name = displayName(
    identity.pubkey,
    profile?.displayName || profile?.name,
  )

  const copy = async (value: string, kind: 'address' | 'key') => {
    try {
      await copyText(value)
      setCopied(kind)
      window.setTimeout(() => setCopied(null), 1600)
    } catch {
      setCopied(null)
    }
  }

  const close = () => {
    setShowKey(false)
    setConfirmingSignOut(false)
    setCopied(null)
    onClose()
  }

  return (
    <Modal
      eyebrow="Your identity"
      onClose={close}
      open={open}
      title="Settings"
      wide
    >
      <div className="settings-profile">
        <Avatar
          name={name}
          picture={profile?.picture}
          pubkey={identity.pubkey}
          size={52}
        />
        <div>
          <p className="settings-label">{name}</p>
          <p className="settings-address">{address}</p>
        </div>
      </div>

      <div className="button-row">
        <button
          className="button button--secondary button--small"
          onClick={() => copy(address, 'address')}
          type="button"
        >
          <Icon name={copied === 'address' ? 'check' : 'copy'} size={16} />
          {copied === 'address' ? 'Copied' : 'Copy address'}
        </button>
        <Link
          className="button button--ghost button--small"
          onClick={close}
          to={`/${identity.npub}`}
        >
          Open my mi / mo
          <Icon name="arrow-right" size={16} />
        </Link>
      </div>

      {profileLoaded && (
        <div className="settings-section">
          <ProfileEditor identity={identity} profile={profile} />
        </div>
      )}

      <div className="settings-section">
        <div className="settings-heading">
          <div>
            <p className="settings-label">Private key</p>
            <p className="microcopy">
              Stored as plain text in this browser&apos;s local storage.
            </p>
          </div>
          <button
            className="text-button"
            onClick={() => setShowKey((current) => !current)}
            type="button"
          >
            {showKey ? 'Hide' : 'Reveal'}
          </button>
        </div>

        {showKey && (
          <div className="key-reveal">
            <code>{identity.nsec}</code>
            <button
              aria-label="Copy private key"
              className="icon-button"
              onClick={() => copy(identity.nsec, 'key')}
              type="button"
            >
              <Icon name={copied === 'key' ? 'check' : 'copy'} size={18} />
            </button>
          </div>
        )}

        <p className="warning-copy">
          Anyone with this key can act as you. Back it up somewhere private.
          Clearing browser data or signing out without a backup will lose this
          identity.
        </p>
      </div>

      <div className="settings-section">
        <p className="settings-label">Relays</p>
        <ul className="relay-list">
          {RELAYS.map((relay) => (
            <li key={relay}>
              <span className="status-dot" />
              {relay.replace('wss://', '')}
            </li>
          ))}
        </ul>
      </div>

      <div className="settings-section settings-section--danger">
        {confirmingSignOut ? (
          <div className="signout-confirm">
            <p>
              Sign out and forget this key? Make sure you copied your nsec
              first — this cannot be undone.
            </p>
            <div className="button-row">
              <button
                className="button button--danger button--small"
                onClick={() => {
                  signOut()
                  onSignedOut()
                }}
                type="button"
              >
                <Icon name="logout" size={16} />
                Yes, forget my key
              </button>
              <button
                className="button button--ghost button--small"
                onClick={() => setConfirmingSignOut(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="text-button text-button--danger"
            onClick={() => setConfirmingSignOut(true)}
            type="button"
          >
            <Icon name="logout" size={16} />
            Sign out &amp; forget key
          </button>
        )}
      </div>
    </Modal>
  )
}
