# miZmo.me

A client-side Nostr app for sending a **mizmo** — an encrypted reminder for an
ask, with an optional deadline.

- Visiting `/<npub>` lets a signed-in user send a mizmo to that contact.
- Visiting your own `/<npub>` opens **mi** (received) and **mo** (sent).
- Keys are generated or imported in the browser and stored in `localStorage`.
- There is no application server. The browser connects directly to Nostr relays.

## Stack

React 19, TypeScript, Vite, React Router, `nostr-tools`, and pnpm.

## Development

```bash
pnpm install
pnpm dev
```

Production checks:

```bash
pnpm lint
pnpm build
pnpm preview
```

## Nostr data format

Each mizmo is an event:

- **Kind:** `30078` (NIP-78 application data)
- **Encryption:** NIP-44, using the sender's private key and recipient's public key
- **Content:** `{ "version": 1, "ask": "..." }`
- **Tags:** `d` (unique event id), `p` (recipient), `t=mizmo`, optional
  `deadline` (Unix seconds), and `client=mizmo.me`

The inbox subscribes with `#p=<own pubkey>` and `#t=mizmo`. The outbox subscribes
with `authors=<own pubkey>` and `#t=mizmo`. Asks are encrypted, while the
recipient and deadline tags are public relay metadata.

## Keys and privacy

The private key is stored as plain text in the browser's local storage so the app
can sign and decrypt after a reload. Anyone with access to the browser profile
can use it. Users can reveal/copy their `nsec` in settings, but signing out or
clearing site data without a backup loses the identity.

Default relays are configured in `src/lib/nostr.ts`.

## Static hosting

The app uses clean BrowserRouter URLs. `public/_redirects` covers Netlify and
`vercel.json` covers Vercel.

### GitHub Pages

Pushes to `main` deploy through the workflow in
`.github/workflows/deploy-pages.yml`. The production build includes:

- `CNAME` set to `mizmo.me`
- `.nojekyll` so Vite's asset directory is served as-is
- `404.html` as the app shell fallback, allowing direct links such as
  `https://mizmo.me/<npub>` to load the client-side route

Set the repository's Pages custom domain to `mizmo.me` if GitHub does not pick
it up from the deployed `CNAME` file. DNS should point the apex domain at
GitHub Pages with `A` records for `185.199.108.153`, `185.199.109.153`,
`185.199.110.153`, and `185.199.111.153`; `www` can use a `CNAME` to the
repository's `github.io` host.
