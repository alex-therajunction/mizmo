import { Link } from 'react-router-dom'
import { nip19 } from 'nostr-tools'
import type { MizmoRecord } from '../hooks/useMizmos'
import { formatDeadline, formatEventTime, shortenId } from '../lib/format'
import { Icon } from './Icon'

type MizmoCardProps = {
  record: MizmoRecord
  now: number
}

export function MizmoCard({ record, now }: MizmoCardProps) {
  const overdue = record.deadline !== null && record.deadline < now
  const counterpartyNpub = nip19.npubEncode(record.counterparty)
  const directionLabel = record.direction === 'in' ? 'From' : 'To'

  return (
    <article
      className={`mizmo-card mizmo-card--${record.direction} ${
        overdue ? 'is-overdue' : ''
      }`}
    >
      <div className="mizmo-card-top">
        <span className="mizmo-direction">
          <Icon name={record.direction === 'in' ? 'inbox' : 'outbox'} size={16} />
          {record.direction === 'in' ? 'mi' : 'mo'}
        </span>
        <span className="mizmo-date">
          {formatEventTime(record.event.created_at * 1000)}
        </span>
      </div>

      {record.decryptionError ? (
        <p className="mizmo-ask mizmo-ask--error">
          This mizmo could not be decrypted on this device.
        </p>
      ) : (
        <p className="mizmo-ask">{record.ask}</p>
      )}

      <div className="mizmo-card-bottom">
        <Link
          className="mizmo-contact"
          title={record.counterparty}
          to={`/${counterpartyNpub}`}
        >
          <span>{directionLabel}</span> {shortenId(record.counterparty)}
        </Link>
        {record.deadline !== null ? (
          <span className={`deadline-pill ${overdue ? 'is-overdue' : ''}`}>
            <Icon name="clock" size={14} />
            {overdue ? 'Overdue · ' : ''}
            {formatDeadline(record.deadline)}
          </span>
        ) : (
          <span className="deadline-pill deadline-pill--quiet">No deadline</span>
        )}
      </div>
    </article>
  )
}
