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
   `POST /api/login`, `POST /api/link` and `POST /api/users` answer with
   `{ user, token, key }` — the website is signed in by the cookie and ignores the
   token; the package keeps it.
2. `/api/*` answers cross-origin preflights with `Access-Control-Allow-Origin: *`.
   The wildcard is safe only while no endpoint trusts a credential the browser
   attaches by itself: `SameSite=Lax` stops `lo_session` travelling cross-site, and
   a wildcard origin makes a credentialed response unreadable anyway. Adding
   `Access-Control-Allow-Credentials: true` would undo both.

## The link key signs both frames in

The phone view is `lo.gcc3.com` in an iframe, and an iframe cannot be handed a
token by its parent — there is no API surface between the two, and the site is on
a different origin. What crosses that gap is the account's **link key**, the same
one a shared `?k=` link carries.

[src/webui/webui.ts](src/webui/webui.ts) asks for a username and password. `POST /api/login`
answers with a `token` and a `key`, and the two are spent on the two frames:

- the **key** opens the iframe at `https://lo.gcc3.com/?k=<key>`, where the site's
  own `AuthProvider` trades it through `POST /api/link` and strips it back out of
  the address bar;
- the **token** stays out here, as the `Authorization: Bearer` on every read that
  feeds the glasses (see the table at the end).

The iframe cannot hold the session in a cookie. `lo_session` is `SameSite=Lax`,
and a Lax cookie is neither stored nor sent from a cross-site frame — which the
site is, embedded under an Even Hub origin. The sign-in itself still looks like it
worked, because the answer to `POST /api/link` names the user and the site renders
from that; every request after it then comes back `Please sign in`.

So the site keeps the `token` from that answer and presents it as
`Authorization: Bearer`, exactly as this package does — and it does so
everywhere, not only when embedded. `lo_session` is **gone**: one credential to
hold right rather than two, and no endpoint whose answer depends on which of them
happened to arrive. Nothing a browser attaches by itself authenticates anything
any more, which also takes CSRF off the table.

That is the change in `../lo`. `src/api.js` holds the token and attaches the
header; `src/ui/AuthImage` covers the one thing that used to need the cookie —
`<img src="/api/images/…">`, a request a tag makes for itself with nowhere to put
a header — by fetching the bytes with the header and handing the tag an object
URL. The server keeps `/api/images` behind the session; no endpoint was opened up.

The cost is worth stating: a token in `localStorage` is readable by any script
injected into the page, where an `httpOnly` cookie was not. Sessions last 30 days
(`sessionAgeMs`), so that is how long a stolen one is good for.

## The key is withdrawn a minute later

A link key does not expire and carries full account authority, so it is not left
lying in a frame's URL once it has been spent. Sixty seconds after each sign-in —
long enough for the WebView to have made its `POST /api/link` on a slow phone
tether — the outer frame calls `DELETE /api/me/link` on its own token and the key
is gone. Signing out burns it early, before `POST /api/logout` invalidates the
token the withdrawal is spent on.

Withdrawing a key signs nobody out. `setLinkKey(user.id, null)` clears the key
alone; both sessions it opened outlive it, and the next `POST /api/login` mints a
fresh one in its place.

Nothing is stored between launches, so every cold start asks for the password.
That is forced rather than chosen: `linkKeyFor` is reachable only from
`/api/login`, `/api/link` and `/api/users`, so **no endpoint mints a key from a
bearer token**. A stored token could restore the glasses but never the WebView,
and an app half signed in is worse than one that asks.

## Endpoints used

| Purpose | Endpoint | When |
| --- | --- | --- |
| Sign in | `POST /api/login` | Once, at launch |
| Withdraw the spent link key | `DELETE /api/me/link` | A minute after sign-in |
| Sign out | `POST /api/logout` | Once |
| Place, weather, available components | `GET /api/local?lat&lon&lang` | Every new fix |
| Posts within reach | `GET /api/posts?lat&lon&lang` | Every new fix |
| Publish our fix, get everyone else's | `PUT /api/position` | Every minute |
| The newswire | `GET /api/nearby?lat&lon&lang` | First time that card is looked at |
| What is on | `GET /api/events?lat&lon&lang` | First time that card is looked at |
| Search trends | `GET /api/trends?lat&lon&lang` | First time that card is looked at |
| Warnings in force | `GET /api/warnings?lat&lon` | First time that card is looked at |
| Save a mark | `POST /api/marks?lang=` | On a tap |
| Publish a post | `POST /api/posts?lang=` | On a hold |

Every one of these is an endpoint the website already calls. There is nothing on
the server that exists only for this package.

That was not true before. This client used to make a single `POST /api/dashboard`
— a read added for it, which took a fix in the body and answered with the place,
the weather, the components, the regional feeds, the posts and the live people all
at once, on the reasoning that glasses on a phone tether cannot afford seven round
trips. The endpoint is still there and still answers; this package simply no
longer calls it.

What changed is that the glasses now draw one card at a time rather than a
dashboard. A dashboard has to have every tile filled before it can be shown, so
one round trip for all of it was the right trade. A sequence of cards does not:
the reader is looking at exactly one, and the news, the events and the trends are
three upstream lookups apiece that most sessions never scroll far enough to
need. So the reads are split the way the website splits them, the four regional
ones are made the first time their card comes into view, and each is re-asked only
when the fix has moved far enough to make it a different question — one decimal
place for the three city-wide feeds, two for the warnings, which Yahoo answers per
municipality. Those roundings are the website's own (see `lo/src/components/*Card`).

The cost is one extra round trip the first time a card is looked at. The saving is
every lookup for every card that never is, and a launch that reaches first paint
after two reads instead of seven.

`PUT /api/position` is doing double duty here exactly as it does on the website:
it files where we are and answers with who else is about, so presence costs the
minute loop nothing beyond what it was already spending.

## Caveat

Sessions live in an in-memory `Map`, so restarting the server signs everyone out
and this package has nothing stored to recover with — the modal comes back.

The withdrawal is best-effort in one direction: the sixty-second timer is lost if
the WebView is closed before it fires, leaving that key standing until the next
sign-in schedules another withdrawal of it. A key not yet withdrawn is a password
equivalent — it does not expire, it carries full account authority, and it is the
same key every other `?k=` link for this account is built from — so treat any XSS
in this WebView, or in `lo.gcc3.com` while the key is still in its URL, as account
compromise.

Because the key is minted per sign-in and withdrawn after it, signing in here
**invalidates any `?k=` link previously handed out for the same account**. That is
the documented meaning of `DELETE /api/me/link`, but it is worth knowing that this
package now exercises it on every launch.
