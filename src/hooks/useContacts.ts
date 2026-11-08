import { useCallback, useEffect, useState } from 'react'
import type { Identity } from '../lib/identity'
import { fetchContacts, updateContacts } from '../lib/nostr'

type ContactState = {
  identityKey: string | null
  contacts: string[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string
}

export function useContacts(identity: Identity | null) {
  const [state, setState] = useState<ContactState>({
    identityKey: null,
    contacts: [],
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
          contacts,
          status: 'ready',
          error: '',
        })
      })
      .catch(() => {
        if (!active) return
        setState({
          identityKey: identity.pubkey,
          contacts: [],
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
          contacts: [],
          status: identity ? ('loading' as const) : ('idle' as const),
          error: '',
        }

  const change = useCallback(
    async (target: string, action: 'add' | 'remove') => {
      if (!identity) return

      const contacts = await updateContacts(identity, target, action)
      setState({
        identityKey: identity.pubkey,
        contacts,
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

  return {
    contacts: current.contacts,
    status: current.status,
    error: current.error,
    addContact,
    removeContact,
  }
}
