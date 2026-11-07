import { useEffect, useMemo, useState } from 'react'
import type { Event } from 'nostr-tools'
import type { Identity } from '../lib/identity'
import {
  decryptMizmo,
  deadlineFromEvent,
  mizmoFilterForInbox,
  mizmoFilterForOutbox,
  pool,
  recipientFromEvent,
  RELAYS,
} from '../lib/nostr'

export type MizmoDirection = 'in' | 'out'

export type MizmoRecord = {
  id: string
  createdAt: number
  direction: MizmoDirection
  counterparty: string
  ask: string | null
  deadline: number | null
  decryptionError: boolean
  source: 'nostr' | 'email'
}

export type RelayStatus = 'idle' | 'syncing' | 'live'

type MizmoState = {
  identityKey: string | null
  events: Event[]
  status: RelayStatus
}

function toRecord(event: Event, identity: Identity): MizmoRecord | null {
  const direction: MizmoDirection =
    event.pubkey === identity.pubkey ? 'out' : 'in'
  const counterparty =
    direction === 'out' ? recipientFromEvent(event) : event.pubkey

  if (!counterparty) return null

  try {
    const payload = decryptMizmo(event, identity.secretKey, identity.pubkey)

    return {
      id: event.id,
      createdAt: event.created_at,
      direction,
      counterparty,
      ask: payload.ask,
      deadline: deadlineFromEvent(event),
      decryptionError: false,
      source: 'nostr',
    }
  } catch {
    return {
      id: event.id,
      createdAt: event.created_at,
      direction,
      counterparty,
      ask: null,
      deadline: deadlineFromEvent(event),
      decryptionError: true,
      source: 'nostr',
    }
  }
}

export function useMizmos(identity: Identity | null) {
  const [store, setStore] = useState<MizmoState>({
    identityKey: null,
    events: [],
    status: 'idle',
  })

  useEffect(() => {
    if (!identity) return

    let active = true
    const seen = new Set<string>()
    const handleEvent = (event: Event) => {
      if (!active || seen.has(event.id)) return
      seen.add(event.id)
      setStore((current) => {
        if (current.identityKey !== identity.pubkey) {
          return {
            identityKey: identity.pubkey,
            events: [event],
            status: 'syncing',
          }
        }

        return { ...current, events: [...current.events, event] }
      })
    }

    const inbox = pool.subscribeMany(
      [...RELAYS],
      mizmoFilterForInbox(identity.pubkey),
      {
        onevent: handleEvent,
        label: 'mizmo-inbox',
      },
    )
    const outbox = pool.subscribeMany(
      [...RELAYS],
      mizmoFilterForOutbox(identity.pubkey),
      {
        onevent: handleEvent,
        label: 'mizmo-outbox',
      },
    )

    const statusTimer = window.setTimeout(() => {
      if (!active) return
      setStore((current) =>
        current.identityKey === identity.pubkey
          ? { ...current, status: 'live' }
          : {
              identityKey: identity.pubkey,
              events: [],
              status: 'live',
            },
      )
    }, 1800)

    return () => {
      active = false
      window.clearTimeout(statusTimer)
      inbox.close()
      outbox.close()
    }
  }, [identity])

  const current =
    identity && store.identityKey === identity.pubkey
      ? store
      : {
          identityKey: identity?.pubkey ?? null,
          events: [] as Event[],
          status: identity ? ('syncing' as const) : ('idle' as const),
        }

  const records = useMemo(() => {
    if (!identity) return []

    return current.events
      .map((event) => toRecord(event, identity))
      .filter((record): record is MizmoRecord => record !== null)
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [current.events, identity])

  const inbox = useMemo(
    () => records.filter((record) => record.direction === 'in'),
    [records],
  )
  const outbox = useMemo(
    () => records.filter((record) => record.direction === 'out'),
    [records],
  )

  return { inbox, outbox, status: current.status }
}
