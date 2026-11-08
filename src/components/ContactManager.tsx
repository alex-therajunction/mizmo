import { useMemo, useState, type FormEvent } from 'react'
import {
  isEmailAddress,
  normalizeEmail,
  type EmailContact,
} from '../hooks/useEmailContacts'
import { useProfiles } from '../hooks/useProfiles'
import { displayName } from '../lib/format'
import type { Identity } from '../lib/identity'
import { normalizeNostrId, type ProfileData } from '../lib/nostr'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Modal } from './Modal'

type ContactManagerProps = {
  identity: Identity
  contacts: string[]
  emailContacts: EmailContact[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  loadError: string
  onAdd: (pubkey: string) => Promise<void>
  onAddEmail: (email: string) => void | Promise<void>
  onRemove: (pubkey: string) => Promise<void>
  onRemoveEmail: (email: string) => void
  onClose: () => void
}

export function ContactManager({
  identity,
  contacts,
  emailContacts,
  status,
  loadError,
  onAdd,
  onAddEmail,
  onRemove,
  onRemoveEmail,
  onClose,
}: ContactManagerProps) {
  const { profiles } = useProfiles(contacts)
  const [lookup, setLookup] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const sorted = useMemo(
    () =>
      [...contacts].sort((a, b) =>
        contactName(a, profiles).localeCompare(contactName(b, profiles)),
      ),
    [contacts, profiles],
  )

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const cleanLookup = lookup.trim()

    if (isEmailAddress(cleanLookup)) {
      const email = normalizeEmail(cleanLookup)

      if (emailContacts.some((contact) => contact.email === email)) {
        setError('That email is already in your contacts.')
        return
      }

      setBusy('add')

      try {
        await onAddEmail(email)
        setLookup('')
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'That email contact could not be added.',
        )
      } finally {
        setBusy(null)
      }

      return
    }

    const pubkey = normalizeNostrId(cleanLookup)

    if (!pubkey) {
      setError('Enter their miZmo link or email address.')
      return
    }

    if (pubkey === identity.pubkey) {
      setError('You are already you.')
      return
    }

    if (contacts.includes(pubkey)) {
      setError('That person is already in your contacts.')
      return
    }

    setBusy('add')

    try {
      await onAdd(pubkey)
      setLookup('')
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'That contact could not be added.',
      )
    } finally {
      setBusy(null)
    }
  }

  const handleRemove = async (pubkey: string) => {
    setError('')
    setBusy(pubkey)

    try {
      await onRemove(pubkey)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'That contact could not be removed.',
      )
    } finally {
      setBusy(null)
    }
  }

  const handleRemoveEmail = (email: string) => {
    setError('')
    onRemoveEmail(email)
  }

  return (
    <Modal
      eyebrow="Your people"
      onClose={onClose}
      open
      title="Contacts"
      wide
    >
      <form className="contact-add-form" onSubmit={handleAdd}>
        <label className="field">
          <span className="field-label">Add a contact</span>
          <input
            autoCapitalize="none"
            className="text-input text-input--mono"
            onChange={(event) => setLookup(event.target.value)}
            placeholder="Paste a miZmo link or enter an email"
            spellCheck={false}
            value={lookup}
          />
        </label>
        <button
          aria-label="Add contact"
          className="icon-button"
          disabled={busy === 'add'}
          type="submit"
        >
          <Icon name="plus" />
        </button>
      </form>

      {(error || loadError) && (
        <p className="form-error">{error || loadError}</p>
      )}

      <div className="contact-manager-list">
        {emailContacts.length > 0 && (
          <>
            <p className="contact-manager-group-label">Email contacts</p>
            {emailContacts.map((contact) => (
              <div className="contact-manager-row" key={contact.email}>
                <span className="contact-avatar contact-avatar--email">
                  <Icon name="mail" size={18} />
                </span>
                <div className="contact-manager-copy">
                  <p>{contact.email}</p>
                  <span>Email contact</span>
                </div>
                <button
                  aria-label={`Remove ${contact.email}`}
                  className="icon-button contact-remove"
                  onClick={() => handleRemoveEmail(contact.email)}
                  type="button"
                >
                  <Icon name="trash" size={18} />
                </button>
              </div>
            ))}
          </>
        )}
        {sorted.length > 0 && emailContacts.length > 0 && (
          <p className="contact-manager-group-label">miZmo contacts</p>
        )}
        {status === 'loading' ? (
          <p className="contact-manager-empty">Loading contacts…</p>
        ) : sorted.length > 0 ? (
          sorted.map((pubkey) => {
            const profile = profiles[pubkey]
            const name = contactName(pubkey, profiles)

            return (
              <div className="contact-manager-row" key={pubkey}>
                <Avatar
                  name={name}
                  picture={profile?.picture}
                  pubkey={pubkey}
                  size={42}
                />
                <div className="contact-manager-copy">
                  <p>{name}</p>
                  <span>miZmo contact</span>
                </div>
                <button
                  aria-label={`Remove ${name}`}
                  className="icon-button contact-remove"
                  disabled={busy === pubkey}
                  onClick={() => handleRemove(pubkey)}
                  type="button"
                >
                  <Icon name="trash" size={18} />
                </button>
              </div>
            )
          })
        ) : emailContacts.length === 0 ? (
          <p className="contact-manager-empty">
            No contacts yet. Add someone by their miZmo link or email.
          </p>
        ) : null}
      </div>
    </Modal>
  )
}

function contactName(
  pubkey: string,
  profiles: Record<string, ProfileData | null>,
): string {
  const profile = profiles[pubkey]
  return displayName(pubkey, profile?.displayName || profile?.name)
}
