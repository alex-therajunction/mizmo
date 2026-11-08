import { Navigate, useNavigate } from 'react-router-dom'
import { AuthPanel } from '../components/AuthPanel'
import { Icon } from '../components/Icon'
import { useIdentity } from '../context/useIdentity'

export function HomePage() {
  const { identity } = useIdentity()
  const navigate = useNavigate()

  if (identity) {
    return <Navigate replace to={`/${identity.npub}`} />
  }

  return (
    <div className="page home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">Simple reminders for the things you need</p>
          <h1>
            A tiny nudge for a <em>big ask.</em>
          </h1>
          <p className="hero-lede">
            Ask someone to do something, add a deadline if it matters, and keep
            everything in one place. Just enter their email — we&apos;ll take
            care of the rest.
          </p>

          <div className="hero-proof">
            <span>
              <Icon name="mail" size={17} /> Send by email
            </span>
            <span>
              <Icon name="link" size={17} /> Private by default
            </span>
            <span>
              <Icon name="spark" size={17} /> No app to install
            </span>
          </div>
        </div>

        <div className="hero-card-wrap">
          <div className="hero-orbit hero-orbit--one" aria-hidden="true" />
          <div className="hero-orbit hero-orbit--two" aria-hidden="true" />
          <section className="onboarding-card">
            <div className="onboarding-heading">
              <span className="card-number">01</span>
              <div>
                <h2>Start in seconds</h2>
                <p>Create an account or use your recovery code.</p>
              </div>
            </div>
            <AuthPanel
              onAuthenticated={(next) => navigate(`/${next.npub}`)}
            />
          </section>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="section-heading">
          <p className="eyebrow">One simple place</p>
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
              Write what you need, pick a contact or enter their email, and add
              a deadline if it matters. They&apos;ll get it right away.
            </p>
            <span className="how-note">sent · your asks</span>
          </article>
          <article className="how-card how-card--mi">
            <span className="how-icon">
              <Icon name="inbox" size={24} />
            </span>
            <p className="how-kicker">mi</p>
            <h3>Keep it visible</h3>
            <p>
              New asks land in <strong>mi</strong>. Switch to{' '}
              <strong>mo</strong> to see everything you&apos;ve sent.
            </p>
            <span className="how-note">inbox · asks for you</span>
          </article>
          <article className="how-card how-card--deadline">
            <span className="how-icon">
              <Icon name="clock" size={24} />
            </span>
            <p className="how-kicker">follow up</p>
            <h3>Stay on top of it</h3>
            <p>
              See what&apos;s due, archive what&apos;s done, and keep your inbox
              calm. Everything stays in one simple place.
            </p>
            <span className="how-note">deadlines · archive</span>
          </article>
        </div>
      </section>

      <ExampleStrip />
    </div>
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
          <span>From John</span>
          <span className="deadline-pill">
            <Icon name="clock" size={14} /> Thu, 5:00 PM
          </span>
        </div>
      </div>
      <div className="example-copy">
        <p className="eyebrow">What it looks like</p>
        <h2>Somewhere between a message and a promise.</h2>
        <p>
          An ask is a friendly reminder for something you need. It stays clear,
          easy to find again, and there when you need it.
        </p>
      </div>
    </section>
  )
}
