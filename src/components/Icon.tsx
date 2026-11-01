import type { SVGProps } from 'react'

export type IconName =
  | 'arrow-right'
  | 'check'
  | 'clock'
  | 'close'
  | 'copy'
  | 'inbox'
  | 'key'
  | 'link'
  | 'logout'
  | 'outbox'
  | 'send'
  | 'settings'
  | 'spark'

const paths: Record<IconName, React.ReactNode> = {
  'arrow-right': <path d="M5 12h14m-5-5 5 5-5 5" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  copy: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 5.5h16v13H4z" />
      <path d="M4 13h4l1.5 3h5L16 13h4" />
    </>
  ),
  key: (
    <>
      <circle cx="8.5" cy="15.5" r="3.5" />
      <path d="m11 13 8-8m-3 3 2 2m-5-5 2 2" />
    </>
  ),
  link: (
    <>
      <path d="m10 13.5 4-4" />
      <path d="M7.5 16.5 6 18a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0" transform="translate(3 0)" />
      <path d="m16.5 7.5 1.5-1.5a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0" transform="translate(-3 0)" />
    </>
  ),
  logout: (
    <>
      <path d="M10 5H5v14h5" />
      <path d="M14 8l4 4-4 4m4-4H9" />
    </>
  ),
  outbox: (
    <>
      <path d="M4 5.5h16v13H4z" />
      <path d="M4 13h4l1.5 3h5L16 13h4" />
      <path d="m12 5.5 0-2m-2 2 2-2 2 2" />
    </>
  ),
  send: <path d="m21 3-7.5 18-3-8.5L2 9.5 21 3Z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 13.5a7.5 7.5 0 0 0 0-3l2-1.5-2-3.5-2.5 1a7 7 0 0 0-2.6-1.5L13.5 2h-3l-.4 3a7 7 0 0 0-2.6 1.5l-2.5-1-2 3.5L5 10.5a7.5 7.5 0 0 0 0 3L3 15l2 3.5 2.5-1a7 7 0 0 0 2.6 1.5l.4 3h3l.4-3a7 7 0 0 0 2.6-1.5l2.5 1 2-3.5-2-1.5Z" />
    </>
  ),
  spark: (
    <>
      <path d="M12 2c.5 5.5 4.5 9.5 10 10-5.5.5-9.5 4.5-10 10-.5-5.5-4.5-9.5-10-10 5.5-.5 9.5-4.5 10-10Z" />
    </>
  ),
}

export function Icon({
  name,
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      {...props}
    >
      {paths[name]}
    </svg>
  )
}
