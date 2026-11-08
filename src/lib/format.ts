export function shortenId(id: string, start = 9, end = 7): string {
  if (id.length <= start + end + 1) return id
  return `${id.slice(0, start)}…${id.slice(-end)}`
}

export function formatDeadline(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

export function formatEventTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      new Date(timestamp).getFullYear() === new Date().getFullYear()
        ? undefined
        : 'numeric',
  }).format(new Date(timestamp))
}

export function toDateTimeLocalValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = value
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()
  document.execCommand('copy')
  textArea.remove()
}

export function displayName(
  _pubkey: string,
  profileName: string | undefined,
): string {
  return profileName?.trim() || 'Someone'
}
