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
): string {
  const importUrl = buildBackupImportUrl(ncryptsec)
  const subject = 'Your miZmo login link'
  const body = [
    'Your miZmo login link',
    '',
    'Open this link to sign in on another device:',
    importUrl,
    '',
    'You will need the password you chose when creating this link.',
    'The password is NOT included in this email, so keep it somewhere safe.',
    '',
    'If the link does not work, open:',
    buildImportPageUrl(),
    'and paste the backup code below.',
    '',
    'Backup code:',
    ncryptsec,
    '',
    'Anyone with this link and password can act as you. If you did not create this login link, delete this email.',
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
