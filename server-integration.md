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
alone; both sessions it opened outlive it, and the next mint puts a fresh one in
its place.

## Coming back without the password

The password is asked for once. `LoApi.setToken` writes the token to
`localStorage` under `token`, and a launch that finds one there makes a single
request before it asks the reader anything:

```
POST /api/me/link   Authorization: Bearer <stored token>   →  { user, key }
```

That endpoint is the piece of this that had to be added to `../lo`. `linkKeyFor`
used to be reachable only from `/api/login`, `/api/link` and `/api/users` — no
endpoint minted a key from a bearer token — so a stored token could restore the
glasses but never the WebView, and an app half signed in is worse than one that
asks. `POST /api/me/link` mints on the token the caller already holds, beside the
`DELETE` that withdraws. It discloses nothing new: a live session and a link key
are each the password's equal, and this lets the holder of the first spend it on
the second.

Both halves come back in one answer because the launch is showing a blank screen
until it has them: the `user` names the account for the glasses, the `key` opens
the frame, and the sixty-second withdrawal goes back on the clock exactly as it
does after a password.

Every failure ends at the sign-in screen — there is no half of this worth keeping.
Where lo actually answered (a token it no longer knows, a session aged out, a
server restarted) the stored token is erased with it; where the request never
arrived at all, it is left written down, because a launch that could not reach lo
has learned nothing about the session and could not have signed anybody in either.

The trade is the one `../lo` already makes for its own copy: a token in
`localStorage` is readable by any script injected into the page, where nothing
stored at all was not, and sessions last 30 days (`sessionAgeMs`).

## Signing out happens in the frame

The sign-out button belongs to lo's own account sheet, inside the WebView. The
two frames hold two separate sessions against the same account — two origins, two
tokens, no cookie between them — so nothing about lo signing itself out reaches
the outer frame by itself, and left alone it would go on feeding the glasses from
a signed-out phone and would still hold a written-down token to come back on.

So `AuthProvider.logout` in `../lo` posts a line to its host on the way out, after
`POST /api/logout` has been answered:

```js
window.parent.postMessage({ source: "lo", type: "logout" }, "*");
```

`"*"` because the host is an Even Hub WebView whose origin lo cannot name in
advance, and the message carries no token, no key and no name — only the news.
[src/webui/webui.ts](src/webui/webui.ts) is stricter in the direction that
matters: it acts only on a message whose `origin` is `https://lo.gcc3.com`, whose
`source` is the frame this page put there, and whose payload is that exact pair.

What it then does is take the screen down first and run the errands after — the
frame is blanked and the sign-in screen goes up before `DELETE /api/me/link` and
`POST /api/logout` are waited on, because by then the site is drawing its own
sign-in screen behind the frame and the reader is not meant to know there are two
screens here. `setToken("")` finishes it by taking the token out of storage, so
the next launch asks rather than letting itself back into the account the reader
has just left.

## Endpoints used

| Purpose | Endpoint | When |
| --- | --- | --- |
| Sign in | `POST /api/login` | Once, the first time this package is opened |
| Take the stored session up again | `POST /api/me/link` | At every launch after that |
| Withdraw the spent link key | `DELETE /api/me/link` | A minute after either of them |
| Sign out | `POST /api/logout` | When the frame says it has signed out |
| The place, its weather, its components, the newswire, what is on, the trends, the posts within reach and who else is about | `POST /api/dashboard?lang=` | Every new fix |
| Warnings in force | `GET /api/warnings?lat&lon` | Every new fix |
| Publish our fix, get everyone else's and the unread count | `PUT /api/position` | Every minute |
| The inbox | `GET /api/messages` | While the second page or anything under it is up, at most once a minute |
| Save a mark | `POST /api/marks?lang=` | On a hold, where the reader answered *mark*, with what was said as its `label` |
| Leave a post | `POST /api/posts?lang=` | On the same hold, where they answered *post*, with what was said as its `body` |

Every one of these is an endpoint the website already calls except two, and both
of those lo added for a client like this: `POST /api/dashboard`, which is the
seven reads a first screen needs made as one, and `POST /api/me/link`, which is
what lets a stored token open the WebView as well as the glasses.

**Why the dashboard read and not seven.** A dashboard has to have every tile
filled before it can be shown. This client spent a while drawing one card at a
time and reading the feeds the way the website does — separately, and the regional
ones only once the reader had scrolled that far — which was the right trade for a
sequence of cards and is the wrong one now: the first page carries a count of what
is on the other two, so there is no such thing here as a feed nobody has looked at
yet. Seven round trips on a phone tether to fill one screen is what
`POST /api/dashboard` exists to avoid. It files our fix on the way past as well,
the same trade `PUT /api/position` makes, so it replaces the position call on a
new fix rather than being made beside it.

Two reads are left outside it, each for a reason. The warnings are not in that
answer and are a line of the opening page — a warning nobody scrolled far enough
to see is a warning that was not issued — and Yahoo answers them per municipality,
so they are keyed two decimal places where the dashboard is keyed three. The inbox
has nothing to do with where anybody is standing, so it is asked for only while the
page that shows it is up, and at most once a minute. Reading `GET /api/messages`
marks nothing read; only opening one conversation does that, which is why the
glasses can show who is waiting without answering for the reader — and why the
screen that reads a letter up here shows the last line of it whole rather than the
exchange it came out of. Opening the conversation is what marks it read, and doing
that from a screen with no keyboard would answer for the reader twice over: it
would clear the badge on their phone for a letter they have not replied to and
cannot. The exchange stays where the reply is.

The cost is one round trip for feeds a given session might never read. The saving
is a launch that reaches a full first screen after two reads instead of seven, and
a scroll that costs nothing at all.

**The two writes, and why there is a question between them.** The glasses used to
write only marks: there were two gestures and both were the same verb — a tap
saved the spot, a hold saved it with what you said about it. That was one thing
too few. A sentence said out here is a mark when it is a note to yourself and a
post when it is left for whoever comes past, the difference is the whole of what
those two endpoints are, and nothing in the words themselves says which. So the
hold now records and stops there, and the screen asks: the wheel picks between the
two, a tap sends it, two taps throw it away (see `src/glassesui/pages/compose.ts`).

Both endpoints take the same shape of body — the fix, the time, and what was said
— and both look the place up themselves rather than trusting a name from here, so
what the glasses write is filed exactly as what the website writes is. The
difference in what they will take is real and is shown to the reader rather than
applied behind them: 48 characters as a mark's `label` against 500 as a post's
`body`, so the screen previews the sentence cut the way the answer under the wheel
would cut it.

A post made here is followed by a re-read of `GET /api/posts` rather than left to
the next minute: the page listing what is on this street is one flick away, and a
reader who scrolled to it and did not find what they had just said would have
every reason to think it was never written.

What still belongs on the phone is everything with a keyboard or a camera behind
it — a post's picture, replies, and editing either kind after the fact.

`PUT /api/position` is doing double duty here exactly as it does on the website:
it files where we are and answers with who else is about and how much is waiting to
be read, so presence and the unread count cost the minute loop nothing beyond what
it was already spending.

## Caveat

Sessions live in an in-memory `Map`, so restarting the server signs everyone out.
A stored token survives that and is worth nothing when it does: `POST
/api/me/link` answers `401 LOGIN_REQUIRED`, the token is erased, and the sign-in
screen comes back.

The withdrawal is best-effort in one direction: the sixty-second timer is lost if
the WebView is closed before it fires, leaving that key standing until the next
launch schedules another withdrawal of it. A key not yet withdrawn is a password
equivalent — it does not expire, it carries full account authority, and it is the
same key every other `?k=` link for this account is built from — so treat any XSS
in this WebView, or in `lo.gcc3.com` while the key is still in its URL, as account
compromise. The stored token is the same kind of prize and is now there to be
taken at every launch rather than only after a sign-in.

Because a key is minted per launch and withdrawn after it, opening this package
**invalidates any `?k=` link previously handed out for the same account** — every
launch now, not only the ones that ask for a password.

A sign-out on any other device is not news that reaches a launched package: it
invalidates that device's token and no other. What it does mean is that the next
launch of this one is unaffected — its own token is its own session, and the only
sign-out it hears about is the one made in the frame it is showing.
