# lo.gcc3.com integration

The Even package runs from an Even App WebView origin, so it cannot be sent the
website's `lo_session` cookie — `SameSite=Lax` keeps that cookie off cross-site
requests. It therefore holds the session token itself and presents it as
`Authorization: Bearer <token>`.

That is the only difference between this client and the website. There is no
separate API surface: the package calls the same endpoints the web app does.

The companion server (`../lo`) supports this with two things:

1. `currentSession` reads the token from the `lo_session` cookie *or* from an
   `Authorization: Bearer` header, so `requireSession` covers both clients.
   `POST /api/login` and `POST /api/users` answer with `{ user, token }` — the
   website is signed in by the cookie and ignores the token; the package keeps it.
2. `/api/*` answers cross-origin preflights with `Access-Control-Allow-Origin: *`.
   The wildcard is safe only while no endpoint trusts a credential the browser
   attaches by itself: `SameSite=Lax` stops `lo_session` travelling cross-site, and
   a wildcard origin makes a credentialed response unreadable anyway. Adding
   `Access-Control-Allow-Credentials: true` would undo both.

## Endpoints used

| Purpose | Endpoint |
| --- | --- |
| Sign in | `POST /api/login` |
| Restore a session | `GET /api/session` |
| Sign out | `POST /api/logout` |
| Everything for one location | `POST /api/dashboard?lang=` |
| Save a mark | `POST /api/marks?lang=` |
| Publish a post | `POST /api/posts?lang=` |

`POST /api/dashboard` is the one endpoint added for this client. It takes a fix in
the body and answers with the place, weather, available components, regional
nearby/events/trends, posts within reach and live people — the seven separate
reads the website makes as its cards arrive, collapsed into the one round trip
glasses on a phone tether can afford. It files the fix it is given, the same trade
`PUT /api/position` makes. The website is free to adopt it.

## Caveat

Sessions live in an in-memory `Map`, so restarting the server signs everyone out.
The bearer token is stored by [src/storage.ts](src/storage.ts) in the Even Hub
native store and `localStorage`, where — unlike the website's `httpOnly` cookie —
page scripts can read it. It carries full account authority, so treat any XSS in
this WebView as account compromise.
