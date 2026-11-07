import { useProfiles } from './useProfiles'

export function useProfile(pubkey: string | null) {
  const { profiles, loading } = useProfiles(pubkey ? [pubkey] : [])

  return {
    profile: pubkey ? (profiles[pubkey] ?? null) : null,
    loading: Boolean(pubkey) && loading,
  }
}
