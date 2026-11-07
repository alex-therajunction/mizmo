import { useState, type CSSProperties } from 'react'

type AvatarProps = {
  pubkey: string
  name?: string
  picture?: string
  size?: number
  className?: string
}

function hueFor(pubkey: string): number {
  let hash = 0

  for (let index = 0; index < pubkey.length; index += 1) {
    hash = pubkey.charCodeAt(index) + ((hash << 5) - hash)
  }

  return Math.abs(hash) % 360
}

export function Avatar({
  pubkey,
  name,
  picture,
  size = 44,
  className = '',
}: AvatarProps) {
  const [failedPicture, setFailedPicture] = useState<string | null>(null)
  const hue = hueFor(pubkey)
  const initial = (name?.trim()?.[0] || 'm').toUpperCase()
  const showPicture = Boolean(picture && failedPicture !== picture)
  const style = {
    '--avatar-a': `hsl(${hue} 68% 68%)`,
    '--avatar-b': `hsl(${(hue + 75) % 360} 64% 48%)`,
    width: size,
    height: size,
  } as CSSProperties

  return (
    <span
      aria-hidden="true"
      className={`avatar ${className}`}
      style={style}
    >
      {showPicture && picture ? (
        <img
          alt=""
          loading="lazy"
          onError={() => setFailedPicture(picture)}
          referrerPolicy="no-referrer"
          src={picture}
        />
      ) : (
        <span>{initial}</span>
      )}
    </span>
  )
}
