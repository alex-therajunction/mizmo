import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { primeProfile } from '../hooks/useProfiles'
import { prepareAvatar } from '../lib/avatar'
import type { Identity } from '../lib/identity'
import { publishProfile, type ProfileData } from '../lib/nostr'
import { Avatar } from './Avatar'
import { Icon } from './Icon'

type ProfileEditorProps = {
  identity: Identity
  profile: ProfileData | null
}

export function ProfileEditor({ identity, profile }: ProfileEditorProps) {
  const [name, setName] = useState(
    profile?.displayName || profile?.name || '',
  )
  const [picture, setPicture] = useState<string | null | undefined>(
    profile?.picture,
  )
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const handlePicture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    setError('')
    setSaved('')
    setUploading(true)

    try {
      setPicture(await prepareAvatar(file))
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'That picture could not be prepared.',
      )
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSaved('')
    setSaving(true)

    try {
      const next = await publishProfile(identity, {
        name,
        picture,
      })
      primeProfile(identity.pubkey, next)
      setName(next.displayName || next.name || '')
      setPicture(next.picture)
      setSaved('Profile saved.')
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Your profile could not be saved.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="profile-editor" onSubmit={handleSubmit}>
      <div className="profile-editor-head">
        <Avatar
          name={name || 'you'}
          picture={picture ?? undefined}
          pubkey={identity.pubkey}
          size={68}
        />
        <div className="profile-editor-copy">
          <p className="settings-label">Your profile</p>
          <p className="microcopy">
            These details are published as public Nostr metadata.
          </p>
        </div>
      </div>

      <label className="field">
        <span className="field-label">Name</span>
        <input
          className="text-input"
          maxLength={80}
          onChange={(event) => {
            setName(event.target.value)
            setError('')
            setSaved('')
          }}
          placeholder="How people should know you"
          value={name}
        />
      </label>

      <div className="profile-picture-row">
        <input
          accept="image/*"
          className="visually-hidden"
          onChange={handlePicture}
          ref={fileInput}
          tabIndex={-1}
          type="file"
        />
        <button
          className="button button--secondary button--small"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
          type="button"
        >
          <Icon name="plus" size={16} />
          {uploading ? 'Preparing…' : 'Choose picture'}
        </button>
        {typeof picture === 'string' && picture.length > 0 && (
          <button
            className="text-button text-button--danger"
            onClick={() => {
              setPicture(null)
              setError('')
              setSaved('')
            }}
            type="button"
          >
            Remove picture
          </button>
        )}
      </div>
      <p className="field-hint">
        Square-cropped and resized in your browser before publishing.
      </p>

      {error && <p className="form-error">{error}</p>}
      {saved && (
        <p aria-live="polite" className="form-success">
          {saved}
        </p>
      )}

      <button
        className="button button--primary button--small"
        disabled={saving || uploading}
        type="submit"
      >
        <Icon name="check" size={16} />
        {saving ? 'Publishing…' : 'Save profile'}
      </button>
    </form>
  )
}
