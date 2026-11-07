# miZmo.me

A client-side Nostr app for sending a **mizmo** — an encrypted reminder for an
ask, with an optional deadline.

- Visiting `/<npub>` lets a signed-in user send a mizmo to that contact.
- Visiting your own `/<npub>` opens **mi** (received) and **mo** (sent).
- Profiles use public Nostr metadata, including a name and a resized avatar
  embedded as a data URL.
- Contacts come from the signed-in user's NIP-02 contact list and can be added,
  removed, and used to filter both boxes.
- Inbox order and per-contact outbox order are private, synced app data.
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

## Profiles, contacts, and order

- **Profile:** kind `0` metadata with `name`, `display_name`, and optionally
  `picture`. Pictures are center-cropped and resized in the browser, then
  embedded as a data URL. Other metadata fields are preserved when editing.
- **Contacts:** NIP-02 kind `3` contact list. The app preserves existing `p`
  tags, relay hints, and petnames. Successful sends add new recipients.
- **Order:** kind `30078` app data with `d=mizmo.me/rankings`, encrypted
  NIP-44 to the user's own key. Its payload is
  `{ version: 1, updatedAt, inbox: string[], outbox: { [pubkey]: string[] } }`.
  The browser also keeps a local copy so ordering survives relay failures.

## Keys and privacy

The private key is stored as plain text in the browser's local storage so the app
can sign and decrypt after a reload. Anyone with access to the browser profile
can use it. Users can reveal/copy their `nsec` in settings, but signing out or
clearing site data without a backup loses the identity.

Profile metadata and contact-list events are public, as required by Nostr.
Mizmo asks and private ranking data are encrypted. Some relays may reject large
profile events; avatars are therefore resized before publishing.

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
