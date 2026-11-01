import { useState, type FormEvent } from 'react'
import { useIdentity } from '../context/useIdentity'
import type { Identity } from '../lib/identity'
import { Icon } from './Icon'

type AuthPanelProps = {
  onAuthenticated?: (identity: Identity) => void
  compact?: boolean
}

type Mode = 'create' | 'import'

export function AuthPanel({ onAuthenticated, compact = false }: AuthPanelProps) {
  const { createIdentity, importIdentity } = useIdentity()
  const [mode, setMode] = useState<Mode>('create')
  const [secretInput, setSecretInput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const finish = (identity: Identity) => {
    onAuthenticated?.(identity)
  }

  const handleCreate = () => {
    setError('')
    setBusy(true)

    try {
      finish(createIdentity())
    } catch {
      setError('The key could not be saved in this browser.')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)

    try {
      finish(importIdentity(secretInput))
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'That key could not be read.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`auth-panel ${compact ? 'auth-panel--compact' : ''}`}>
      <div className="auth-switch" role="tablist" aria-label="Key setup">
        <button
          aria-selected={mode === 'create'}
          className={mode === 'create' ? 'is-active' : ''}
          onClick={() => {
            setMode('create')
            setError('')
          }}
          role="tab"
          type="button"
        >
          New here
        </button>
        <button
          aria-selected={mode === 'import'}
          className={mode === 'import' ? 'is-active' : ''}
          onClick={() => {
            setMode('import')
            setError('')
          }}
          role="tab"
          type="button"
        >
          Use a key
        </button>
      </div>

      {mode === 'create' ? (
        <div className="auth-pane" role="tabpanel">
          <p className="auth-lede">
            Make a Nostr identity in this browser. No email, password, or
            account.
          </p>
          <button
            className="button button--primary button--wide"
            disabled={busy}
            onClick={handleCreate}
            type="button"
          >
            <Icon name="spark" />
            {busy ? 'Creating…' : 'Create my mizmo key'}
          </button>
          <p className="microcopy">
            Your private key is saved in local storage on this device. Back it
            up from settings before clearing browser data.
          </p>
        </div>
      ) : (
        <form className="auth-pane" onSubmit={handleImport} role="tabpanel">
          <label className="field">
            <span className="field-label">Your Nostr private key</span>
            <input
              autoCapitalize="none"
              autoComplete="off"
              className="text-input text-input--mono"
              onChange={(event) => setSecretInput(event.target.value)}
              placeholder="nsec1…"
              spellCheck={false}
              type="password"
              value={secretInput}
            />
          </label>
          <button
            className="button button--primary button--wide"
            disabled={busy}
            type="submit"
          >
            <Icon name="key" />
            {busy ? 'Opening…' : 'Use this key'}
          </button>
          <p className="microcopy">
            The key stays in this browser and is never sent to a server.
          </p>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
