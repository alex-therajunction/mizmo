import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools'
import {
  decrypt as decryptNip49,
  encrypt as encryptNip49,
} from 'nostr-tools/nip49'
import { bytesToHex, hexToBytes } from './encoding'

const STORAGE_KEY = 'mizmo.identity.v1'
export const MIN_BACKUP_PASSWORD_LENGTH = 8

type StoredIdentity = {
  version: 1
  secretKey: string
  createdAt: number
}

export type Identity = {
  pubkey: string
  npub: string
  nsec: string
  secretKey: Uint8Array
  createdAt: number
}

function identityFromSecretKey(
  secretKey: Uint8Array,
  createdAt = Date.now(),
): Identity {
  const pubkey = getPublicKey(secretKey)

  return {
    pubkey,
    npub: nip19.npubEncode(pubkey),
    nsec: nip19.nsecEncode(secretKey),
    secretKey,
    createdAt,
  }
}

export function createIdentity(): Identity {
  return identityFromSecretKey(generateSecretKey())
}

export function importIdentity(value: string): Identity {
  const clean = value.trim().replace(/^nostr:/i, '')

  if (!clean) {
    throw new Error('Paste your recovery code to continue.')
  }

  try {
    const normalized = clean.toLowerCase()

    if (normalized.startsWith('nsec1')) {
      const decoded = nip19.decode(normalized)

      if (decoded.type !== 'nsec') {
        throw new Error("That recovery code isn't valid.")
      }

      return identityFromSecretKey(decoded.data)
    }

    return identityFromSecretKey(hexToBytes(clean))
  } catch (error) {
    if (error instanceof Error && error.message.includes('64 characters')) {
      throw error
    }

    throw new Error('That code could not be read. Check it and try again.')
  }
}

export function encryptIdentityBackup(
  identity: Identity,
  password: string,
): string {
  return encryptNip49(identity.secretKey, password)
}

export function decryptIdentityBackup(
  value: string,
  password: string,
): Identity {
  const clean = value.replace(/\s+/g, '').toLowerCase()

  if (!nip19.NostrTypeGuard.isNcryptsec(clean)) {
    throw new Error('Paste a valid backup code to continue.')
  }

  try {
    return identityFromSecretKey(decryptNip49(clean, password))
  } catch {
    throw new Error(
      "That password didn't work, or the backup code is damaged.",
    )
  }
}

export function loadIdentity(): Identity | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) return null

    const stored = JSON.parse(raw) as Partial<StoredIdentity>

    if (
      stored.version !== 1 ||
      typeof stored.secretKey !== 'string' ||
      typeof stored.createdAt !== 'number'
    ) {
      return null
    }

    return identityFromSecretKey(
      hexToBytes(stored.secretKey),
      stored.createdAt,
    )
  } catch {
    return null
  }
}

export function persistIdentity(identity: Identity): void {
  const stored: StoredIdentity = {
    version: 1,
    secretKey: bytesToHex(identity.secretKey),
    createdAt: identity.createdAt,
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

export function forgetIdentity(): void {
  window.localStorage.removeItem(STORAGE_KEY)
}
