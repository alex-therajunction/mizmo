import { useEffect, useState } from 'react'
import { fetchProfile, type ProfileData } from '../lib/nostr'

export function useProfile(pubkey: string | null) {
  const [result, setResult] = useState<{
    pubkey: string | null
    profile: ProfileData | null
  }>({ pubkey: null, profile: null })

  useEffect(() => {
    if (!pubkey) return

    let active = true

    fetchProfile(pubkey)
      .then((next) => {
        if (active) setResult({ pubkey, profile: next })
      })
      .catch(() => {
        if (active) setResult({ pubkey, profile: null })
      })

    return () => {
      active = false
    }
  }, [pubkey])

  const current = result.pubkey === pubkey

  return {
    profile: current ? result.profile : null,
    loading: Boolean(pubkey) && !current,
  }
}
