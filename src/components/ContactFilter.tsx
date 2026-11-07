import { useMemo } from 'react'
import { displayName } from '../lib/format'
import type { ProfileData } from '../lib/nostr'
import { Avatar } from './Avatar'
import { Icon } from './Icon'

type ContactFilterProps = {
  contacts: string[]
  profiles: Record<string, ProfileData | null>
  selected: string | null
  loading: boolean
  onSelect: (pubkey: string | null) => void
  onManage: () => void
}

export function ContactFilter({
  contacts,
  profiles,
  selected,
  loading,
  onSelect,
  onManage,
}: ContactFilterProps) {
  const sorted = useMemo(
    () =>
      [...contacts].sort((a, b) =>
        contactName(a, profiles).localeCompare(contactName(b, profiles)),
      ),
    [contacts, profiles],
  )

  return (
    <section aria-label="Filter by contact" className="contact-filter">
      <div className="contact-filter-head">
        <span className="settings-label">Contacts</span>
        <button className="text-button" onClick={onManage} type="button">
          Manage
          <Icon name="arrow-right" size={14} />
        </button>
      </div>
      <div className="contact-chips">
        <button
          aria-pressed={selected === null}
          className={`contact-chip ${selected === null ? 'is-active' : ''}`}
          onClick={() => onSelect(null)}
          type="button"
        >
          All
        </button>
        {sorted.map((pubkey) => {
          const profile = profiles[pubkey]
          const name = contactName(pubkey, profiles)

          return (
            <button
              aria-pressed={selected === pubkey}
              className={`contact-chip ${
                selected === pubkey ? 'is-active' : ''
              }`}
              key={pubkey}
              onClick={() => onSelect(pubkey)}
              title={name}
              type="button"
            >
              <Avatar
                name={name}
                picture={profile?.picture}
                pubkey={pubkey}
                size={22}
              />
              <span>{name}</span>
            </button>
          )
        })}
        {!loading && sorted.length === 0 && (
          <span className="contact-filter-empty">No contacts yet.</span>
        )}
      </div>
    </section>
  )
}

function contactName(
  pubkey: string,
  profiles: Record<string, ProfileData | null>,
): string {
  const profile = profiles[pubkey]
  return displayName(pubkey, profile?.displayName || profile?.name)
}
