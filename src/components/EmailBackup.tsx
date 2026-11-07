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
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [backup, setBackup] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (password !== password.trim()) {
      setError('The backup password cannot start or end with a space.')
      return
    }

    if (password.length < MIN_BACKUP_PASSWORD_LENGTH) {
      setError(
        `Use at least ${MIN_BACKUP_PASSWORD_LENGTH} characters for this backup password.`,
      )
      return
    }

    if (password !== confirmation) {
      setError('The backup passwords do not match.')
      return
    }

    setBusy(true)

    try {
      const encrypted = encryptIdentityBackup(identity, password)
      setBackup(encrypted)
      setPassword('')
      setConfirmation('')
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
          <p className="settings-label">Encrypted email backup</p>
          <p className="microcopy">
            Email yourself an encrypted copy and unlock it on another device.
          </p>
        </div>
      </div>

      {backup ? (
        <div className="backup-result">
          <p aria-live="polite" className="form-success">
            Encrypted backup ready.
          </p>
          <p className="microcopy">
            Your email app should have opened. If it did not, open it from here
            or copy the backup link and email it to yourself.
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
              {copied ? 'Copied' : 'Copy backup link'}
            </button>
          </div>
          <p className="warning-copy">
            The backup password is not included in the email and cannot be
            recovered. Store it in a password manager; you will need it to
            import the key.
          </p>
        </div>
      ) : (
        <form className="backup-form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Backup password</span>
            <input
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
          <label className="field">
            <span className="field-label">Confirm backup password</span>
            <input
              autoComplete="new-password"
              className="text-input"
              onChange={(event) => {
                setConfirmation(event.target.value)
                setError('')
              }}
              placeholder="Repeat the password"
              type="password"
              value={confirmation}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button
            className="button button--secondary button--small"
            disabled={busy}
            type="submit"
          >
            <Icon name="send" size={16} />
            {busy ? 'Encrypting…' : 'Encrypt & open email'}
          </button>
          <p className="microcopy">
            Uses NIP-49 encryption in this browser. Your email app will open
            with a draft; add your address and send it. Store the password
            separately.
          </p>
        </form>
      )}
    </div>
  )
}
