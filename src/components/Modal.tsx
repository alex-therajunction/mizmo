import { useEffect, useId, type ReactNode } from 'react'
import { Icon } from './Icon'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  children: ReactNode
  wide?: boolean
}

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  wide = false,
}: ModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="presentation"
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={`modal-card ${wide ? 'modal-card--wide' : ''}`}
        role="dialog"
      >
        <button
          aria-label="Close"
          className="icon-button modal-close"
          onClick={onClose}
          type="button"
        >
          <Icon name="close" />
        </button>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 id={titleId}>{title}</h2>
        {children}
      </section>
    </div>
  )
}
