import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { nip19 } from 'nostr-tools'
import { AuthPanel } from '../components/AuthPanel'
import { Avatar } from '../components/Avatar'
import { ContactFilter } from '../components/ContactFilter'
import { ContactManager } from '../components/ContactManager'
import { EmailInviteModal } from '../components/EmailInviteModal'
import { Icon } from '../components/Icon'
import { MizmoCard } from '../components/MizmoCard'
import { MoComposer } from '../components/MoComposer'
import { useIdentity } from '../context/useIdentity'
import { useContacts } from '../hooks/useContacts'
import { useEmailContacts } from '../hooks/useEmailContacts'
import {
  useReceivedEmailInvites,
  useSentEmailInvites,
} from '../hooks/useEmailInvites'
import { useMizmoRankings } from '../hooks/useMizmoRankings'
import { useMizmos, type MizmoRecord } from '../hooks/useMizmos'
import { useProfile } from '../hooks/useProfile'
import { useProfiles } from '../hooks/useProfiles'
import type { SentEmailInvite } from '../lib/emailInvites'
import type { Identity } from '../lib/identity'
import {
  copyText,
  displayName,
  formatDeadline,
  formatEventTime,
  toDateTimeLocalValue,
} from '../lib/format'
import {
  adjacentVisibleId,
  moveIdTo,
  orderRecords,
  swapIds,
} from '../lib/rankings'
import {
  normalizeNostrId,
  sendMizmo,
  updateContacts,
  type ProfileData,
} from '../lib/nostr'

type ProfilePageProps = {
  onOpenAuth: () => void
}

export function ProfilePage({ onOpenAuth }: ProfilePageProps) {
  const { id } = useParams()
  const { identity } = useIdentity()
  const pubkey = useMemo(() => (id ? normalizeNostrId(id) : null), [id])
  const { profile, loading } = useProfile(pubkey)

  if (!pubkey) return <InvalidAddress />

  const isOwn = identity?.pubkey === pubkey

  return (
    <div className="page profile-page">
      <ProfileHero
        isOwn={isOwn}
        loading={loading}
        profile={profile}
        pubkey={pubkey}
      />

      {isOwn && identity ? (
        <OwnDashboard identity={identity} />
      ) : identity ? (
        <SendMizmo
          identity={identity}
          profile={profile}
          pubkey={pubkey}
        />
      ) : (
        <section className="signed-out-contact">
          <div className="auth-callout-copy">
            <p className="eyebrow">Your move</p>
            <h2>Sign in to send an ask.</h2>
            <p>
              Create your account or use your recovery code. Then write what
              you need and send it.
            </p>
            <button
              className="text-button"
              onClick={onOpenAuth}
              type="button"
            >
              Prefer a pop-up? Sign in here
              <Icon name="arrow-right" size={16} />
            </button>
          </div>
          <div className="onboarding-card onboarding-card--contact">
            <AuthPanel />
          </div>
        </section>
      )}
    </div>
  )
}

function ProfileHero({
  pubkey,
  profile,
  isOwn,
  loading,
}: {
  pubkey: string
  profile: ProfileData | null
  isOwn: boolean
  loading: boolean
}) {
  const [copied, setCopied] = useState(false)
  const name = displayName(pubkey, profile?.displayName || profile?.name)
  const handle =
    profile?.nip05 || (isOwn ? 'Your personal miZmo page' : 'miZmo member')
  const hasName = Boolean(profile?.displayName || profile?.name)
  const address = `${window.location.origin}/${nip19.npubEncode(pubkey)}`

  const copyAddress = async () => {
    try {
      await copyText(address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="profile-hero">
      <div className="profile-main">
        <Avatar
          name={name}
          picture={profile?.picture}
          pubkey={pubkey}
          size={82}
        />
        <div className="profile-copy">
          <p className="eyebrow">
            {isOwn ? 'Your mi & mo' : 'Send an ask to'}
          </p>
          <h1>
            {isOwn
              ? hasName
                ? name
                : 'Your mi & mo'
              : loading
                ? 'Finding…'
                : name}
          </h1>
          <p className="profile-handle">
            {handle}
          </p>
          {profile?.about && !isOwn && (
            <p className="profile-about">{profile.about}</p>
          )}
        </div>
      </div>

      <button
        className="button button--secondary button--small"
        onClick={copyAddress}
        type="button"
      >
        <Icon name={copied ? 'check' : 'copy'} size={16} />
        {copied ? 'Link copied' : isOwn ? 'Copy my link' : 'Copy link'}
      </button>
    </section>
  )
}

function SendMizmo({
  identity,
  pubkey,
  profile,
}: {
  identity: Identity
  pubkey: string
  profile: ProfileData | null
}) {
  const [ask, setAsk] = useState('')
  const [deadline, setDeadline] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [emailOpen, setEmailOpen] = useState(false)
  const [sent, setSent] = useState<{
    deadline: number | null
    contactError: boolean
  } | null>(null)
  const { profiles: ownProfiles } = useProfiles([identity.pubkey])
  const recipientName = displayName(
    pubkey,
    profile?.displayName || profile?.name,
  )
  const ownProfile = ownProfiles[identity.pubkey]
  const inviterName = displayName(
    identity.pubkey,
    ownProfile?.displayName || ownProfile?.name,
  )
  const [minimumDeadline] = useState(() => toDateTimeLocalValue(new Date()))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const cleanAsk = ask.trim()

    if (!cleanAsk) {
      setError('Write the ask first.')
      return
    }

    const deadlineTime = deadline ? new Date(deadline).getTime() : null

    if (deadlineTime !== null && deadlineTime <= Date.now()) {
      setError('Choose a deadline in the future, or leave it empty.')
      return
    }

    setSending(true)

    try {
      await sendMizmo(
        {
          recipient: pubkey,
          ask: cleanAsk,
          deadline: deadlineTime,
        },
        identity.secretKey,
      )
      setSent({ deadline: deadlineTime, contactError: false })
      setAsk('')
      setDeadline('')

      updateContacts(identity, pubkey, 'add').catch(() => {
        setSent((current) =>
          current ? { ...current, contactError: true } : current,
        )
      })
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Your ask could not be sent. Try again.',
      )
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <section className="sent-card">
        <span className="sent-icon">
          <Icon name="check" size={28} />
        </span>
        <p className="eyebrow">Ask sent</p>
        <h2>It&apos;s waiting in {recipientName}&apos;s inbox.</h2>
        <p>
          Your ask was sent privately.
          {sent.deadline
            ? ` The deadline is ${formatDeadline(sent.deadline)}.`
            : ' No deadline was set.'}
        </p>
        {sent.contactError && (
          <p className="form-error sent-warning">
            Your ask was sent, but this person could not be added to your
            contacts.
          </p>
        )}
        <div className="button-row button-row--center">
          <button
            className="button button--primary"
            onClick={() => setSent(null)}
            type="button"
          >
            Send another
            <Icon name="arrow-right" />
          </button>
          <Link className="button button--ghost" to={`/${identity.npub}`}>
            Go to my inbox
          </Link>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="compose-card">
      <div className="compose-heading">
        <div>
          <p className="eyebrow">Write your ask</p>
          <h2>What do you need?</h2>
        </div>
        <span className="encrypted-badge">
          <Icon name="lock" size={14} /> private
        </span>
      </div>

      <form className="compose-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">
            Your ask <span className="field-optional">required</span>
          </span>
          <textarea
            className="text-area"
            maxLength={2000}
            onChange={(event) => setAsk(event.target.value)}
            placeholder={`Ask ${recipientName} for something specific…`}
            rows={6}
            value={ask}
          />
          <span className="field-count">{ask.length} / 2000</span>
        </label>

        <label className="field">
          <span className="field-label">
            Deadline <span className="field-optional">optional</span>
          </span>
          <input
            className="text-input"
            min={minimumDeadline}
            onChange={(event) => setDeadline(event.target.value)}
            type="datetime-local"
            value={deadline}
          />
          <span className="field-hint">
            Leave it empty if there&apos;s no particular rush.
          </span>
        </label>

        {error && <p className="form-error">{error}</p>}

        <button
          className="button button--primary button--wide"
          disabled={sending}
          type="submit"
        >
          <Icon name="send" />
          {sending ? 'Sending…' : `Send to ${recipientName}`}
        </button>
      </form>

        <p className="compose-note">
          Only you and {recipientName} can see this ask.
        </p>

        <div className="compose-email-action">
          <div>
            <strong>Prefer email?</strong>
            <span>Send this ask to their inbox instead.</span>
          </div>
          <button
            className="button button--secondary button--small"
            onClick={() => setEmailOpen(true)}
            type="button"
          >
            <Icon name="mail" size={16} />
            Invite by email
          </button>
        </div>
      </section>

      {emailOpen && (
        <EmailInviteModal
          identity={identity}
          initialAsk={ask}
          initialDeadline={deadline}
          inviterName={inviterName}
          onClose={() => setEmailOpen(false)}
        />
      )}
    </>
  )
}

function OwnDashboard({ identity }: { identity: Identity }) {
  const { inbox: nostrInbox, outbox, status } = useMizmos(identity)
  const {
    invites: receivedEmailInvites,
    status: receivedEmailStatus,
    error: receivedEmailError,
  } = useReceivedEmailInvites(identity)
  const {
    invites: sentEmailInvites,
    status: sentEmailStatus,
    error: sentEmailError,
    refresh: refreshSentEmailInvites,
  } = useSentEmailInvites(identity)
  const {
    contacts,
    status: contactsStatus,
    error: contactsError,
    addContact,
    removeContact,
  } = useContacts(identity)
  const {
    contacts: emailContacts,
    addEmailContact,
    removeEmailContact,
  } = useEmailContacts(identity)
  const {
    rankings,
    loaded: rankingsLoaded,
    status: rankingStatus,
    error: rankingError,
    setInboxOrder,
    setOutboxOrder,
    archiveRecord,
    restoreRecord,
  } = useMizmoRankings(identity)
  const [tab, setTab] = useState<'mi' | 'mo' | 'archive'>('mi')
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const [contactsOpen, setContactsOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const inbox = useMemo(() => {
    const emailRecords = receivedEmailInvites.map(
      (invite): MizmoRecord => ({
        id: invite.eventId,
        createdAt: Math.floor(invite.createdAt / 1000),
        direction: 'in',
        counterparty: invite.inviter,
        ask: invite.ask,
        deadline: invite.deadline,
        decryptionError: false,
        source: 'email',
      }),
    )

    return [...nostrInbox, ...emailRecords].sort(
      (a, b) => b.createdAt - a.createdAt,
    )
  }, [nostrInbox, receivedEmailInvites])
  const profilePubkeys = useMemo(
    () =>
      Array.from(
        new Set([
          identity.pubkey,
          ...contacts,
          ...inbox.map((record) => record.counterparty),
          ...outbox.map((record) => record.counterparty),
          ...sentEmailInvites
            .map((invite) => invite.recipient)
            .filter((pubkey): pubkey is string => Boolean(pubkey)),
        ]),
      ).sort(),
    [contacts, identity.pubkey, inbox, outbox, sentEmailInvites],
  )
  const { profiles, loading: profilesLoading } = useProfiles(profilePubkeys)
  const ownProfile = profiles[identity.pubkey]
  const inviterName = displayName(
    identity.pubkey,
    ownProfile?.displayName || ownProfile?.name,
  )
  const archivedIds = useMemo(
    () => new Set(rankings.archived),
    [rankings.archived],
  )

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const activeContact =
    selectedContact && contacts.includes(selectedContact)
      ? selectedContact
      : null

  const orderedInbox = useMemo(
    () =>
      orderRecords(
        inbox,
        rankings.inbox,
        (record) => record.id,
        (record) => record.createdAt,
      ),
    [inbox, rankings.inbox],
  )
  const filteredInbox = useMemo(
    () =>
      orderedInbox.filter(
        (record) =>
          !archivedIds.has(record.id) &&
          (!activeContact || record.counterparty === activeContact),
      ),
    [activeContact, archivedIds, orderedInbox],
  )
  const outboxGroups = useMemo(() => {
    const visible = outbox.filter(
      (record) =>
        !archivedIds.has(record.id) &&
        (!activeContact || record.counterparty === activeContact),
    )
    const grouped = new Map<string, MizmoRecord[]>()

    for (const record of visible) {
      const records = grouped.get(record.counterparty) ?? []
      records.push(record)
      grouped.set(record.counterparty, records)
    }

    return Array.from(grouped, ([pubkey, records]) => ({
      pubkey,
      records: orderRecords(
        records,
        rankings.outbox[pubkey] ?? [],
        (record) => record.id,
        (record) => record.createdAt,
      ),
    })).sort(
      (a, b) =>
        Math.max(...b.records.map((record) => record.createdAt)) -
        Math.max(...a.records.map((record) => record.createdAt)),
    )
  }, [activeContact, archivedIds, outbox, rankings])
  const visibleSentEmailInvites = useMemo(
    () =>
      sentEmailInvites.filter((invite) => !archivedIds.has(invite.eventId)),
    [archivedIds, sentEmailInvites],
  )
  const archivedSentEmailInvites = useMemo(
    () =>
      sentEmailInvites.filter((invite) => archivedIds.has(invite.eventId)),
    [archivedIds, sentEmailInvites],
  )
  const archivedMizmos = useMemo(
    () =>
      orderRecords(
        [...inbox, ...outbox].filter((record) =>
          archivedIds.has(record.id),
        ),
        rankings.archived,
        (record) => record.id,
        (record) => record.createdAt,
      ),
    [archivedIds, inbox, outbox, rankings.archived],
  )
  const archivedCount =
    archivedMizmos.length + archivedSentEmailInvites.length
  const inboxIds = orderedInbox
    .filter((record) => !archivedIds.has(record.id))
    .map((record) => record.id)
  const visibleInboxIds = filteredInbox.map((record) => record.id)
  const visibleEmailInviteCount = activeContact
    ? 0
    : visibleSentEmailInvites.length
  const visibleOutboxCount =
    outboxGroups.reduce(
      (count, group) => count + group.records.length,
      0,
    ) + visibleEmailInviteCount
  const selectedName = activeContact
    ? displayName(
        activeContact,
        profiles[activeContact]?.displayName ||
          profiles[activeContact]?.name,
      )
    : null

  const handleRemoveContact = async (pubkey: string) => {
    await removeContact(pubkey)
    if (selectedContact === pubkey) setSelectedContact(null)
  }

  const moveInbox = (id: string, offset: -1 | 1) => {
    const neighbor = adjacentVisibleId(visibleInboxIds, id, offset)

    if (neighbor) setInboxOrder(swapIds(inboxIds, id, neighbor))
  }

  const dropInbox = (sourceId: string, targetId: string) => {
    if (!inboxIds.includes(sourceId)) return
    setInboxOrder(moveIdTo(inboxIds, sourceId, targetId))
  }

  const rankingMessage =
    rankingStatus === 'loading'
      ? 'Loading your saved lists…'
      : rankingStatus === 'saving'
        ? 'Saving…'
        : rankingStatus === 'saved'
          ? 'Saved'
          : ''

  return (
    <>
      <section className="dashboard-card">
        <div className="dashboard-top">
          <div className="tabs" role="tablist" aria-label="Your asks">
            <button
              aria-selected={tab === 'mi'}
              className={tab === 'mi' ? 'is-active' : ''}
              onClick={() => setTab('mi')}
              role="tab"
              type="button"
            >
              <span className="tab-word">mi</span>
              <span className="tab-detail">inbox</span>
              <span className="tab-count">{filteredInbox.length}</span>
            </button>
            <button
              aria-selected={tab === 'mo'}
              className={tab === 'mo' ? 'is-active' : ''}
              onClick={() => setTab('mo')}
              role="tab"
              type="button"
            >
              <span className="tab-word">mo</span>
              <span className="tab-detail">outbox</span>
              <span className="tab-count">{visibleOutboxCount}</span>
            </button>
            <button
              aria-selected={tab === 'archive'}
              className={tab === 'archive' ? 'is-active' : ''}
              onClick={() => setTab('archive')}
              role="tab"
              type="button"
            >
              <span className="tab-word tab-word--archive">archive</span>
              <span className="tab-detail">saved</span>
              <span className="tab-count">{archivedCount}</span>
            </button>
          </div>
          <span className="sync-status">
            <span
              className={`status-dot ${
                status === 'syncing' ? 'is-pulsing' : ''
              }`}
            />
            {status === 'syncing'
              ? 'Updating…'
              : status === 'live'
                ? 'Up to date'
                : 'Ready'}
          </span>
        </div>

        {tab === 'mo' && (
          <MoComposer
            contacts={contacts}
            emailContacts={emailContacts}
            identity={identity}
            inviterName={inviterName}
            onAddContact={addContact}
            onAddEmailContact={addEmailContact}
            onEmailSent={refreshSentEmailInvites}
            profiles={profiles}
          />
        )}

        {tab !== 'archive' && (
          <ContactFilter
            contacts={contacts}
            loading={contactsStatus === 'loading' || profilesLoading}
            onManage={() => setContactsOpen(true)}
            onSelect={setSelectedContact}
            profiles={profiles}
            selected={activeContact}
          />
        )}

        {rankingMessage && (
          <p aria-live="polite" className="rank-sync-note">
            {rankingMessage}
          </p>
        )}
        {rankingError && <p className="form-error">{rankingError}</p>}
        {contactsError && <p className="form-error">{contactsError}</p>}
        {receivedEmailError && (
          <p className="form-error">{receivedEmailError}</p>
        )}
        {tab === 'mo' && sentEmailError && (
          <p className="form-error">{sentEmailError}</p>
        )}

        <div className="mizmo-list" role="tabpanel">
          {tab === 'mi' ? (
            filteredInbox.length > 0 ? (
              filteredInbox.map((record, index) => (
                <MizmoCard
                  key={record.id}
                  now={now}
                  onArchive={() => archiveRecord(record.id)}
                  profile={profiles[record.counterparty]}
                  record={record}
                  reorder={
                    rankingsLoaded
                      ? {
                          canMoveUp: index > 0,
                          canMoveDown: index < filteredInbox.length - 1,
                          onMoveUp: () => moveInbox(record.id, -1),
                          onMoveDown: () => moveInbox(record.id, 1),
                          onDropOn: dropInbox,
                        }
                      : undefined
                  }
                />
              ))
            ) : (
              <EmptyBox
                contactName={selectedName}
                syncing={
                  status === 'syncing' || receivedEmailStatus === 'loading'
                }
                tab={tab}
              />
            )
          ) : tab === 'mo' ? (
            outboxGroups.length > 0 || visibleEmailInviteCount > 0 ? (
            <>
              {!activeContact && visibleSentEmailInvites.length > 0 && (
                <EmailInvitesOutbox
                  invites={visibleSentEmailInvites}
                  now={now}
                  onArchive={archiveRecord}
                  onRefresh={refreshSentEmailInvites}
                  profiles={profiles}
                />
              )}
              {outboxGroups.map((group) => {
              const ids = group.records.map((record) => record.id)
              const profile = profiles[group.pubkey]
              const name = displayName(
                group.pubkey,
                profile?.displayName || profile?.name,
              )

              return (
                <section className="outbox-group" key={group.pubkey}>
                  <div className="outbox-group-head">
                    <Link to={`/${nip19.npubEncode(group.pubkey)}`}>
                      <Avatar
                        name={name}
                        picture={profile?.picture}
                        pubkey={group.pubkey}
                        size={38}
                      />
                      <span>
                        <strong>{name}</strong>
                        <small>
                          {group.records.length}{' '}
                          {group.records.length === 1 ? 'ask' : 'asks'}
                        </small>
                      </span>
                    </Link>
                  </div>
                  <div className="outbox-group-list">
                    {group.records.map((record, index) => (
                      <MizmoCard
                        key={record.id}
                        now={now}
                        onArchive={() => archiveRecord(record.id)}
                        profile={profile}
                        record={record}
                        reorder={
                          rankingsLoaded
                            ? {
                                canMoveUp: index > 0,
                                canMoveDown: index < ids.length - 1,
                                onMoveUp: () => {
                                  const neighbor = adjacentVisibleId(
                                    ids,
                                    record.id,
                                    -1,
                                  )
                                  if (neighbor) {
                                    setOutboxOrder(
                                      group.pubkey,
                                      swapIds(ids, record.id, neighbor),
                                    )
                                  }
                                },
                                onMoveDown: () => {
                                  const neighbor = adjacentVisibleId(
                                    ids,
                                    record.id,
                                    1,
                                  )
                                  if (neighbor) {
                                    setOutboxOrder(
                                      group.pubkey,
                                      swapIds(ids, record.id, neighbor),
                                    )
                                  }
                                },
                                onDropOn: (sourceId, targetId) => {
                                  if (!ids.includes(sourceId)) return
                                  setOutboxOrder(
                                    group.pubkey,
                                    moveIdTo(ids, sourceId, targetId),
                                  )
                                },
                              }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </section>
              )
              })}
            </>
            ) : (
            <EmptyBox
              contactName={selectedName}
              syncing={
                status === 'syncing' ||
                receivedEmailStatus === 'loading' ||
                sentEmailStatus === 'loading'
              }
              tab={tab}
            />
            )
          ) : archivedCount > 0 ? (
            <>
              {archivedMizmos.map((record) => (
                <MizmoCard
                  key={record.id}
                  now={now}
                  onRestore={() => restoreRecord(record.id)}
                  profile={profiles[record.counterparty]}
                  record={record}
                />
              ))}
              {archivedSentEmailInvites.length > 0 && (
                <EmailInvitesOutbox
                  invites={archivedSentEmailInvites}
                  now={now}
                  onRestore={restoreRecord}
                  profiles={profiles}
                  title="Archived email invitations"
                />
              )}
            </>
          ) : (
            <EmptyBox
              contactName={null}
              syncing={
                status === 'syncing' ||
                receivedEmailStatus === 'loading' ||
                sentEmailStatus === 'loading'
              }
              tab={tab}
            />
          )}
        </div>
      </section>

      {contactsOpen && (
        <ContactManager
          contacts={contacts}
          emailContacts={emailContacts}
          identity={identity}
          loadError={contactsError}
          onAdd={addContact}
          onAddEmail={addEmailContact}
          onClose={() => setContactsOpen(false)}
          onRemove={handleRemoveContact}
          onRemoveEmail={removeEmailContact}
          status={contactsStatus}
        />
      )}
    </>
  )
}

function EmailInvitesOutbox({
  invites,
  now,
  profiles,
  onArchive,
  onRestore,
  onRefresh,
  title = 'Email invitations',
}: {
  invites: SentEmailInvite[]
  now: number
  profiles: Record<string, ProfileData | null>
  onArchive?: (eventId: string) => void
  onRestore?: (eventId: string) => void
  onRefresh?: () => void
  title?: string
}) {
  const pending = invites.filter((invite) => invite.status === 'pending').length

  return (
    <section className="outbox-group email-outbox-group">
      <div className="outbox-group-head email-outbox-head">
        <span className="email-outbox-heading">
          <span className="email-outbox-icon">
            <Icon name="mail" size={18} />
          </span>
          <span>
            <strong>{title}</strong>
            <small>
              {invites.length} {invites.length === 1 ? 'invite' : 'invites'}
              {pending > 0
                ? ` · ${pending} waiting to open`
                : ' · all accepted'}
            </small>
          </span>
        </span>
        {onRefresh && (
          <button
            className="text-button email-outbox-refresh"
            onClick={onRefresh}
            type="button"
          >
            <Icon name="restore" size={14} />
            Check status
          </button>
        )}
      </div>
      <div className="outbox-group-list">
        {invites.map((invite) => (
          <EmailInviteCard
            invite={invite}
            key={invite.id}
            now={now}
            onArchive={onArchive}
            onRestore={onRestore}
            profiles={profiles}
          />
        ))}
      </div>
    </section>
  )
}

function EmailInviteCard({
  invite,
  now,
  profiles,
  onArchive,
  onRestore,
}: {
  invite: SentEmailInvite
  now: number
  profiles: Record<string, ProfileData | null>
  onArchive?: (eventId: string) => void
  onRestore?: (eventId: string) => void
}) {
  const accepted = invite.status === 'accepted' && invite.recipient !== null
  const recipientProfile = invite.recipient
    ? profiles[invite.recipient]
    : null
  const recipientName = invite.recipient
    ? displayName(
        invite.recipient,
        recipientProfile?.displayName || recipientProfile?.name,
      )
    : invite.email || 'Invitation link'
  const overdue = invite.deadline !== null && invite.deadline < now
  const acceptedNote =
    invite.acceptedAt !== null
      ? `Request received · ${formatEventTime(invite.acceptedAt)}`
      : 'Request received'

  return (
    <article
      className={`mizmo-card mizmo-card--out mizmo-card--email-invite ${
        overdue ? 'is-overdue' : ''
      }`}
    >
      <div className="mizmo-card-top">
        <span className="mizmo-direction">
          <Icon name="outbox" size={16} /> mo
          <span className="mizmo-source">
            <Icon name="mail" size={12} /> email
          </span>
        </span>
        <div className="mizmo-card-meta">
          <span className="mizmo-date">
            {formatEventTime(invite.createdAt)}
          </span>
          <span
            className={`email-invite-status ${
              accepted ? 'is-accepted' : 'is-pending'
            }`}
          >
            {accepted ? 'accepted' : 'waiting to open'}
          </span>
        </div>
      </div>

      <p className="mizmo-ask">{invite.ask}</p>

      <p
        className={`email-invite-state ${
          accepted ? 'is-accepted' : 'is-pending'
        }`}
      >
        <Icon name={accepted ? 'check' : 'clock'} size={13} />
        {accepted
          ? `${acceptedNote} · the ask is in their inbox.`
          : 'Waiting for them to open the link and accept.'}
      </p>

      <div className="mizmo-card-bottom">
        {accepted && invite.recipient ? (
          <Link
            className="mizmo-contact"
            to={`/${nip19.npubEncode(invite.recipient)}`}
          >
            <Avatar
              name={recipientName}
              picture={recipientProfile?.picture}
              pubkey={invite.recipient}
              size={22}
            />
            <span className="mizmo-contact-text">
              <span className="mizmo-contact-label">Accepted by</span>
              <span className="mizmo-contact-name">{recipientName}</span>
            </span>
          </Link>
        ) : (
          <span className="mizmo-contact email-invite-recipient">
            <span className="email-outbox-icon email-outbox-icon--small">
              <Icon name="mail" size={13} />
            </span>
            <span className="mizmo-contact-text">
              <span className="mizmo-contact-label">To</span>
              <span className="mizmo-contact-name">{recipientName}</span>
            </span>
          </span>
        )}
        <div className="mizmo-card-actions">
          {invite.deadline !== null ? (
            <span className={`deadline-pill ${overdue ? 'is-overdue' : ''}`}>
              <Icon name="clock" size={14} />
              {overdue ? 'Overdue · ' : ''}
              {formatDeadline(invite.deadline)}
            </span>
          ) : (
            <span className="deadline-pill deadline-pill--quiet">
              No deadline
            </span>
          )}
          {onArchive && (
            <button
              className="card-action"
              onClick={() => onArchive(invite.eventId)}
              type="button"
            >
              <Icon name="archive" size={14} />
              Archive
            </button>
          )}
          {onRestore && (
            <button
              className="card-action"
              onClick={() => onRestore(invite.eventId)}
              type="button"
            >
              <Icon name="restore" size={14} />
              Restore
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function EmptyBox({
  tab,
  syncing,
  contactName,
}: {
  tab: 'mi' | 'mo' | 'archive'
  syncing: boolean
  contactName: string | null
}) {
  const filtered = Boolean(contactName)

  return (
    <div className="empty-box">
      <span className="empty-glyph">
        <Icon
          name={tab === 'mi' ? 'inbox' : tab === 'mo' ? 'outbox' : 'archive'}
          size={30}
        />
      </span>
      <h3>
        {syncing
          ? 'Checking for updates…'
          : tab === 'archive'
            ? 'Nothing archived.'
          : filtered
            ? `Nothing for ${contactName} in ${tab}.`
            : `Your ${tab} is clear.`}
      </h3>
      <p>
        {tab === 'archive'
          ? 'Archived asks will stay here until you restore them.'
          : filtered
          ? 'Choose All to see the rest of your list.'
          : tab === 'mi'
            ? 'Asks people send you will appear here.'
            : 'Asks you send other people will appear here.'}
      </p>
    </div>
  )
}

function InvalidAddress() {
  return (
    <div className="page empty-page">
      <span className="empty-glyph">
        <Icon name="link" size={30} />
      </span>
      <p className="eyebrow">Link not found</p>
      <h1>This link doesn&apos;t work.</h1>
      <p>Ask for a fresh link and try again.</p>
      <Link className="button button--primary" to="/">
        Back home
        <Icon name="arrow-right" />
      </Link>
    </div>
  )
}
