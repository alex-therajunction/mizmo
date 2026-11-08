import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip44,
  type Event,
} from 'nostr-tools'
import { bytesToHex, hexToBytes } from './encoding'
import type { Identity } from './identity'
import {
  deadlineFromEvent,
  MIZMO_KIND,
  pool,
  RELAYS,
  tagValue,
  updateContacts,
  type MizmoPayload,
} from './nostr'

export const EMAIL_INVITE_TAG = 'mizmo-email-invite'
export const EMAIL_INVITE_CLAIM_TAG = 'mizmo-email-invite-claim'
export const SENT_EMAIL_INVITES_D_TAG = 'mizmo.me/sent-email-invites'
export const RECEIVED_EMAIL_INVITES_D_TAG = 'mizmo.me/received-email-invites'

const JOIN_PATH = 'join'
const QUERY_WAIT = 4500
const SENT_STORAGE_PREFIX = 'mizmo.sentEmailInvites.v1.'
const RECEIVED_STORAGE_PREFIX = 'mizmo.receivedEmailInvites.v1.'

export type EmailInviteLink = {
  eventId: string
  secretKey: Uint8Array
}

export type EmailInviteInput = {
  recipientEmail: string
  ask: string
  deadline: number | null
}

export type SentEmailInviteMetadata = {
  version: 1
  updatedAt: number
  invites: SentEmailInviteMeta[]
}

export type SentEmailInviteMeta = {
  id: string
  eventId: string
  email: string
  createdAt: number
}

export type SentEmailInvite = {
  id: string
  eventId: string
  email: string
  ask: string
  deadline: number | null
  createdAt: number
  status: 'pending' | 'accepted'
  recipient: string | null
}

export type ReceivedEmailInvite = {
  id: string
  eventId: string
  inviter: string
  ask: string
  deadline: number | null
  createdAt: number
  receivedAt: number
}

export type ReceivedEmailInviteMetadata = {
  version: 1
  updatedAt: number
  invites: ReceivedEmailInvite[]
}

export type EmailInviteClaim = {
  inviteId: string
  eventId: string
  recipient: string
  acceptedAt: number
}

export type AcceptedEmailInvite = {
  invite: ReceivedEmailInvite
  contactAdded: boolean
  claimPublished: boolean
  metadataSynced: boolean
}

function emptySentMetadata(): SentEmailInviteMetadata {
  return { version: 1, updatedAt: 0, invites: [] }
}

function emptyReceivedMetadata(): ReceivedEmailInviteMetadata {
  return { version: 1, updatedAt: 0, invites: [] }
}

function appBaseUrl(): string {
  return import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
}

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    return
  }
}

function validSentMeta(value: unknown): SentEmailInviteMeta | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const item = value as Record<string, unknown>

  if (
    typeof item.id !== 'string' ||
    typeof item.eventId !== 'string' ||
    typeof item.email !== 'string' ||
    typeof item.createdAt !== 'number'
  ) {
    return null
  }

  return {
    id: item.id,
    eventId: item.eventId,
    email: item.email,
    createdAt: item.createdAt,
  }
}

function parseSentMetadata(value: unknown): SentEmailInviteMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const payload = value as Record<string, unknown>

  if (
    payload.version !== 1 ||
    typeof payload.updatedAt !== 'number' ||
    !Array.isArray(payload.invites)
  ) {
    return null
  }

  return {
    version: 1,
    updatedAt: payload.updatedAt,
    invites: payload.invites
      .map(validSentMeta)
      .filter((item): item is SentEmailInviteMeta => item !== null),
  }
}

function validReceivedInvite(value: unknown): ReceivedEmailInvite | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const item = value as Record<string, unknown>

  if (
    typeof item.id !== 'string' ||
    typeof item.eventId !== 'string' ||
    typeof item.inviter !== 'string' ||
    typeof item.ask !== 'string' ||
    (item.deadline !== null && typeof item.deadline !== 'number') ||
    typeof item.createdAt !== 'number' ||
    typeof item.receivedAt !== 'number'
  ) {
    return null
  }

  return {
    id: item.id,
    eventId: item.eventId,
    inviter: item.inviter,
    ask: item.ask,
    deadline: item.deadline,
    createdAt: item.createdAt,
    receivedAt: item.receivedAt,
  }
}

function parseReceivedMetadata(
  value: unknown,
): ReceivedEmailInviteMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const payload = value as Record<string, unknown>

  if (
    payload.version !== 1 ||
    typeof payload.updatedAt !== 'number' ||
    !Array.isArray(payload.invites)
  ) {
    return null
  }

  return {
    version: 1,
    updatedAt: payload.updatedAt,
    invites: payload.invites
      .map(validReceivedInvite)
      .filter((item): item is ReceivedEmailInvite => item !== null),
  }
}

function mergeSentMetadata(
  first: SentEmailInviteMetadata,
  second: SentEmailInviteMetadata,
): SentEmailInviteMetadata {
  const byId = new Map<string, SentEmailInviteMeta>()

  for (const invite of first.invites) byId.set(invite.id, invite)
  for (const invite of second.invites) byId.set(invite.id, invite)

  return {
    version: 1,
    updatedAt: Math.max(first.updatedAt, second.updatedAt),
    invites: Array.from(byId.values()).sort(
      (a, b) => b.createdAt - a.createdAt,
    ),
  }
}

function mergeReceivedMetadata(
  first: ReceivedEmailInviteMetadata,
  second: ReceivedEmailInviteMetadata,
): ReceivedEmailInviteMetadata {
  const byEventId = new Map<string, ReceivedEmailInvite>()

  for (const invite of first.invites) byEventId.set(invite.eventId, invite)
  for (const invite of second.invites) byEventId.set(invite.eventId, invite)

  return {
    version: 1,
    updatedAt: Math.max(first.updatedAt, second.updatedAt),
    invites: Array.from(byEventId.values()).sort(
      (a, b) => b.receivedAt - a.receivedAt,
    ),
  }
}

function readLocalSentMetadata(pubkey: string): SentEmailInviteMetadata {
  return (
    parseSentMetadata(readJson(`${SENT_STORAGE_PREFIX}${pubkey}`)) ??
    emptySentMetadata()
  )
}

function readLocalReceivedMetadata(
  pubkey: string,
): ReceivedEmailInviteMetadata {
  return (
    parseReceivedMetadata(readJson(`${RECEIVED_STORAGE_PREFIX}${pubkey}`)) ??
    emptyReceivedMetadata()
  )
}

async function publishEvent(
  event: Event,
  failureMessage: string,
): Promise<void> {
  const results = await Promise.allSettled(pool.publish([...RELAYS], event))

  if (!results.some((result) => result.status === 'fulfilled')) {
    throw new Error(failureMessage)
  }
}

async function latestEvent(
  filter: Parameters<typeof pool.querySync>[1],
): Promise<Event | null> {
  const events = await pool.querySync([...RELAYS], filter, {
    maxWait: QUERY_WAIT,
  })
  return events.sort((a, b) => b.created_at - a.created_at)[0] ?? null
}

function nextCreatedAt(previous: number | undefined): number {
  const now = Math.floor(Date.now() / 1000)
  return previous === undefined ? now : Math.max(now, previous + 1)
}

function selfConversationKey(identity: Identity): Uint8Array {
  return nip44.getConversationKey(identity.secretKey, identity.pubkey)
}

async function fetchSentMetadataEvent(
  identity: Identity,
): Promise<Event | null> {
  return latestEvent({
    kinds: [MIZMO_KIND],
    authors: [identity.pubkey],
    '#d': [SENT_EMAIL_INVITES_D_TAG],
    limit: 5,
  })
}

async function fetchReceivedMetadataEvent(
  identity: Identity,
): Promise<Event | null> {
  return latestEvent({
    kinds: [MIZMO_KIND],
    authors: [identity.pubkey],
    '#d': [RECEIVED_EMAIL_INVITES_D_TAG],
    limit: 5,
  })
}

async function fetchSentEmailInviteMetadata(
  identity: Identity,
): Promise<SentEmailInviteMetadata | null> {
  const latest = await fetchSentMetadataEvent(identity)

  if (!latest) return null

  const plaintext = nip44.decrypt(latest.content, selfConversationKey(identity))
  return parseSentMetadata(JSON.parse(plaintext))
}

async function fetchReceivedEmailInviteMetadata(
  identity: Identity,
): Promise<ReceivedEmailInviteMetadata | null> {
  const latest = await fetchReceivedMetadataEvent(identity)

  if (!latest) return null

  const plaintext = nip44.decrypt(latest.content, selfConversationKey(identity))
  return parseReceivedMetadata(JSON.parse(plaintext))
}

async function publishSentEmailInviteMetadata(
  identity: Identity,
  metadata: SentEmailInviteMetadata,
): Promise<void> {
  const latest = await fetchSentMetadataEvent(identity)
  const event = finalizeEvent(
    {
      kind: MIZMO_KIND,
      created_at: nextCreatedAt(latest?.created_at),
      tags: [
        ['d', SENT_EMAIL_INVITES_D_TAG],
        ['client', 'mizmo.me'],
      ],
      content: nip44.encrypt(
        JSON.stringify(metadata),
        selfConversationKey(identity),
      ),
    },
    identity.secretKey,
  )

  await publishEvent(
    event,
    "The email invitation was sent, but your sent list couldn't finish updating.",
  )
}

async function publishReceivedEmailInviteMetadata(
  identity: Identity,
  metadata: ReceivedEmailInviteMetadata,
): Promise<void> {
  const latest = await fetchReceivedMetadataEvent(identity)
  const event = finalizeEvent(
    {
      kind: MIZMO_KIND,
      created_at: nextCreatedAt(latest?.created_at),
      tags: [
        ['d', RECEIVED_EMAIL_INVITES_D_TAG],
        ['client', 'mizmo.me'],
      ],
      content: nip44.encrypt(
        JSON.stringify(metadata),
        selfConversationKey(identity),
      ),
    },
    identity.secretKey,
  )

  await publishEvent(
    event,
    "This ask was received, but couldn't finish updating.",
  )
}

function inviteIdFromEvent(event: Event): string | null {
  return (
    tagValue(event, 'invite') ||
    tagValue(event, 'd')?.replace(/^mizmo\.me\/email-invite\//, '') ||
    null
  )
}

export function buildEmailInviteUrl(
  eventId: string,
  secretKey: Uint8Array,
): string {
  const url = new URL(`${appBaseUrl()}${JOIN_PATH}`, window.location.origin)
  url.hash = new URLSearchParams({
    invite: eventId,
    key: bytesToHex(secretKey),
  }).toString()
  return url.toString()
}

export function readEmailInviteFromHash(
  hash: string,
): EmailInviteLink | null {
  const clean = hash.replace(/^#/, '').trim()

  if (!clean) return null

  const params = new URLSearchParams(clean)
  const eventId = params.get('invite')?.trim().toLowerCase() ?? ''
  const secretHex = params.get('key')?.trim().toLowerCase() ?? ''

  if (!/^[0-9a-f]{64}$/.test(eventId) || !/^[0-9a-f]{64}$/.test(secretHex)) {
    return null
  }

  try {
    return { eventId, secretKey: hexToBytes(secretHex) }
  } catch {
    return null
  }
}

export function buildEmailInviteMailto(input: {
  recipientEmail: string
  inviterName: string
  link: string
}): string {
  const subject = `${input.inviterName} sent you an ask on miZmo`
  const body = [
    `${input.inviterName} sent you an ask on miZmo.me.`,
    '',
    'Open it here:',
    input.link,
    '',
    'Opening the link will show you the ask and add the sender to your contacts.',
    '',
    'miZmo is a simple way to ask someone to do something and keep track of it. No password or download is required.',
  ].join('\n')

  return `mailto:${encodeURIComponent(input.recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export async function createEmailInvite(
  identity: Identity,
  input: EmailInviteInput,
): Promise<{ event: Event; secretKey: Uint8Array; inviteId: string }> {
  const ask = input.ask.trim()
  const email = input.recipientEmail.trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address.')
  }

  if (!ask) {
    throw new Error('Write the ask before sending.')
  }

  if (ask.length > 2000) {
    throw new Error('Keep the ask under 2,000 characters.')
  }

  const secretKey = generateSecretKey()
  const invitePubkey = getPublicKey(secretKey)
  const inviteId = crypto.randomUUID()
  const payload: MizmoPayload = { version: 1, ask }
  const conversationKey = nip44.getConversationKey(
    identity.secretKey,
    invitePubkey,
  )
  const tags: string[][] = [
    ['d', `mizmo.me/email-invite/${inviteId}`],
    ['t', EMAIL_INVITE_TAG],
    ['p', invitePubkey],
    ['invite', inviteId],
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
      content: nip44.encrypt(JSON.stringify(payload), conversationKey),
    },
    identity.secretKey,
  )

  await publishEvent(
    event,
    "We couldn't send that email invitation just now. Check your connection and try again.",
  )

  return { event, secretKey, inviteId }
}

export async function rememberSentEmailInvite(
  identity: Identity,
  invite: SentEmailInviteMeta,
): Promise<boolean> {
  const local = readLocalSentMetadata(identity.pubkey)
  const staged = {
    ...mergeSentMetadata(local, {
      version: 1,
      updatedAt: Date.now(),
      invites: [invite],
    }),
    version: 1 as const,
    updatedAt: Date.now(),
  }
  writeJson(`${SENT_STORAGE_PREFIX}${identity.pubkey}`, staged)

  const remote = await fetchSentEmailInviteMetadata(identity).catch(() => null)
  const merged = mergeSentMetadata(remote ?? emptySentMetadata(), staged)
  const next = { ...merged, version: 1 as const, updatedAt: Date.now() }
  writeJson(`${SENT_STORAGE_PREFIX}${identity.pubkey}`, next)

  try {
    await publishSentEmailInviteMetadata(identity, next)
    return true
  } catch {
    return false
  }
}

export async function fetchEmailInviteEvent(
  link: EmailInviteLink,
): Promise<Event> {
  const events = await pool.querySync(
    [...RELAYS],
    { ids: [link.eventId], kinds: [MIZMO_KIND], limit: 5 },
    { maxWait: QUERY_WAIT },
  )
  const event = events.find((candidate) => candidate.id === link.eventId)

  if (!event) {
    throw new Error(
      "We couldn't find this invitation yet. Try again in a moment.",
    )
  }

  if (
    event.kind !== MIZMO_KIND ||
    tagValue(event, 't') !== EMAIL_INVITE_TAG ||
    !inviteIdFromEvent(event) ||
    !tagValue(event, 'p')
  ) {
    throw new Error("This link isn't a valid miZmo invitation.")
  }

  return event
}

export async function decryptEmailInvite(
  event: Event,
  secretKey: Uint8Array,
): Promise<{
  id: string
  invitePubkey: string
  inviter: string
  ask: string
  deadline: number | null
}> {
  const id = inviteIdFromEvent(event)
  const invitePubkey = tagValue(event, 'p')

  if (!id || !invitePubkey) {
    throw new Error('This invitation is incomplete.')
  }

  const conversationKey = nip44.getConversationKey(secretKey, event.pubkey)
  const plaintext = nip44.decrypt(event.content, conversationKey)
  const payload = JSON.parse(plaintext) as Partial<MizmoPayload>

  if (typeof payload.ask !== 'string' || !payload.ask.trim()) {
    throw new Error("This invitation doesn't include an ask.")
  }

  return {
    id,
    invitePubkey,
    inviter: event.pubkey,
    ask: payload.ask,
    deadline: deadlineFromEvent(event),
  }
}

export async function fetchSentEmailInvites(
  identity: Identity,
): Promise<
  Array<{
    id: string
    eventId: string
    invitePubkey: string
    ask: string
    deadline: number | null
    createdAt: number
  }>
> {
  const events = await pool.querySync(
    [...RELAYS],
    {
      kinds: [MIZMO_KIND],
      authors: [identity.pubkey],
      '#t': [EMAIL_INVITE_TAG],
      limit: 300,
    },
    { maxWait: QUERY_WAIT },
  )
  const seen = new Set<string>()
  const invites: Array<{
    id: string
    eventId: string
    invitePubkey: string
    ask: string
    deadline: number | null
    createdAt: number
  }> = []

  for (const event of events) {
    if (seen.has(event.id)) continue
    seen.add(event.id)

    const invitePubkey = tagValue(event, 'p')
    const id = inviteIdFromEvent(event)

    if (!invitePubkey || !id) continue

    try {
      const conversationKey = nip44.getConversationKey(
        identity.secretKey,
        invitePubkey,
      )
      const plaintext = nip44.decrypt(event.content, conversationKey)
      const payload = JSON.parse(plaintext) as Partial<MizmoPayload>

      if (typeof payload.ask !== 'string' || !payload.ask.trim()) continue

      invites.push({
        id,
        eventId: event.id,
        invitePubkey,
        ask: payload.ask,
        deadline: deadlineFromEvent(event),
        createdAt: event.created_at * 1000,
      })
    } catch {
      continue
    }
  }

  return invites.sort((a, b) => b.createdAt - a.createdAt)
}

export function readStoredReceivedEmailInvites(
  pubkey: string,
): ReceivedEmailInvite[] {
  return readLocalReceivedMetadata(pubkey).invites
}

export async function syncReceivedEmailInvites(
  identity: Identity,
  incoming: ReceivedEmailInvite[] = [],
): Promise<{
  invites: ReceivedEmailInvite[]
  synced: boolean
  error: boolean
}> {
  const local = readLocalReceivedMetadata(identity.pubkey)
  let remote: ReceivedEmailInviteMetadata | null = null
  let remoteError = false

  try {
    remote = await fetchReceivedEmailInviteMetadata(identity)
  } catch {
    remoteError = true
  }

  const remoteIds = new Set(remote?.invites.map((invite) => invite.eventId))
  const hasNewInvite = incoming.some(
    (invite) => !remoteIds.has(invite.eventId),
  )
  const merged = mergeReceivedMetadata(
    remote ?? emptyReceivedMetadata(),
    mergeReceivedMetadata(local, {
      version: 1,
      updatedAt: hasNewInvite ? Date.now() : local.updatedAt,
      invites: incoming,
    }),
  )
  const shouldPublish =
    hasNewInvite ||
    (!remote && merged.invites.length > 0) ||
    Boolean(remote && local.updatedAt > remote.updatedAt)
  const next = {
    ...merged,
    version: 1 as const,
    updatedAt: shouldPublish
      ? Math.max(Date.now(), merged.updatedAt)
      : merged.updatedAt,
  }
  writeJson(`${RECEIVED_STORAGE_PREFIX}${identity.pubkey}`, next)

  if (!shouldPublish) {
    return { invites: next.invites, synced: true, error: remoteError }
  }

  try {
    await publishReceivedEmailInviteMetadata(identity, next)
    return { invites: next.invites, synced: true, error: false }
  } catch {
    return { invites: next.invites, synced: false, error: remoteError }
  }
}

export async function fetchSentEmailInviteMetadataForDisplay(
  identity: Identity,
): Promise<SentEmailInviteMeta[]> {
  const local = readLocalSentMetadata(identity.pubkey)
  let remote: SentEmailInviteMetadata | null = null

  try {
    remote = await fetchSentEmailInviteMetadata(identity)
  } catch {
    return local.invites
  }

  const merged = mergeSentMetadata(
    remote ?? emptySentMetadata(),
    local,
  )
  const shouldPublish = !remote || local.updatedAt > remote.updatedAt
  const next = {
    ...merged,
    version: 1 as const,
    updatedAt: shouldPublish
      ? Math.max(Date.now(), merged.updatedAt)
      : merged.updatedAt,
  }
  writeJson(`${SENT_STORAGE_PREFIX}${identity.pubkey}`, next)

  if (shouldPublish && next.invites.length > 0) {
    publishSentEmailInviteMetadata(identity, next).catch(() => undefined)
  }

  return next.invites
}

export async function fetchEmailInviteClaimEvents(
  identity: Identity,
): Promise<Event[]> {
  return pool.querySync(
    [...RELAYS],
    {
      kinds: [MIZMO_KIND],
      '#p': [identity.pubkey],
      '#t': [EMAIL_INVITE_CLAIM_TAG],
      limit: 300,
    },
    { maxWait: QUERY_WAIT },
  )
}

export function decodeEmailInviteClaim(
  event: Event,
  identity: Identity,
  invitePubkeys: ReadonlyMap<string, string>,
): EmailInviteClaim | null {
  const inviteId = tagValue(event, 'invite')
  const inviteEventId = tagValue(event, 'e')

  if (!inviteId || !inviteEventId) return null

  try {
    const conversationKey = nip44.getConversationKey(
      identity.secretKey,
      event.pubkey,
    )
    const plaintext = nip44.decrypt(event.content, conversationKey)
    const payload = JSON.parse(plaintext) as Record<string, unknown>
    const inviteSecret = payload.inviteSecret
    const acceptedAt = payload.acceptedAt
    const expectedPubkey = invitePubkeys.get(inviteId)

    if (
      typeof inviteSecret !== 'string' ||
      !expectedPubkey ||
      typeof acceptedAt !== 'number' ||
      getPublicKey(hexToBytes(inviteSecret)) !== expectedPubkey
    ) {
      return null
    }

    return {
      inviteId,
      eventId: inviteEventId,
      recipient: event.pubkey,
      acceptedAt,
    }
  } catch {
    return null
  }
}

async function publishEmailInviteClaim(
  identity: Identity,
  event: Event,
  secretKey: Uint8Array,
): Promise<void> {
  const inviteId = inviteIdFromEvent(event)

  if (!inviteId) throw new Error('This invitation is incomplete.')

  const latest = await latestEvent({
    kinds: [MIZMO_KIND],
    authors: [identity.pubkey],
    '#d': [`mizmo.me/email-invite-claim/${inviteId}`],
    limit: 5,
  })
  const conversationKey = nip44.getConversationKey(
    identity.secretKey,
    event.pubkey,
  )
  const claim = finalizeEvent(
    {
      kind: MIZMO_KIND,
      created_at: nextCreatedAt(latest?.created_at),
      tags: [
        ['d', `mizmo.me/email-invite-claim/${inviteId}`],
        ['t', EMAIL_INVITE_CLAIM_TAG],
        ['p', event.pubkey],
        ['e', event.id],
        ['invite', inviteId],
        ['client', 'mizmo.me'],
      ],
      content: nip44.encrypt(
        JSON.stringify({
          version: 1,
          inviteId,
          inviteSecret: bytesToHex(secretKey),
          acceptedAt: Date.now(),
        }),
        conversationKey,
      ),
    },
    identity.secretKey,
  )

  await publishEvent(
    claim,
    'The ask was received, but the sender could not be notified.',
  )
}

export async function acceptEmailInvite(
  identity: Identity,
  link: EmailInviteLink,
): Promise<AcceptedEmailInvite> {
  const event = await fetchEmailInviteEvent(link)
  const decrypted = await decryptEmailInvite(event, link.secretKey)

  if (decrypted.inviter === identity.pubkey) {
    throw new Error('This is your own invitation.')
  }

  const invite: ReceivedEmailInvite = {
    id: decrypted.id,
    eventId: event.id,
    inviter: decrypted.inviter,
    ask: decrypted.ask,
    deadline: decrypted.deadline,
    createdAt: event.created_at * 1000,
    receivedAt: Date.now(),
  }

  const sync = syncReceivedEmailInvites(identity, [invite])
  const contact = updateContacts(identity, decrypted.inviter, 'add')
    .then(() => true)
    .catch(() => false)
  const claim = publishEmailInviteClaim(identity, event, link.secretKey)
    .then(() => true)
    .catch(() => false)
  const [metadataSynced, contactAdded, claimPublished] = await Promise.all([
    sync.then((result) => result.synced),
    contact,
    claim,
  ])

  return {
    invite,
    contactAdded,
    claimPublished,
    metadataSynced,
  }
}
