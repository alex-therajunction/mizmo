const IMPORT_PATH = 'import'

function buildImportPageUrl(): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`

  return new URL(`${base}${IMPORT_PATH}`, window.location.origin).toString()
}

export function buildBackupImportUrl(ncryptsec: string): string {
  const url = new URL(buildImportPageUrl())
  url.hash = new URLSearchParams({ ncryptsec }).toString()
  return url.toString()
}

export function buildBackupEmailUrl(
  ncryptsec: string,
  npub: string,
): string {
  const importUrl = buildBackupImportUrl(ncryptsec)
  const subject = 'miZmo encrypted key backup'
  const body = [
    'Encrypted miZmo key backup',
    '',
    'Open this link to import the key:',
    importUrl,
    '',
    'You will need the password chosen when this backup was created.',
    'The password is NOT included in this email, so keep it somewhere safe.',
    '',
    'If the link does not work, open:',
    buildImportPageUrl(),
    'and paste the encrypted key below.',
    '',
    'Encrypted key (for manual import):',
    ncryptsec,
    '',
    `miZmo address: ${npub}`,
    '',
    'Anyone with this backup and password can act as you. If you did not create this backup, delete this email.',
  ].join('\n')

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function readEncryptedKeyFromHash(hash: string): string {
  const clean = hash.replace(/^#/, '').trim()

  if (!clean) return ''

  const params = new URLSearchParams(clean)
  const value = params.get('ncryptsec') || params.get('key') || ''

  if (value) return value.trim()

  return clean.startsWith('ncryptsec1') ? clean : ''
}
