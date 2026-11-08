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
      setError('Your account could not be saved on this device.')
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
          : 'That code could not be read.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`auth-panel ${compact ? 'auth-panel--compact' : ''}`}>
      <div className="auth-switch" role="tablist" aria-label="Account setup">
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
          I have an account
        </button>
      </div>

      {mode === 'create' ? (
        <div className="auth-pane" role="tabpanel">
          <p className="auth-lede">
            Create your miZmo account in seconds. No password to remember.
          </p>
          <button
            className="button button--primary button--wide"
            disabled={busy}
            onClick={handleCreate}
            type="button"
          >
            <Icon name="spark" />
            {busy ? 'Creating…' : 'Create my account'}
          </button>
          <p className="microcopy">
            You&apos;ll stay signed in on this device. Set up a backup email in
            Settings so you can get back in anywhere.
          </p>
        </div>
      ) : (
        <form className="auth-pane" onSubmit={handleImport} role="tabpanel">
          <label className="field">
            <span className="field-label">Your recovery code</span>
            <input
              autoCapitalize="none"
              autoComplete="off"
              className="text-input text-input--mono"
              onChange={(event) => setSecretInput(event.target.value)}
              placeholder="Paste your recovery code"
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
            <Icon name="arrow-right" />
            {busy ? 'Opening…' : 'Continue'}
          </button>
          <p className="microcopy">
            Keep this code private. It&apos;s how you get back into your
            account.
          </p>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
