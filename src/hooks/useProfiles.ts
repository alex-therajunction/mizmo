import { useEffect, useMemo, useReducer } from 'react'
import { fetchProfiles, type ProfileData } from '../lib/nostr'

type ProfileCache = Record<string, ProfileData | null>

const cache: ProfileCache = {}
const listeners = new Set<() => void>()
const queue = new Set<string>()
let flushTimer: number | null = null

function notify() {
  listeners.forEach((listener) => listener())
}

export function primeProfile(
  pubkey: string,
  profile: ProfileData | null,
): void {
  cache[pubkey] = profile
  notify()
}

async function flushQueue() {
  flushTimer = null
  const pubkeys = Array.from(queue).filter(
    (pubkey) => !(pubkey in cache),
  )
  queue.clear()

  if (pubkeys.length === 0) return

  try {
    const profiles = await fetchProfiles(pubkeys)

    for (const pubkey of pubkeys) {
      cache[pubkey] = profiles[pubkey] ?? null
    }
  } catch {
    for (const pubkey of pubkeys) {
      cache[pubkey] = null
    }
  }

  notify()
}

function queueProfiles(pubkeys: readonly string[]) {
  for (const pubkey of pubkeys) {
    if (pubkey && !(pubkey in cache)) queue.add(pubkey)
  }

  if (queue.size > 0 && flushTimer === null) {
    flushTimer = window.setTimeout(flushQueue, 0)
  }
}

export function useProfiles(pubkeys: readonly string[]) {
  const [, rerender] = useReducer((value: number) => value + 1, 0)
  const key = Array.from(new Set(pubkeys.filter(Boolean)))
    .sort()
    .join(',')
  const uniquePubkeys = useMemo(
    () => (key ? key.split(',') : []),
    [key],
  )

  useEffect(() => {
    const listener = () => rerender()
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  }, [])

  useEffect(() => {
    queueProfiles(uniquePubkeys)
  }, [uniquePubkeys])

  const profiles: ProfileCache = {}

  for (const pubkey of uniquePubkeys) {
    if (pubkey in cache) profiles[pubkey] = cache[pubkey]
  }

  return {
    profiles,
    loading: uniquePubkeys.some((pubkey) => !(pubkey in cache)),
  }
}
