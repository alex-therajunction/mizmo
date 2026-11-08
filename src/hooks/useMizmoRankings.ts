import { useCallback, useEffect, useRef, useState } from 'react'
import type { Identity } from '../lib/identity'
import { fetchRankings, publishRankings } from '../lib/nostr'
import {
  emptyRankings,
  parseRankingPayload,
  type RankingPayload,
} from '../lib/rankings'

const STORAGE_PREFIX = 'mizmo.rankings.v1.'
const PUBLISH_DELAY = 600

type RankingState = {
  identityKey: string | null
  data: RankingPayload | null
  loaded: boolean
  status: 'idle' | 'loading' | 'saving' | 'saved' | 'error'
  error: string
}

function readLocal(pubkey: string): RankingPayload | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${pubkey}`)

    if (!raw) return null

    return parseRankingPayload(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeLocal(pubkey: string, rankings: RankingPayload) {
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${pubkey}`,
      JSON.stringify(rankings),
    )
  } catch {
    // Ordering remains in memory when storage is unavailable.
  }
}

export function useMizmoRankings(identity: Identity | null) {
  const [state, setState] = useState<RankingState>(() => {
    if (!identity) {
      return {
        identityKey: null,
        data: null,
        loaded: false,
        status: 'idle',
        error: '',
      }
    }

    return {
      identityKey: identity.pubkey,
      data: readLocal(identity.pubkey),
      loaded: false,
      status: 'loading',
      error: '',
    }
  })
  const dataRef = useRef<RankingPayload | null>(null)
  const publishTimer = useRef<number | null>(null)

  useEffect(() => {
    if (publishTimer.current !== null) {
      window.clearTimeout(publishTimer.current)
      publishTimer.current = null
    }

    if (!identity) {
      dataRef.current = null
      return
    }

    let active = true
    const local = readLocal(identity.pubkey)
    dataRef.current = local

    fetchRankings(identity)
      .then(async (remote) => {
        if (!active) return

        const remoteIsNewer =
          remote !== null &&
          (!local || remote.updatedAt > local.updatedAt)
        const selected = remoteIsNewer ? remote : (local ?? emptyRankings())
        dataRef.current = selected
        writeLocal(identity.pubkey, selected)
        setState({
          identityKey: identity.pubkey,
          data: selected,
          loaded: true,
          status: remoteIsNewer || remote ? 'saved' : 'idle',
          error: '',
        })

        if (local && (!remote || local.updatedAt > remote.updatedAt)) {
          try {
            await publishRankings(identity, local)
            if (!active) return
            setState((current) =>
              current.identityKey === identity.pubkey &&
              current.data?.updatedAt === local.updatedAt
                ? { ...current, status: 'saved', error: '' }
                : current,
            )
          } catch (caught) {
            if (!active) return
            setState((current) =>
              current.identityKey === identity.pubkey
                ? {
                    ...current,
                    status: 'error',
                    error:
                      caught instanceof Error
                        ? caught.message
                        : 'Your changes are saved here, but could not be updated everywhere.',
                  }
                : current,
            )
          }
        }
      })
      .catch(() => {
        if (!active) return
        const selected = local ?? emptyRankings()
        dataRef.current = selected
        setState({
          identityKey: identity.pubkey,
          data: selected,
          loaded: true,
          status: 'error',
          error:
            "We couldn't load your saved order. Showing this device's version.",
        })
      })

    return () => {
      active = false
    }
  }, [identity])

  const commit = useCallback(
    (update: (current: RankingPayload) => RankingPayload) => {
      const currentIdentity = identity

      if (!currentIdentity) return

      const current = dataRef.current ?? emptyRankings()
      const next = {
        ...update(current),
        version: 1 as const,
        updatedAt: Date.now(),
      }
      dataRef.current = next
      writeLocal(currentIdentity.pubkey, next)
      setState({
        identityKey: currentIdentity.pubkey,
        data: next,
        loaded: true,
        status: 'saving',
        error: '',
      })

      if (publishTimer.current !== null) {
        window.clearTimeout(publishTimer.current)
      }

      publishTimer.current = window.setTimeout(async () => {
        const toPublish = dataRef.current

        if (
          !toPublish ||
          !currentIdentity
        ) {
          return
        }

        try {
          await publishRankings(currentIdentity, toPublish)
          setState((latest) =>
            latest.identityKey === currentIdentity.pubkey &&
            latest.data?.updatedAt === toPublish.updatedAt
              ? { ...latest, status: 'saved', error: '' }
              : latest,
          )
        } catch (caught) {
          setState((latest) =>
            latest.identityKey === currentIdentity.pubkey
              ? {
                  ...latest,
                  status: 'error',
                  error:
                    caught instanceof Error
                      ? caught.message
                      : 'Your changes are saved here, but could not be updated everywhere.',
                }
              : latest,
          )
        }
      }, PUBLISH_DELAY)
    },
    [identity],
  )

  const current =
    identity && state.identityKey === identity.pubkey
      ? state
      : {
          identityKey: identity?.pubkey ?? null,
          data: null,
          loaded: false,
          status: identity ? ('loading' as const) : ('idle' as const),
          error: '',
        }

  const setInboxOrder = useCallback(
    (ids: string[]) => {
      commit((currentRankings) => ({ ...currentRankings, inbox: ids }))
    },
    [commit],
  )

  const setOutboxOrder = useCallback(
    (counterparty: string, ids: string[]) => {
      commit((currentRankings) => ({
        ...currentRankings,
        outbox: {
          ...currentRankings.outbox,
          [counterparty]: ids,
        },
      }))
    },
    [commit],
  )

  const archiveRecord = useCallback(
    (id: string) => {
      commit((currentRankings) => ({
        ...currentRankings,
        archived: [
          id,
          ...currentRankings.archived.filter((entry) => entry !== id),
        ],
      }))
    },
    [commit],
  )

  const restoreRecord = useCallback(
    (id: string) => {
      commit((currentRankings) => ({
        ...currentRankings,
        archived: currentRankings.archived.filter((entry) => entry !== id),
      }))
    },
    [commit],
  )

  const deleteRecord = useCallback(
    (id: string) => {
      commit((currentRankings) => ({
        ...currentRankings,
        inbox: currentRankings.inbox.filter((entry) => entry !== id),
        outbox: Object.fromEntries(
          Object.entries(currentRankings.outbox).map(([pubkey, ids]) => [
            pubkey,
            ids.filter((entry) => entry !== id),
          ]),
        ),
        archived: currentRankings.archived.filter((entry) => entry !== id),
        deleted: [
          id,
          ...currentRankings.deleted.filter((entry) => entry !== id),
        ],
      }))
    },
    [commit],
  )

  return {
    rankings: current.data ?? emptyRankings(),
    loaded: current.loaded,
    status: current.status,
    error: current.error,
    setInboxOrder,
    setOutboxOrder,
    archiveRecord,
    restoreRecord,
    deleteRecord,
  }
}
