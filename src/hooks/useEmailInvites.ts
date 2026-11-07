import { useEffect, useState } from 'react'
import type { Identity } from '../lib/identity'
import {
  EMAIL_INVITE_CLAIM_TAG,
  decodeEmailInviteClaim,
  fetchEmailInviteClaimEvents,
  fetchSentEmailInviteMetadataForDisplay,
  fetchSentEmailInvites,
  readStoredReceivedEmailInvites,
  syncReceivedEmailInvites,
  type EmailInviteClaim,
  type ReceivedEmailInvite,
  type SentEmailInvite,
} from '../lib/emailInvites'
import { MIZMO_KIND, pool, RELAYS } from '../lib/nostr'

type SentInviteState = {
  identityKey: string | null
  invites: SentEmailInvite[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string
}

type ReceivedInviteState = {
  identityKey: string | null
  invites: ReceivedEmailInvite[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string
}

export function useSentEmailInvites(identity: Identity | null) {
  const [state, setState] = useState<SentInviteState>({
    identityKey: null,
    invites: [],
    status: 'idle',
    error: '',
  })

  useEffect(() => {
    if (!identity) return

    let active = true
    let claimSubscription: { close: () => void } | null = null

    Promise.all([
      fetchSentEmailInviteMetadataForDisplay(identity),
      fetchSentEmailInvites(identity),
      fetchEmailInviteClaimEvents(identity).catch(() => []),
    ])
      .then(([metadata, invites, claimEvents]) => {
        if (!active) return

        const metadataById = new Map(
          metadata.map((invite) => [invite.id, invite]),
        )
        const invitePubkeys = new Map(
          invites.map((invite) => [invite.id, invite.invitePubkey]),
        )
        const claims = claimEvents
          .map((event) => decodeEmailInviteClaim(event, identity, invitePubkeys))
          .filter((claim): claim is EmailInviteClaim => claim !== null)
          .sort((a, b) => a.acceptedAt - b.acceptedAt)
        const claimByInvite = new Map<string, EmailInviteClaim>()

        for (const claim of claims) {
          if (!claimByInvite.has(claim.inviteId)) {
            claimByInvite.set(claim.inviteId, claim)
          }
        }

        const records = invites.map((invite) => {
          const claim = claimByInvite.get(invite.id)

          return {
            id: invite.id,
            eventId: invite.eventId,
            email: metadataById.get(invite.id)?.email ?? '',
            ask: invite.ask,
            deadline: invite.deadline,
            createdAt: invite.createdAt,
            status: claim ? ('accepted' as const) : ('pending' as const),
            recipient: claim?.recipient ?? null,
          }
        })

        setState({
          identityKey: identity.pubkey,
          invites: records,
          status: 'ready',
          error: '',
        })

        claimSubscription = pool.subscribeMany(
          [...RELAYS],
          {
            kinds: [MIZMO_KIND],
            '#p': [identity.pubkey],
            '#t': [EMAIL_INVITE_CLAIM_TAG],
          },
          {
            onevent: (event) => {
              const claim = decodeEmailInviteClaim(
                event,
                identity,
                invitePubkeys,
              )

              if (!claim) return

              setState((current) =>
                current.identityKey === identity.pubkey
                  ? {
                      ...current,
                      invites: current.invites.map((invite) =>
                        invite.id === claim.inviteId &&
                        invite.status === 'pending'
                          ? {
                              ...invite,
                              status: 'accepted',
                              recipient: claim.recipient,
                            }
                          : invite,
                      ),
                    }
                  : current,
              )
            },
            label: 'mizmo-email-invite-claims',
          },
        )
      })
      .catch(() => {
        if (!active) return
        setState({
          identityKey: identity.pubkey,
          invites: [],
          status: 'error',
          error: 'Email invitations could not be loaded from the relays.',
        })
      })

    return () => {
      active = false
      claimSubscription?.close()
    }
  }, [identity])

  const current =
    identity && state.identityKey === identity.pubkey
      ? state
      : {
          identityKey: identity?.pubkey ?? null,
          invites: [] as SentEmailInvite[],
          status: identity ? ('loading' as const) : ('idle' as const),
          error: '',
        }

  return {
    invites: current.invites,
    status: current.status,
    error: current.error,
  }
}

export function useReceivedEmailInvites(identity: Identity | null) {
  const [state, setState] = useState<ReceivedInviteState>(() => ({
    identityKey: identity?.pubkey ?? null,
    invites: identity ? readStoredReceivedEmailInvites(identity.pubkey) : [],
    status: identity ? 'loading' : 'idle',
    error: '',
  }))

  useEffect(() => {
    if (!identity) return

    let active = true
    const local = readStoredReceivedEmailInvites(identity.pubkey)

    syncReceivedEmailInvites(identity)
      .then((result) => {
        if (!active) return
        setState({
          identityKey: identity.pubkey,
          invites: result.invites,
          status: 'ready',
          error: result.error
            ? 'Email invitations are showing from this device because the relays could not be reached.'
            : '',
        })
      })
      .catch(() => {
        if (!active) return
        setState({
          identityKey: identity.pubkey,
          invites: local,
          status: 'error',
          error: 'Email invitations could not be synced from the relays.',
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
          invites: [] as ReceivedEmailInvite[],
          status: identity ? ('loading' as const) : ('idle' as const),
          error: '',
        }

  return {
    invites: current.invites,
    status: current.status,
    error: current.error,
  }
}
