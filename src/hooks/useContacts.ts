import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Identity } from '../lib/identity'
import {
  fetchContacts,
  renameContact,
  updateContacts,
  type ContactEntry,
} from '../lib/nostr'

type ContactState = {
  identityKey: string | null
  entries: ContactEntry[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string
}

export function useContacts(identity: Identity | null) {
  const [state, setState] = useState<ContactState>({
    identityKey: null,
    entries: [],
    status: 'idle',
    error: '',
  })

  useEffect(() => {
    if (!identity) return

    let active = true

    fetchContacts(identity.pubkey)
      .then((contacts) => {
        if (!active) return
        setState({
          identityKey: identity.pubkey,
          entries: contacts,
          status: 'ready',
          error: '',
        })
      })
      .catch(() => {
        if (!active) return
        setState({
          identityKey: identity.pubkey,
          entries: [],
          status: 'error',
          error:
            "We couldn't load your contacts. Check your connection and try again.",
        })
      })

    return () => {
      active = false
    }
  }, [identity])

  const current =
    identity && state.identityKey === identity.pubkey
      ? state
      : {
          identityKey: identity?.pubkey ?? null,
          entries: [],
          status: identity ? ('loading' as const) : ('idle' as const),
          error: '',
        }

  const change = useCallback(
    async (target: string, action: 'add' | 'remove') => {
      if (!identity) return

      const entries = await updateContacts(identity, target, action)
      setState({
        identityKey: identity.pubkey,
        entries,
        status: 'ready',
        error: '',
      })
    },
    [identity],
  )

  const addContact = useCallback(
    (target: string) => change(target, 'add'),
    [change],
  )
  const removeContact = useCallback(
    (target: string) => change(target, 'remove'),
    [change],
  )

  const rename = useCallback(
    async (target: string, name: string) => {
      if (!identity) return

      const entries = await renameContact(identity, target, name)
      setState({
        identityKey: identity.pubkey,
        entries,
        status: 'ready',
        error: '',
      })
    },
    [identity],
  )

  const contacts = useMemo(
    () => current.entries.map((contact) => contact.pubkey),
    [current.entries],
  )
  const contactNames = useMemo(
    () =>
      Object.fromEntries(
        current.entries
          .filter((contact) => contact.petname)
          .map((contact) => [contact.pubkey, contact.petname]),
      ),
    [current.entries],
  )

  return {
    contacts,
    contactNames,
    status: current.status,
    error: current.error,
    addContact,
    removeContact,
    renameContact: rename,
  }
}
