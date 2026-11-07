import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useIdentity } from '../context/useIdentity'
import { readEncryptedKeyFromHash } from '../lib/backup'

export function ImportPage() {
  const { identity, importEncryptedIdentity } = useIdentity()
  const navigate = useNavigate()
  const [encryptedKey, setEncryptedKey] = useState(() =>
    readEncryptedKeyFromHash(window.location.hash),
  )
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!window.location.hash) return

    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`,
    )
  }, [])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (!encryptedKey.trim()) {
      setError('Paste the encrypted key from your backup email.')
      return
    }

    if (!password) {
      setError('Enter the password you used for this backup.')
      return
    }

    setBusy(true)

    try {
      const next = importEncryptedIdentity(encryptedKey, password)
      navigate(`/${next.npub}`, { replace: true })
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'That backup could not be imported.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page import-page">
      <section className="import-card">
        <p className="eyebrow">Encrypted backup</p>
        <h1>Unlock your miZmo key.</h1>
        <p className="import-lede">
          This backup is encrypted with NIP-49. Enter the password you chose
          when you emailed it to yourself.
        </p>

        <form className="import-form" onSubmit={handleSubmit}>
          {encryptedKey ? (
            <div className="key-reveal import-key">
              <code>{encryptedKey}</code>
            </div>
          ) : (
            <label className="field">
              <span className="field-label">Encrypted key</span>
              <textarea
                autoCapitalize="none"
                autoComplete="off"
                className="text-area text-area--mono"
                onChange={(event) => {
                  setEncryptedKey(event.target.value)
                  setError('')
                }}
                placeholder="ncryptsec1…"
                spellCheck={false}
                value={encryptedKey}
              />
            </label>
          )}

          <label className="field">
            <span className="field-label">Backup password</span>
            <input
              autoComplete="current-password"
              autoFocus={Boolean(encryptedKey)}
              className="text-input"
              onChange={(event) => {
                setPassword(event.target.value)
                setError('')
              }}
              placeholder="Your backup password"
              type="password"
              value={password}
            />
          </label>

          {identity && (
            <p className="warning-copy">
              You are already signed in in this browser. Importing this backup
              will replace the key currently saved here.
            </p>
          )}

          {error && <p className="form-error">{error}</p>}

          <button
            className="button button--primary button--wide"
            disabled={busy}
            type="submit"
          >
            <Icon name="key" />
            {busy ? 'Unlocking…' : 'Unlock and import'}
          </button>
        </form>

        <p className="microcopy import-note">
          The key is decrypted in this browser and saved to local storage. The
          backup password never leaves your device.
        </p>
      </section>
    </div>
  )
}
