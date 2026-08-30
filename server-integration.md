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

[src/webui/webui.ts](src/webui/webui.ts) asks for a username and password, in that
order and in two goes — the name is put to `POST /api/username` before the
password screen goes up, exactly as lo's own sign-in screen puts it, so a name
lo does not have is answered on the field it was typed into rather than after a
password has been asked for and refused. That request signs nobody in.

A name nobody is using comes back from it as `USER_NOT_FOUND`, and that is the
offer to open the account: the same sheet lo puts up, and the same password step
behind it, with `POST /api/users` in place of `POST /api/login` at the end. Both
answer alike — `{ user, token, key }` — so everything below is true of a reader
who has just opened an account as much as of one signing back into theirs.

`POST /api/login` is the second of the two, and it answers with a `token` and a
`key`, which are spent on the two frames:

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

## The fix crosses the frame too

Both halves of this app were reading the same GPS. The site inside the WebView
reads the phone's position every thirty seconds to keep its own dashboard current
(`LOCATION_REFRESH_MS`, in `../lo/src/components/LocationProvider`), and this side
read it again every minute to feed the glasses — one pocket, one sensor, and two
apps waking it to be told the same thing.

So `requestPosition` in `../lo/src/utils/location.js` posts every fix it lands, on
the same channel and in the same shape as the two notices above:

```js
window.parent.postMessage({ source: "lo", type: "fix", fix: coords }, "*");
```

`coords` is lo's own reading — `latitude`, `longitude`, `accuracy`, `altitude`,
`speed`, and `at`, the moment the sensor answered. The stamp is the point of
carrying it: [src/main.ts](src/main.ts) spends a fix rather than a message, so the
line that says how old the fix is counts from the reading and not from when it
crossed the frame.

`"*"` again, for the reason the sign-out uses it, and the position is safe on the
same terms rather than by exception: a cross-origin frame has no geolocation of
its own, only what the page around it delegates with `allow="geolocation"`. A host
that can be told where the reader is standing is a host that already had the
permission to ask; one that did not delegate is listening to a frame that never
got a fix to post.

`phoneLocation` then takes a posted fix under 45 seconds old instead of calling
`getAppLocation`, and falls straight back to the bridge the moment they stop
arriving — the reader turned location off in the site, or signed out of it, or is
on a build of lo older than the notice. Forty-five seconds is a beat and a half of
lo's clock, so an ordinary one is always in hand and a frame that has gone quiet
is noticed inside a single turn of this app's own beat. The beat itself does not
move: it still runs on the minute and still asks for whatever it has not been
given.

## And the answers hanging off the fix

The same duplication runs one layer up. The site and this package are two clients
of one server on one phone, and they ask it nearly the same questions: the place,
the sky, the newswire, what is on, the trends, where to eat, where the coffee is,
what is worth reading nearby, what is in force, what is on the ground here and who
else is standing on it. `shared` in `../lo/src/api.js` wraps each of those reads
and posts the answer up as it lands:

```js
window.parent.postMessage({ source: "lo", type: "feed", feed, lang, coords, data }, "*");
```

`feed` is the name the store on this side holds it under; `coords` and `lang` are
the question it answers. `Feeds.offer` files it under *exactly* the key the read
that would have fetched it carries, so `fill` finds the question already answered
and the request is never made. An answer that does not fit — a feed this build has
no slot for, ground too far from the venue anchor, a language the glasses are not
being read in — falls through and is asked for as it always was. It is an offer,
never an instruction.

Two consequences worth naming. The four things `POST /api/dashboard` alone answers
(the place, the newswire, what is on, the trends) now have slots of their own, and
that read is skipped only when all four have been handed over — `dashGiven`. lo's
own dashboard opens as a block of squares with the newswire, what is on and the
trends off it, so in practice the dashboard read still goes out, and this is a
saving that arrives with the panels the reader adds. What *is* saved on every
launch is the minute beat's `PUT /api/position`, because the site trades positions
on the same minute this side does, and `GET /api/warnings`, because lo carries
that card by default where the country has one.

**What does not cross.** Nothing addressed to the reader in person: not the inbox,
not one exchange, not a column of remarks, not a profile. Those stay this side's
own reads. The line is drawn on the content rather than on the audience because it
cannot be drawn on the audience — lo can be framed by anybody and the package's
origin is not nameable in advance, which is the same reason the sign-out goes out
to `"*"`. Everything that does cross is either a read lo answers with no session
at all, or what lo shows to any signed-in reader who walks down that street. If lo
ever gains a `frame-ancestors` policy naming the Even Hub WebView, this is the
paragraph that gets to relax.

## Endpoints used

This is what this side asks for when it has not been handed the answer. Every row
the site in the frame also fetches is skipped where its answer arrived first — see
the section above.

| Purpose | Endpoint | When |
| --- | --- | --- |
| Is this a name lo has? | `POST /api/username` | On the first step of that sign-in, before the password is asked for |
| Sign in | `POST /api/login` | Once, the first time this package is opened |
| Open an account | `POST /api/users` | Instead of that, where the name step found nothing and the reader said to create it |
| Take the stored session up again | `POST /api/me/link` | At every launch after that |
| Withdraw the spent link key | `DELETE /api/me/link` | A minute after either of them |
| Sign out | `POST /api/logout` | When the frame says it has signed out |
| The place, its weather, its components, the newswire, what is on, the trends, the posts within reach and who else is about | `POST /api/dashboard?lang=` | Every new fix |
| Warnings in force | `GET /api/warnings?lat&lon` | Every new fix |
| Somewhere for a coffee, nearest first with distances | `GET /api/cafe?lat&lon&lang=` | Every new fix, keyed to a ~1 km square and half an hour — started rather than waited on |
| Somewhere to eat, the same | `GET /api/food?lat&lon&lang=` | The same |
| Wikipedia articles carrying a coordinate near here, with a lead paragraph and a picture where there is one | `GET /api/wikipedia?lat&lon&lang=` | The same |
| Publish our fix, get everyone else's and the unread count | `PUT /api/position` | Every minute |
| The inbox — letters and comment columns in one list | `GET /api/messages` | While the second page or anything under it is up, at most once a minute |
| One exchange, which marks it read | `GET /api/messages/:username` | Three seconds after the reader has opened one letter and stayed on it |
| Who somebody is: bio, contacts, follow figures, last posts | `GET /api/users/:username` | When the reader opens one of the names on the street |
| One column of remarks, which marks it read | `GET /api/posts/:postId/comments` | Three seconds after the reader has opened one post — on the street, where lo has said it has any, or out of the inbox |
| Save a mark | `POST /api/marks?lang=` | On a hold, where the reader answered *mark*, with what was said as its `label` |
| Leave a post | `POST /api/posts?lang=` | On the same hold, where they answered *post*, with what was said as its `body` |
| Say something to a person | `POST /api/messages/:username` | On a hold begun while that letter — or that person's page — was open, with what was said as its `body` |
| Answer a post | `POST /api/posts/:postId/comments` | On a hold begun while that post was open — from either screen — with what was said as its `body` |

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

Four reads are left outside it, each for a reason. The warnings are not in that
answer and are a line of the opening page — a warning nobody scrolled far enough
to see is a warning that was not issued — and Yahoo answers them per municipality,
so they are keyed two decimal places where the dashboard is keyed three. The inbox
has nothing to do with where anybody is standing, so it is asked for only while the
page that shows it is up, and at most once a minute. Reading `GET /api/messages`
marks nothing read; only opening one row does that, which is why the glasses can
list what is waiting without answering for the reader.

**And the two venue reads**, which are outside it for a plainer reason: the
dashboard was built before those two cards existed and does not carry them. They
would be worth folding in — a client that cannot afford round trips is exactly
what that endpoint is for — and until they are, they are two reads of their own on
every new fix. Three things keep that cheap. They are keyed the coarsest of
anything here, a ~1 km square and half an hour, because a restaurant is not news:
tomorrow's list is today's, and what makes it a new question is the reader having
walked somewhere. lo keeps its own hour-long answer per square behind that, so a
street somebody has already asked about costs a file read. And they are *started*
rather than waited on — Overpass is a public instance that queues its callers and
is given twenty seconds to answer, and what waits on the fix's own promise is the
errand that tells the page in view to re-ask. A cold square would hold that up for
the better part of half a minute in exchange for two lines at the foot of one
page, so the lines arrive underneath a page the reader is already reading.

The cost is one round trip for feeds a given session might never read. The saving
is a launch that reaches a full first screen after two reads instead of seven, and
a scroll that costs nothing at all.

**Two kinds of row, one list.** `GET /api/messages` answers with lo's whole inbox,
which is two tables merged: a letter addressed to the reader, and a column of
remarks under a post that is theirs or that they have written under. They come down
one list because they are one thing to whoever is reading them — somebody said
something, and here is where to answer — and what tells them apart is `kind`.

What `kind` decides is where a press goes, so the glasses cannot ignore it: a
person opens the exchange and a post opens its comment column, and a client that
took every row for a letter would answer a `post` row by fetching a private
conversation with whoever happened to comment last. It decides the heading too. A
letter is headed by its correspondent, because that is the whole of what the
exchange is about; a column is headed by the post — lo's own `messages.onPost`,
`On “…”`, filled with the post's words, else where it was left, else
`comments.aboutPost` — because a column has as many voices in it as came past and
none of them is what the row is about. Both rows then say who spoke last and what
they said, which on a column is the only place any of those voices is named at all.

Because two rows can be named the same thing, each carries its kind in the key the
display holds it by (`person:mari`, `post:12`). A reader's place in a list is held
by name rather than by position, the list being rebuilt under them on every paint —
so the name has to say which list it is a name in.

**The reads that are really writes.** `GET /api/messages/:username` answers with one
exchange and marks it read on the way past, and `GET /api/posts/:postId/comments`
does the same for a column. There is no endpoint that does only the second half of
either. None was added, because lo does not want one: it has never had a button for
this on its own sheets either — something somebody has been shown is something they
have seen, and a sheet that made the reader press something afterwards would be
asking them to file their own post.

What decides it up here is three seconds, for both. The glasses ask once the reader
has opened one row and is still on it, which is the same claim the sheet makes by
being open, made by the only means a screen with no scrollbar has. Not on arrival:
the wheel walks a list a flick at a time and the screen changes with every flick,
so something passed through would otherwise be something marked read. Not from the
list either — a reader walking a list of rows has opened none of them, which is the
same rule that keeps a newswire row's story unfetched until it is tapped. The
column is behind that clock on both of the screens it is read from, the street's
post as well as the inbox's row: the request is the same request and it files the
same thing whichever screen asked.

This is the piece that had to wait for the reply below. The earlier version of this
file argued against marking anything read from up here, and the argument was right
at the time: doing it from a screen that could not answer would clear the badge on
the phone for a letter the reader had been shown and could do nothing about, and
they would come home to an inbox that looked dealt with and was not. That objection
is spent now that the same screen replies.

The answer is also the screen. It carries the whole exchange, and that exchange is
what the reading screen behind a letter draws — newest line first, which is upside
down for a correspondence and right for this display: lo's own sheet runs oldest
first because a sheet can be scrolled to the bottom before the reader sees it, and
a wheel cannot. It opens on the first screenful and walks forward a flick at a
time, so the usual order would put the line the reader came for behind every line
they have already read.

Each line is written as a name, a colon and the sentence, `You:` for the reader's
own — lo's own `messages.said`, lifted key for key, and a companion for the other
side that lo has no key for because its row draws the name in a column beside the
words. `mine` off the wire is the whole of what says which, and a display with one
column and no bubbles has nowhere but the type to put it. The colon is the ASCII
one in all three languages where lo sets a full-width `：` in two of them: a
character this face turns out not to carry draws as four pixels of nothing rather
than as a box, and U+FF1A has not been through the probe in `docs/Screen.md`.

The three seconds are therefore also three seconds before the exchange appears,
and nothing on the screen moves when it does. What stands there in the meantime is
the last thing said — which `GET /api/messages` has already handed over, along
with which side said it — drawn in exactly the form the exchange will draw it in.
The rest arrives *underneath* it.

The footer says which of the two states it is in, because the screen itself cannot:
one line is a short correspondence and a long one still on the wire, and a reader
with no way to tell them apart takes the first for the second and leaves. A request
not yet made and a request still out get the same sentence — the care this file
takes over idle-against-loading elsewhere is about claims, and there is no claim
here to get wrong. Once the exchange has landed the same line says how to answer
it, and where nobody could be reached it says that instead of either.

The recounted `unread` comes off the same answer, so the badge in the corner goes
out in the same breath rather than on the inbox's next beat, and the inbox's own
key is dropped with it, so the dot beside that correspondent's name goes on the
next paint rather than at the top of the next minute (see `wrote`, which does the
same for a post). Exchanges are kept per correspondent and bounded at ten, the way
stories are: this store grows with what the reader has opened rather than with
where they are standing.

**Who is about, and how little that is allowed to say.** `PUT /api/position` and the
dashboard both answer with everyone else's fix, and until recently the screen
behind a name printed it: a distance, an hour and the coordinates it was taken at,
to four decimal places. That is eleven metres of where a person actually is, shown
to anybody within reach with a pair of glasses on, and no screen in lo has ever
done it — the website draws a dot on a map at a scale nobody reads a doorway off,
and the number itself is nobody's business. It is off both screens now. What is
left is the distance and the hour, which says there is somebody here without
saying which window they are behind. The coordinates still arrive in the answer,
because the distance is computed from them; nothing draws them.

What is worth reading behind a name is who it belongs to, which is the one question
a position cannot answer, and lo has had a page for it as long as it has had
profiles. `GET /api/users/:username` is that page in one read — the bio, the ways
to reach them off lo, the two follow figures and their most recent posts — and the
glasses draw all four in the order the website draws them, with five of the posts
where the website lists twenty. A profile on a phone is scrolled; this one is
walked a screenful at a time, and the other fifteen would be four flicks of
somebody else's afternoon between the reader and the end of the screen.

It is asked for when the reader opens one name and not before, which is the same
rule that keeps a newswire row's story unfetched until it is tapped: a street the
reader is walking past would otherwise be four profiles a minute nobody asked for.
Unlike the exchange above it is a read and only a read — lo files nothing when a
profile is fetched — so no clock stands in front of it, and it is keyed on the name
and five minutes: a bio changes about never, and what moves underneath is the
handful of recent posts. Profiles are kept per person and bounded at ten, the way
exchanges and stories are.

**What was said back about a post.** `GET /api/posts/:postId/comments` is lo's own
column under a post, and it is reached from two screens: the post on the street, and
the row in the inbox that is about it. Both draw the same screen, so what the reader
finds is the same either way — and both are behind the three seconds above, because
asking for it is what files it as read.

It is the cheapest of these reads on one of those two screens, because it is the
only one that can know in advance whether there is an answer to be had: a post on
the street arrives carrying the number of remarks under it, so a post nobody has
replied to, which is most of them, costs no request at all and the screen behind it
can say so without waiting. The guard is written as "this post, and lo said nothing
is under it" rather than as "a post I can find" — a post the street has never heard
of is one the inbox is asking about, and the inbox lists no column that is empty.

The column is drawn oldest first, where the exchange above is drawn newest first,
and the two are not inconsistent. A letter is the whole of its screen and the line
the reader came for is the last one said, so the wheel has to start there; a post is
the thing the reader came for and it is already at the top, in the heading and the
first paragraph, and everything under it came after it. It is also the order lo
draws this column in, for lo's own reason: every other list on lo answers "what has
been happening" and this one answers "what was said".

Each remark is written the way every message in this app is — a name, a colon and
the sentence, `You:` for the reader's own. lo's rows carry no `mine` here, and want
none: its column has a face beside each line, where this display has neither a face
nor a side of the screen to put one on. So the side is worked out from the name
against the signed-in account, which is the one piece of this the glasses decide for
themselves. Columns are kept per post and bounded at ten, the way exchanges,
profiles and stories are.

**The four writes, and why there is a question in front of each.** The glasses used
to write only marks: there were two gestures and both were the same verb — a tap
saved the spot, a hold saved it with what you said about it. That was one thing too
few. A sentence said out here is a mark when it is a note to yourself and a post
when it is left for whoever comes past, the difference is the whole of what those
two endpoints are, and nothing in the words themselves says which. So the hold
records and stops there, and the screen asks: the wheel picks between the two, a
tap sends it, two taps throw it away, and a hold says it again over the top — a
transcriber mishears and there is no keyboard up here to correct it with (see
`src/glassesui/pages/compose.ts`).

Those two endpoints take the same shape of body — the fix, the time, and what was
said — and both look the place up themselves rather than trusting a name from here,
so what the glasses write is filed exactly as what the website writes is. The
difference in what they will take is real and is shown to the reader rather than
applied behind them: 48 characters as a mark's `label` against 500 as a post's
`body`, so the screen previews the sentence cut the way the answer under the wheel
would cut it.

**The third is a message**, and it is not on that wheel. `POST /api/messages/:username`
is reached by holding while one letter is open — where the sentence is being said
decides what it is, because the address is the one thing the reader has already
stated by opening that letter and not another. A wheel that could turn a letter
meant for one person into a line left in the street would put that mistake one
flick away.

The same hold on one person's page does the same thing, and deliberately: saying
something to somebody who has not written yet and answering somebody who has are
one act, one endpoint and one screen, so they are one gesture with one sentence in
the same corner of the footer saying so. It is also where a conversation most often
starts on the website — you have just read who somebody is and want to say
something to them — which is why lo puts the way in on the profile as well as in
the inbox. Only on the person's own screen, never on the list of names: the list is
what the wheel walks, and a hold there would be a message addressed to whoever the
reader had rolled onto.

So the reply gets its own screen with the shorter question on it: the words as they
were heard, the name of whoever is about to read them, a tap to send and two taps
to drop. It is confirmed rather than sent on the release because the words are a
transcriber's and not the reader's, and this is the write here that lands in
somebody else's inbox with the reader's name on it. It carries no fix — a letter is
filed under a person, and where the writer was standing when they answered is
nobody's business — so a hold begun on a letter does not wake the GPS at all, where
a hold about the ground ends in a high-accuracy read. The `body` is cut to lo's 1000
characters, which a minute of talking does not reach. Sending is followed by a
re-read of the exchange and a dropped inbox key, for the reason a post is followed
by a re-read of `GET /api/posts`: the reader is put straight back on the screen that
lists what they just said, and one that did not have it on it would be a screen
saying the letter never went.

**The fourth is a remark under a post**, and it is not on that wheel either.
`POST /api/posts/:postId/comments` is reached by holding while one post is open, and
what decides it is the same thing that decides the message: the reader has already
said which post by opening that one and not another. It is the public one of the two
— a letter lands in one inbox and this lands in the street beside what it answers —
which is why the screen that shows it before it goes names both whose post it is
going under and that everybody who comes past will read it.

It carries no fix either, and for a reason of its own: the post it goes under
already says which ground this is about, and a second fix taken from wherever the
reader happened to be standing when they answered would be a different place
claiming to be the same one. The `body` is cut to lo's 300 characters, which is the
one of the four cuts a spoken sentence actually reaches — about ninety seconds of
ordinary English and a good deal less in the other two languages — so the preview
earns its place here more than anywhere else. Sending is followed by a re-read of
the column *and* of `GET /api/posts`: the post is carrying a count that is now short
by one, and that count is what decides whether the column is ever asked for at all,
so a remark under a post nobody had answered would otherwise leave a nought behind
it and a screen saying the remark was never made.

A post made here is followed by a re-read of `GET /api/posts` rather than left to
the next minute: the page listing what is on this street is one flick away, and a
reader who scrolled to it and did not find what they had just said would have
every reason to think it was never written.

What still belongs on the phone is everything with a keyboard or a camera behind
it — a post's picture, and editing any of the four after the fact.

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
