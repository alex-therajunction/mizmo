export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase()

  if (!/^[0-9a-f]{64}$/.test(clean)) {
    throw new Error('A private key must be 64 hexadecimal characters.')
  }

  return Uint8Array.from(
    clean.match(/.{2}/g) ?? [],
    (pair) => Number.parseInt(pair, 16),
  )
}
