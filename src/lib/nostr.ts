import {
  finalizeEvent,
  nip19,
  nip44,
  SimplePool,
  type Event,
  type Filter,
} from 'nostr-tools'
import {
  parseRankingPayload,
  type RankingPayload,
} from './rankings'

export const MIZMO_KIND = 30078
export const PROFILE_KIND = 0
export const CONTACTS_KIND = 3
export const MIZMO_TAG = 'mizmo'
export const RANKINGS_D_TAG = 'mizmo.me/rankings'

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

export type ProfileUpdate = {
  name: string
  picture?: string | null
}

export function tagValue(event: Event, name: string): string | undefined {
  return event.tags.find((tag) => tag[0] === name)?.[1]
}

export function normalizeNostrId(value: string): string | null {
  let clean = ''

  try {
    clean = decodeURIComponent(value).trim()

    if (/^https?:\/\//i.test(clean)) {
      clean = new URL(clean).pathname.split('/').filter(Boolean).pop() ?? ''
    }

    clean = clean.replace(/^nostr:/i, '')
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
  const recipient = tagValue(event, 'p')
  return recipient ? recipient.toLowerCase() : null
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
    throw new Error('This ask is missing a recipient.')
  }

  const conversationKey = nip44.getConversationKey(secretKey, counterparty)
  const plaintext = nip44.decrypt(event.content, conversationKey)
  const payload = JSON.parse(plaintext) as Partial<MizmoPayload>

  if (typeof payload.ask !== 'string' || !payload.ask.trim()) {
    throw new Error("This ask can't be opened.")
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

  await publishEvent(
    event,
    "We couldn't send that just now. Check your connection and try again.",
  )

  return event
}

async function publishEvent(event: Event, failureMessage: string): Promise<void> {
  const results = await Promise.allSettled(pool.publish([...RELAYS], event))

  if (!results.some((result) => result.status === 'fulfilled')) {
    throw new Error(failureMessage)
  }
}

async function latestEvent(filter: Filter): Promise<Event | null> {
  const events = await pool.querySync([...RELAYS], filter, { maxWait: 4000 })
  return events.sort((a, b) => b.created_at - a.created_at)[0] ?? null
}

function nextCreatedAt(previous: number | undefined): number {
  const now = Math.floor(Date.now() / 1000)
  return previous === undefined ? now : Math.max(now, previous + 1)
}

function profileFromContent(content: string): ProfileData {
  const metadata = JSON.parse(content) as Record<string, unknown>

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
}

export async function fetchProfiles(
  pubkeys: readonly string[],
): Promise<Record<string, ProfileData>> {
  const authors = Array.from(new Set(pubkeys.filter(Boolean)))

  if (authors.length === 0) return {}

  try {
    const events = await pool.querySync(
      [...RELAYS],
      {
        kinds: [PROFILE_KIND],
        authors,
        limit: Math.max(20, authors.length * 5),
      },
      { maxWait: 3500 },
    )
    const newest = new Map<string, Event>()

    for (const event of events) {
      const current = newest.get(event.pubkey)
      if (!current || event.created_at > current.created_at) {
        newest.set(event.pubkey, event)
      }
    }

    const profiles: Record<string, ProfileData> = {}

    for (const [pubkey, event] of newest) {
      try {
        profiles[pubkey] = profileFromContent(event.content)
      } catch {
        profiles[pubkey] = {}
      }
    }

    return profiles
  } catch {
    return {}
  }
}

export async function fetchProfile(
  pubkey: string,
): Promise<ProfileData | null> {
  const profiles = await fetchProfiles([pubkey])
  return profiles[pubkey] ?? null
}

export async function publishProfile(
  identity: { pubkey: string; secretKey: Uint8Array },
  update: ProfileUpdate,
): Promise<ProfileData> {
  const latest = await latestEvent({
    kinds: [PROFILE_KIND],
    authors: [identity.pubkey],
    limit: 5,
  })
  let metadata: Record<string, unknown> = {}

  if (latest) {
    try {
      const parsed = JSON.parse(latest.content) as unknown

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        metadata = { ...(parsed as Record<string, unknown>) }
      }
    } catch {
      metadata = {}
    }
  }

  const name = update.name.trim()

  if (name) {
    metadata.name = name
    metadata.display_name = name
  } else {
    delete metadata.name
    delete metadata.display_name
  }

  if (update.picture === null) {
    delete metadata.picture
  } else if (typeof update.picture === 'string') {
    metadata.picture = update.picture
  }

  const content = JSON.stringify(metadata)
  const event = finalizeEvent(
    {
      kind: PROFILE_KIND,
      created_at: nextCreatedAt(latest?.created_at),
      tags: latest?.tags ?? [],
      content,
    },
    identity.secretKey,
  )

  await publishEvent(
    event,
    "We couldn't save your profile. Check your connection and try again.",
  )

  return profileFromContent(content)
}

function contactPubkeys(event: Event | null): string[] {
  if (!event) return []

  return Array.from(
    new Set(
      event.tags
        .filter(
          (tag) =>
            tag[0] === 'p' &&
            typeof tag[1] === 'string' &&
            /^[0-9a-f]{64}$/i.test(tag[1]),
        )
        .map((tag) => tag[1].toLowerCase()),
    ),
  )
}

export async function fetchContacts(pubkey: string): Promise<string[]> {
  const latest = await latestEvent({
    kinds: [CONTACTS_KIND],
    authors: [pubkey],
    limit: 5,
  })

  return contactPubkeys(latest)
}

export async function updateContacts(
  identity: { pubkey: string; secretKey: Uint8Array },
  target: string,
  action: 'add' | 'remove',
): Promise<string[]> {
  const latest = await latestEvent({
    kinds: [CONTACTS_KIND],
    authors: [identity.pubkey],
    limit: 5,
  })
  const currentTags = latest?.tags ?? []
  const alreadyIncluded = currentTags.some(
    (tag) => tag[0] === 'p' && tag[1]?.toLowerCase() === target,
  )

  if (
    (action === 'add' && alreadyIncluded) ||
    (action === 'remove' && !alreadyIncluded) ||
    target === identity.pubkey
  ) {
    return contactPubkeys(latest)
  }

  const tags =
    action === 'add'
      ? [...currentTags, ['p', target]]
      : currentTags.filter(
          (tag) => !(tag[0] === 'p' && tag[1]?.toLowerCase() === target),
        )
  const event = finalizeEvent(
    {
      kind: CONTACTS_KIND,
      created_at: nextCreatedAt(latest?.created_at),
      tags,
      content: latest?.content ?? '',
    },
    identity.secretKey,
  )

  await publishEvent(
    event,
    action === 'add'
      ? "We couldn't add that contact just now. Check your connection and try again."
      : "We couldn't remove that contact just now. Check your connection and try again.",
  )

  return contactPubkeys(event)
}

export async function fetchRankings(
  identity: { pubkey: string; secretKey: Uint8Array },
): Promise<RankingPayload | null> {
  const latest = await latestEvent({
    kinds: [MIZMO_KIND],
    authors: [identity.pubkey],
    '#d': [RANKINGS_D_TAG],
    limit: 5,
  })

  if (!latest) return null

  const conversationKey = nip44.getConversationKey(
    identity.secretKey,
    identity.pubkey,
  )
  const plaintext = nip44.decrypt(latest.content, conversationKey)

  return parseRankingPayload(JSON.parse(plaintext))
}

export async function publishRankings(
  identity: { pubkey: string; secretKey: Uint8Array },
  rankings: RankingPayload,
): Promise<void> {
  const latest = await latestEvent({
    kinds: [MIZMO_KIND],
    authors: [identity.pubkey],
    '#d': [RANKINGS_D_TAG],
    limit: 5,
  })
  const conversationKey = nip44.getConversationKey(
    identity.secretKey,
    identity.pubkey,
  )
  const content = nip44.encrypt(
    JSON.stringify(rankings),
    conversationKey,
  )
  const event = finalizeEvent(
    {
      kind: MIZMO_KIND,
      created_at: nextCreatedAt(latest?.created_at),
      tags: [
        ['d', RANKINGS_D_TAG],
        ['client', 'mizmo.me'],
      ],
      content,
    },
    identity.secretKey,
  )

  await publishEvent(
    event,
    "Your changes are saved on this device, but couldn't be updated everywhere.",
  )
}
