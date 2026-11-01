import {
  finalizeEvent,
  nip19,
  nip44,
  SimplePool,
  type Event,
  type Filter,
} from 'nostr-tools'

export const MIZMO_KIND = 30078
export const MIZMO_TAG = 'mizmo'

export const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
] as const

export const pool = new SimplePool({
  enablePing: true,
  enableReconnect: true,
})

export type ProfileData = {
  name?: string
  displayName?: string
  about?: string
  picture?: string
  nip05?: string
}

export type MizmoPayload = {
  version: 1
  ask: string
}

export type SendMizmoInput = {
  recipient: string
  ask: string
  deadline: number | null
}

export function tagValue(event: Event, name: string): string | undefined {
  return event.tags.find((tag) => tag[0] === name)?.[1]
}

export function normalizeNostrId(value: string): string | null {
  let clean = ''

  try {
    clean = decodeURIComponent(value).trim().replace(/^nostr:/i, '')
  } catch {
    return null
  }

  if (!clean) return null

  if (/^[0-9a-f]{64}$/i.test(clean)) {
    return clean.toLowerCase()
  }

  try {
    const decoded = nip19.decode(clean)

    if (decoded.type === 'npub') return decoded.data
    if (decoded.type === 'nprofile') return decoded.data.pubkey
  } catch {
    return null
  }

  return null
}

export function deadlineFromEvent(event: Event): number | null {
  const raw = tagValue(event, 'deadline')

  if (!raw) return null

  const seconds = Number(raw)
  return Number.isFinite(seconds) ? seconds * 1000 : null
}

export function recipientFromEvent(event: Event): string | null {
  return tagValue(event, 'p') ?? null
}

export function mizmoFilterForInbox(pubkey: string): Filter {
  return {
    kinds: [MIZMO_KIND],
    '#p': [pubkey],
    '#t': [MIZMO_TAG],
    limit: 300,
  }
}

export function mizmoFilterForOutbox(pubkey: string): Filter {
  return {
    kinds: [MIZMO_KIND],
    authors: [pubkey],
    '#t': [MIZMO_TAG],
    limit: 300,
  }
}

export function decryptMizmo(
  event: Event,
  secretKey: Uint8Array,
  ownPubkey: string,
): MizmoPayload {
  const counterparty =
    event.pubkey === ownPubkey ? recipientFromEvent(event) : event.pubkey

  if (!counterparty) {
    throw new Error('The recipient is missing from this mizmo.')
  }

  const conversationKey = nip44.getConversationKey(secretKey, counterparty)
  const plaintext = nip44.decrypt(event.content, conversationKey)
  const payload = JSON.parse(plaintext) as Partial<MizmoPayload>

  if (typeof payload.ask !== 'string' || !payload.ask.trim()) {
    throw new Error('This mizmo has no readable ask.')
  }

  return {
    version: 1,
    ask: payload.ask,
  }
}

export async function sendMizmo(
  input: SendMizmoInput,
  secretKey: Uint8Array,
): Promise<Event> {
  const ask = input.ask.trim()

  if (!ask) {
    throw new Error('Write the ask before sending.')
  }

  const payload: MizmoPayload = { version: 1, ask }
  const conversationKey = nip44.getConversationKey(
    secretKey,
    input.recipient,
  )
  const content = nip44.encrypt(JSON.stringify(payload), conversationKey)

  const tags: string[][] = [
    ['d', crypto.randomUUID()],
    ['p', input.recipient],
    ['t', MIZMO_TAG],
    ['client', 'mizmo.me'],
  ]

  if (input.deadline !== null) {
    tags.push(['deadline', String(Math.floor(input.deadline / 1000))])
  }

  const event = finalizeEvent(
    {
      kind: MIZMO_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
    },
    secretKey,
  )

  const results = await Promise.allSettled(pool.publish([...RELAYS], event))

  if (!results.some((result) => result.status === 'fulfilled')) {
    throw new Error(
      'No relay accepted the mizmo. Check your connection and try again.',
    )
  }

  return event
}

export async function fetchProfile(
  pubkey: string,
): Promise<ProfileData | null> {
  try {
    const events = await pool.querySync(
      [...RELAYS],
      { kinds: [0], authors: [pubkey], limit: 5 },
      { maxWait: 3500 },
    )

    const newest = events.sort((a, b) => b.created_at - a.created_at)[0]

    if (!newest) return null

    const metadata = JSON.parse(newest.content) as Record<string, unknown>

    return {
      name: typeof metadata.name === 'string' ? metadata.name : undefined,
      displayName:
        typeof metadata.display_name === 'string'
          ? metadata.display_name
          : undefined,
      about: typeof metadata.about === 'string' ? metadata.about : undefined,
      picture:
        typeof metadata.picture === 'string' ? metadata.picture : undefined,
      nip05: typeof metadata.nip05 === 'string' ? metadata.nip05 : undefined,
    }
  } catch {
    return null
  }
}
