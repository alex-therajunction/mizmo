import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthPanel } from '../components/AuthPanel'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { useIdentity } from '../context/useIdentity'
import { copyText, shortenId } from '../lib/format'
import { normalizeNostrId } from '../lib/nostr'

export function HomePage() {
  const { identity } = useIdentity()
  const navigate = useNavigate()

  return (
    <div className="page home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">
            {identity ? 'Your key is ready' : 'Nostr-native reminders'}
          </p>
          <h1>
            {identity ? (
              <>
                Your <em>mi</em> is ready.
              </>
            ) : (
              <>
                A tiny nudge for a <em>big ask.</em>
              </>
            )}
          </h1>
          <p className="hero-lede">
            {identity
              ? 'Share one address. Keep every ask you send and receive in two simple places.'
              : 'Send an ask with a deadline, privately over Nostr. No account, no app server, no follow-up email lost in the void.'}
          </p>

          <div className="hero-proof">
            <span>
              <Icon name="key" size={17} /> Keys stay local
            </span>
            <span>
              <Icon name="link" size={17} /> Encrypted over relays
            </span>
            <span>
              <Icon name="spark" size={17} /> No backend
            </span>
          </div>
        </div>

        <div className="hero-card-wrap">
          <div className="hero-orbit hero-orbit--one" aria-hidden="true" />
          <div className="hero-orbit hero-orbit--two" aria-hidden="true" />
          {identity ? (
            <SignedInCard />
          ) : (
            <section className="onboarding-card">
              <div className="onboarding-heading">
                <span className="card-number">01</span>
                <div>
                  <h2>Start with a key</h2>
                  <p>Create a fresh identity or bring your nsec.</p>
                </div>
              </div>
              <AuthPanel
                onAuthenticated={(next) => navigate(`/${next.npub}`)}
              />
            </section>
          )}
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="section-heading">
          <p className="eyebrow">One address, two sides</p>
          <h2>The ask goes out. The reminder comes back.</h2>
        </div>
        <div className="how-grid">
          <article className="how-card how-card--mo">
            <span className="how-icon">
              <Icon name="outbox" size={24} />
            </span>
            <p className="how-kicker">mo</p>
            <h3>Make your ask</h3>
            <p>
              Open someone&apos;s mizmo address, write what you need, and add a
              deadline if it matters. The ask is encrypted for them.
            </p>
            <span className="how-note">outbox · sent mizmos</span>
          </article>
          <article className="how-card how-card--mi">
            <span className="how-icon">
              <Icon name="inbox" size={24} />
            </span>
            <p className="how-kicker">mi</p>
            <h3>Keep it visible</h3>
            <p>
              Their open mizmos land in <strong>mi</strong>. Switch to{' '}
              <strong>mo</strong> to see every ask you&apos;ve sent.
            </p>
            <span className="how-note">inbox · received mizmos</span>
          </article>
          <article className="how-card how-card--deadline">
            <span className="how-icon">
              <Icon name="clock" size={24} />
            </span>
            <p className="how-kicker">deadline</p>
            <h3>No server needed</h3>
            <p>
              Your browser talks directly to public Nostr relays. Your private
              key never leaves local storage unless you export it.
            </p>
            <span className="how-note">client-side · relay-backed</span>
          </article>
        </div>
      </section>

      {!identity && <ExampleStrip />}
    </div>
  )
}

function SignedInCard() {
  const { identity } = useIdentity()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [lookup, setLookup] = useState('')
  const [lookupError, setLookupError] = useState('')

  if (!identity) return null

  const address = `${window.location.origin}/${identity.npub}`

  const copyAddress = async () => {
    try {
      await copyText(address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const handleLookup = (event: FormEvent) => {
    event.preventDefault()
    const pubkey = normalizeNostrId(lookup)

    if (!pubkey) {
      setLookupError('Enter a valid npub or hex public key.')
      return
    }

    setLookupError('')
    navigate(`/${pubkey}`)
  }

  return (
    <section className="signed-in-card">
      <div className="signed-in-head">
        <Avatar
          name={shortenId(identity.pubkey, 1, 1)}
          pubkey={identity.pubkey}
          size={58}
        />
        <div>
          <p className="settings-label">This is you</p>
          <p className="signed-in-id">{shortenId(identity.pubkey, 12, 8)}</p>
        </div>
        <span className="live-pill">
          <span className="status-dot" /> ready
        </span>
      </div>

      <div className="address-card">
        <span>Your mizmo address</span>
        <p>{address.replace(/^https?:\/\//, '')}</p>
        <button
          className="button button--secondary button--small"
          onClick={copyAddress}
          type="button"
        >
          <Icon name={copied ? 'check' : 'copy'} size={16} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <Link className="button button--primary button--wide" to={`/${identity.npub}`}>
        Open my mi / mo
        <Icon name="arrow-right" />
      </Link>

      <div className="lookup-block">
        <p className="settings-label">Or visit someone else</p>
        <form className="lookup-form" onSubmit={handleLookup}>
          <input
            aria-label="Nostr address"
            className="text-input text-input--mono"
            onChange={(event) => setLookup(event.target.value)}
            placeholder="npub1…"
            spellCheck={false}
            value={lookup}
          />
          <button aria-label="Open address" className="icon-button" type="submit">
            <Icon name="arrow-right" />
          </button>
        </form>
        {lookupError && <p className="form-error">{lookupError}</p>}
      </div>
    </section>
  )
}

function ExampleStrip() {
  return (
    <section className="example-section">
      <div className="example-card">
        <div className="example-topline">
          <span className="mizmo-direction">
            <Icon name="inbox" size={16} /> mi
          </span>
          <span className="mizmo-date">just now</span>
        </div>
        <p className="example-ask">
          “Could you look at the launch copy before Thursday?”
        </p>
        <div className="example-foot">
          <span>From npub1garden…</span>
          <span className="deadline-pill">
            <Icon name="clock" size={14} /> Thu, 5:00 PM
          </span>
        </div>
      </div>
      <div className="example-copy">
        <p className="eyebrow">A mizmo in the wild</p>
        <h2>Somewhere between a message and a promise.</h2>
        <p>
          A mizmo is a reminder for an ask. It is specific, time-aware, and
          easy to find again when you need it.
        </p>
      </div>
    </section>
  )
}
