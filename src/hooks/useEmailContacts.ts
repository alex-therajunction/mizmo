import { useCallback, useMemo, useState } from 'react'
import type { Identity } from '../lib/identity'

const STORAGE_PREFIX = 'mizmo.emailContacts.v1.'

export type EmailContact = {
  email: string
  addedAt: number
}

type EmailContactState = {
  identityKey: string | null
  contacts: EmailContact[]
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value))
}

function readEmailContacts(pubkey: string): EmailContact[] {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${pubkey}`)

    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown

    if (!Array.isArray(parsed)) return []

    const seen = new Set<string>()
    const contacts: EmailContact[] = []

    for (const item of parsed) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue

      const contact = item as Record<string, unknown>

      if (
        typeof contact.email !== 'string' ||
        typeof contact.addedAt !== 'number'
      ) {
        continue
      }

      const email = normalizeEmail(contact.email)

      if (!isEmailAddress(email) || seen.has(email)) continue

      seen.add(email)
      contacts.push({ email, addedAt: contact.addedAt })
    }

    return contacts.sort((a, b) => a.email.localeCompare(b.email))
  } catch {
    return []
  }
}

function writeEmailContacts(pubkey: string, contacts: EmailContact[]): void {
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${pubkey}`,
      JSON.stringify(contacts),
    )
  } catch {
    // Email contacts stay in memory when storage is unavailable.
  }
}

export function useEmailContacts(identity: Identity | null) {
  const [state, setState] = useState<EmailContactState>(() => ({
    identityKey: identity?.pubkey ?? null,
    contacts: identity ? readEmailContacts(identity.pubkey) : [],
  }))

  const contacts = useMemo(() => {
    if (!identity) return []
    if (state.identityKey === identity.pubkey) return state.contacts
    return readEmailContacts(identity.pubkey)
  }, [identity, state])

  const addEmailContact = useCallback(
    (value: string) => {
      if (!identity) return

      const email = normalizeEmail(value)

      if (!isEmailAddress(email)) {
        throw new Error('Enter a valid email address.')
      }

      const current = readEmailContacts(identity.pubkey)

      if (current.some((contact) => contact.email === email)) return

      const next = [
        ...current,
        { email, addedAt: Date.now() },
      ].sort((a, b) => a.email.localeCompare(b.email))
      writeEmailContacts(identity.pubkey, next)
      setState({ identityKey: identity.pubkey, contacts: next })
    },
    [identity],
  )

  const removeEmailContact = useCallback(
    (value: string) => {
      if (!identity) return

      const email = normalizeEmail(value)
      const next = readEmailContacts(identity.pubkey).filter(
        (contact) => contact.email !== email,
      )
      writeEmailContacts(identity.pubkey, next)
      setState({ identityKey: identity.pubkey, contacts: next })
    },
    [identity],
  )

  return {
    contacts,
    addEmailContact,
    removeEmailContact,
  }
}
