import { useState, type FormEvent } from 'react'
import {
  buildBackupEmailUrl,
  buildBackupImportUrl,
} from '../lib/backup'
import { copyText } from '../lib/format'
import {
  encryptIdentityBackup,
  MIN_BACKUP_PASSWORD_LENGTH,
  type Identity,
} from '../lib/identity'
import { Icon } from './Icon'

export function EmailBackup({ identity }: { identity: Identity }) {
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)
  const [password, setPassword] = useState('')
  const [backup, setBackup] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (password.length < MIN_BACKUP_PASSWORD_LENGTH) {
      setError(
        `Use at least ${MIN_BACKUP_PASSWORD_LENGTH} characters.`,
      )
      return
    }

    setBusy(true)

    try {
      const encrypted = encryptIdentityBackup(identity, password)
      setBackup(encrypted)
      setPassword('')
      window.location.href = buildBackupEmailUrl(encrypted, identity.npub)
    } catch {
      setError('The encrypted backup could not be created.')
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async () => {
    if (!backup) return

    try {
      await copyText(buildBackupImportUrl(backup))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="email-backup">
      <div className="settings-heading">
        <div>
          <p className="settings-label">Email login link</p>
          <p className="microcopy">
            Sign in on another device with an encrypted link sent to your
            email.
          </p>
        </div>
      </div>

      {backup ? (
        <div className="backup-result">
          <p aria-live="polite" className="form-success">
            Login link ready.
          </p>
          <p className="microcopy">
            Your email app should have opened. If it did not, open it from here
            or copy the login link.
          </p>
          <div className="button-row">
            <a
              className="button button--secondary button--small"
              href={buildBackupEmailUrl(backup, identity.npub)}
            >
              <Icon name="send" size={16} />
              Open email app
            </a>
            <button
              className="button button--ghost button--small"
              onClick={copyLink}
              type="button"
            >
              <Icon name={copied ? 'check' : 'copy'} size={16} />
              {copied ? 'Copied' : 'Copy login link'}
            </button>
          </div>
          <p className="warning-copy">
            The password is not included in the email and cannot be recovered.
            Store it in a password manager; you will need it to use the link.
          </p>
        </div>
      ) : !showPasswordPrompt ? (
        <div className="backup-form">
          <button
            className="button button--secondary button--small"
            onClick={() => setShowPasswordPrompt(true)}
            type="button"
          >
            <Icon name="mail" size={16} />
            Email me a login link
          </button>
          <p className="microcopy">
            You will choose a password once. The password stays out of the
            email and is required when you open the link.
          </p>
        </div>
      ) : (
        <form className="backup-form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Choose a password</span>
            <input
              autoFocus
              autoComplete="new-password"
              className="text-input"
              onChange={(event) => {
                setPassword(event.target.value)
                setError('')
              }}
              placeholder={`At least ${MIN_BACKUP_PASSWORD_LENGTH} characters`}
              type="password"
              value={password}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button
            className="button button--secondary button--small"
            disabled={busy}
            type="submit"
          >
            <Icon name="send" size={16} />
            {busy ? 'Creating link…' : 'Send login link'}
          </button>
          <p className="microcopy">
            Your email app will open with a draft. Add your address and send
            it, then store the password safely.
          </p>
        </form>
      )}
    </div>
  )
}
