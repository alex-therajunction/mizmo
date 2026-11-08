import { useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { nip19 } from 'nostr-tools'
import type { MizmoRecord } from '../hooks/useMizmos'
import {
  displayContactName,
  formatDeadline,
  formatEventTime,
} from '../lib/format'
import type { ProfileData } from '../lib/nostr'
import { Avatar } from './Avatar'
import { Icon } from './Icon'

type ReorderControls = {
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDropOn: (sourceId: string, targetId: string) => void
}

type MizmoCardProps = {
  record: MizmoRecord
  now: number
  profile?: ProfileData | null
  contactName?: string
  reorder?: ReorderControls
  onDone?: () => void
  onRestore?: () => void
  onDelete?: () => void
}

export function MizmoCard({
  record,
  now,
  profile,
  contactName: petname,
  reorder,
  onDone,
  onRestore,
  onDelete,
}: MizmoCardProps) {
  const [dragging, setDragging] = useState(false)
  const overdue = record.deadline !== null && record.deadline < now
  const counterpartyNpub = nip19.npubEncode(record.counterparty)
  const directionLabel = record.direction === 'in' ? 'From' : 'To'
  const contactName = displayContactName(
    record.counterparty,
    profile?.displayName || profile?.name,
    petname,
  )

  const handleDragStart = (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', record.id)
    setDragging(true)
  }

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (!reorder) return

    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/plain')

    if (sourceId && sourceId !== record.id) {
      reorder.onDropOn(sourceId, record.id)
    }
  }

  return (
    <article
      className={`mizmo-card mizmo-card--${record.direction} ${
        overdue ? 'is-overdue' : ''
      } ${dragging ? 'is-dragging' : ''}`}
      onDragOver={(event) => {
        if (reorder) event.preventDefault()
      }}
      onDrop={handleDrop}
    >
      <div className="mizmo-card-top">
        <span className="mizmo-direction">
          <Icon name={record.direction === 'in' ? 'inbox' : 'outbox'} size={16} />
          {record.direction === 'in' ? 'mi' : 'mo'}
          {record.source === 'email' && (
            <span className="mizmo-source">
              <Icon name="mail" size={12} /> email
            </span>
          )}
        </span>
        <div className="mizmo-card-meta">
          <span className="mizmo-date">
            {formatEventTime(record.createdAt * 1000)}
          </span>
          {reorder && (
            <span className="rank-controls">
              <button
                aria-label="Move up"
                className="rank-button"
                disabled={!reorder.canMoveUp}
                onClick={reorder.onMoveUp}
                type="button"
              >
                <Icon name="chevron-up" size={16} />
              </button>
              <button
                aria-label="Move down"
                className="rank-button"
                disabled={!reorder.canMoveDown}
                onClick={reorder.onMoveDown}
                type="button"
              >
                <Icon name="chevron-down" size={16} />
              </button>
              <span
                aria-hidden="true"
                className="rank-handle"
                draggable
                onDragEnd={() => setDragging(false)}
                onDragStart={handleDragStart}
                title="Drag to reorder"
              >
                <Icon name="grip" size={17} />
              </span>
            </span>
          )}
        </div>
      </div>

      {record.decryptionError ? (
        <p className="mizmo-ask mizmo-ask--error">
          This ask can&apos;t be opened on this device.
        </p>
      ) : (
        <p className="mizmo-ask">{record.ask}</p>
      )}

      <div className="mizmo-card-bottom">
        <Link
          className="mizmo-contact"
          to={`/${counterpartyNpub}`}
        >
          <Avatar
            name={contactName}
            picture={profile?.picture}
            pubkey={record.counterparty}
            size={22}
          />
          <span className="mizmo-contact-text">
            <span className="mizmo-contact-label">{directionLabel}</span>
            <span className="mizmo-contact-name">{contactName}</span>
          </span>
        </Link>
        <div className="mizmo-card-actions">
          {record.deadline !== null ? (
            <span className={`deadline-pill ${overdue ? 'is-overdue' : ''}`}>
              <Icon name="clock" size={14} />
              {overdue ? 'Overdue · ' : ''}
              {formatDeadline(record.deadline)}
            </span>
          ) : (
            <span className="deadline-pill deadline-pill--quiet">
              No deadline
            </span>
          )}
          {onDone && (
            <button
              className="card-action"
              onClick={onDone}
              type="button"
            >
              <Icon name="check" size={14} />
              Mark done
            </button>
          )}
          {onRestore && (
            <button
              className="card-action"
              onClick={onRestore}
              type="button"
            >
              <Icon name="restore" size={14} />
              Restore
            </button>
          )}
          {onDelete && (
            <button
              className="card-action card-action--danger"
              onClick={onDelete}
              type="button"
            >
              <Icon name="trash" size={14} />
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
