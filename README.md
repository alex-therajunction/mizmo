# miZmo.me

Ask someone to do something, add a deadline if it matters, and keep track of it
in one calm place. Just enter their email — miZmo takes care of the rest.

## What you can do

- Open your personal miZmo link to see **mi** (asks people send you) and **mo**
  (asks you send).
- Add a contact by email or with their miZmo link.
- Name contacts after they join, and have accepted email invitees added
  to your contacts automatically.
- Write an ask in **mo**, choose a contact or enter an email address, and add a
  deadline if you need one.
- Mark asks as done to archive them, restore them from the **archive** tab, or
  delete them from your lists.
- Sign in on another device with your recovery code or an email login link.
- Save a backup of your account so you can get back in later.

Visitors see a simple sign-up page first. Once signed in, visiting the home
page opens your inbox.

The sections below are for developers. They describe how the app works under
the hood.

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
  tags, relay hints, and petnames. Successful sends add new recipients, and
  accepted email invitations add the new contact automatically. Petnames are
  saved in the NIP-02 `p` tag so they sync across devices.
- **Order and archive:** kind `30078` app data with `d=mizmo.me/rankings`, encrypted
  NIP-44 to the user's own key. Its payload is
  `{ version: 1, updatedAt, inbox: string[], outbox: { [pubkey]: string[] }, archived: string[], deleted: string[] }`.
  The browser also keeps a local copy so ordering and archives survive relay
  failures. Deleted ids stay hidden even if the original relay event is still
  available.

## Keys and privacy

The private key is stored as plain text in the browser's local storage so the app
can sign and decrypt after a reload. Anyone with access to the browser profile
can use it. Users can reveal/copy their `nsec` in settings, but signing out or
clearing site data without a backup loses the identity.

The **Email login link** action encrypts the key with NIP-49 in the browser and
opens the default mail client with an import link. The user chooses a password
once; it is not included in the email, so store it separately. Opening the link
at `/import` prompts for the password, decrypts the key locally, and imports it.
The encrypted key is carried in the URL fragment so it is not sent to the static
host.

Profile metadata and contact-list events are public, as required by Nostr.
Mizmo asks and private ranking data are encrypted. Some relays may reject large
profile events; avatars are therefore resized before publishing.

Default relays are configured in `src/lib/nostr.ts`.

## Email invitations

The compose page for a Nostr contact also offers **Invite by email** for a new
person. The browser creates a one-time Nostr key, publishes a signed kind
`30078` invitation encrypted to that key, and opens a `mailto:` draft. The
email link carries the invite event ID and one-time secret in the URL fragment,
so neither the ask nor the secret is sent to the static host. Recipient email
addresses are kept locally with the inviter's contacts, and sent-invite
metadata is also stored in the inviter's self-encrypted app data.

Opening `/join#invite=…&key=…` creates or imports a key, verifies and decrypts
the invitation, adds the inviter through NIP-02, stores the mizmo in
self-encrypted received-invite data, and publishes a recipient-signed claim.
The claim moves the invitation from **awaiting sign-up** to **accepted** in the
sender's `mo` view. Invitation links are capability links: they do not expire,
and anyone who receives a forwarded link can import the mizmo.

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
