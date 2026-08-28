lo-even
=======

`lo` for Even G2. The phone-side WebView signs in to the existing lo account and supplies location; the glasses show lo's dashboard as three pages, with the list each page summarises one tap underneath it.


On the glasses
--------------

lo's dashboard is a grid of ten tiles turned with a thumb. There is no grid on a
576×288 heads-up display and nothing to put a thumb on, and a screen that carries
one tile's worth of answer is a screen the reader has to leave to learn anything
else — so the whole of it becomes three pages, each as full as seven lines can be
made. Every line is a word in the margin and a sentence of readings beside it,
inside one square box drawn round the screen: the heading is its first line, the
footer its last, and a blank line above and below the body is what tells the three
apart, because air costs less ink than rules do.

The same corner of every page carries `msg (2) · 14:32`, whichever page is up: how
much is waiting to be read, and the hour. The count is drawn as a figure and never
as a blank, so nought reads as nought — the inbox is the one thing on these pages
that has nothing to do with where you are standing, and a count that appeared only
on the page listing it would be a count nobody saw until they had gone looking.

The two of them are one container rather than two, which is what keeps the space
either side of that dot the size it is written as. Everything in this corner hangs
from its right-hand edge, and right alignment on this display is spaces — so a box
is pinned at its right and loose at its left by however far its own characters fall
short, and a clock reading 11:11 is twenty pixels narrower than one reading 00:00.
Two boxes could not have held a gap still between them.

The badge says a word rather than showing an icon because the face has no
envelope, and no tick either. A character this face does not carry is drawn as
nothing at all — no box, no blank, just four pixels of air — which is invisible on
the screen and worse than invisible to the arithmetic that puts a line in a
corner. The ruled box `▤` that stood there instead does exist in the face, and
read as a list or a menu rather than as a mailbox. Every non-alphabetic character
on these pages has been through the probe in [docs/Screen.md](docs/Screen.md), and
anything new has to be.

**1 · Where you are standing.** The heading is the place and the hour there, with
the bearing beside it while the compass is on. Under it: the day, the daylight and
the zone; the fix, how sure it is and how high; what it is like out and what the
day is doing; whatever is in force overhead — and then two lines counting what is
waiting on the other two pages, so a flick is never spent finding out there was
nothing there.

**2 · Who is here.** The names of everyone else with a tab open nearby, the latest
posts left on this street, what is on within walking distance, and the last word
of each exchange waiting in the inbox.

**3 · What is being said.** The newswire for this corner of the map, and what the
country is searching for — the freshest few of each rather than all of one.
Listings are on the second page rather than this one, because something on this
evening a street away is a fact about where you are standing; a newswire is not.

How many lines each group gets is dealt rather than fixed: every group keeps its
first line whatever happens, and the ones left over go round in the order the page
lists them, so the newswire takes the spare line on the evening it has one and the
posts take it on the afternoon everybody is out. See
[src/glassesui/](src/glassesui/), where a page says what it has to say and
[layout.ts](src/glassesui/layout.ts) does all the fitting.


### Underneath the pages

A dashboard fits by cutting, and what it cuts is the ends of sentences. That is
the right answer to "what is going on here" and no answer at all to "what did
they say", so **a tap steps into the page you are on** — the same groups, no
longer competing for the screen with anything else. Entries get two lines apiece
and three are on screen at a time, the one you are on written in ink and the two
beside it muted. Another tap opens it whole, and a long post is read a screenful
at a time rather than cut off.

The corner of the footer says where you are and how far through it:

```
lo/ · 1/3            the three pages
lo/nearby · 7/22     the seventh of the twenty-two things around you
lo/nearby/messages   one of them, whole
```

The wheel means the same thing at all three depths — the next thing along,
rounding at the end rather than stopping — and a double tap comes back out of
each in turn. Every group keeps its place in the list even when it is empty, with
one entry saying which kind of empty it is, so the wheel always walks the same
route; there is simply nothing behind that sentence to open. The standing page is
instruments rather than a list of anything, and a tap on it does nothing.

What is still not here is anything that writes. lo's own rows open a post *and
its replies*, and a reply needs a keyboard; the newswire's rows are links out to
the article. What lo was told is what can be read up here, and the rest is on the
phone.

- **Scroll up/down** — the next page, entry or screenful, or the previous one.
- **Single tap** — into the list under this page, or into the entry you are on.
- **Double tap** — back out. At the top there is nowhere to come back from, and
  it is the standard Even exit confirmation it has always been.
- **Press and hold** — record from the glasses microphone. Release to stop, and
  what you said comes back as words on the screen with one question under it:
  **mark** or **post**?
- **Scroll**, while that question is up — the other answer.
- **Single tap**, while that question is up — save it as the answer you are on.
- **Double tap**, while that question is up — throw it away.
- **Single tap**, while a recording or a transcript is still in the air — throw it
  away.

The tap saves and two taps drop only on that one screen, and the swap is the point:
everywhere else a tap costs nothing, but a sentence you have already said is worth
something, and throwing it away should take a gesture you had to mean.

A tap waits about half a second before it is taken as a tap, because the host
reports the first press of a double tap as a press of its own and the two now mean
opposite things: in, and back out. The one exception is the tap that throws
something away, which is answered the moment it lands — both gestures end with
nothing saved there, so there is nothing for the wait to protect, and a way out
that hesitated would be a way out that felt broken.

A hold is the whole of what the glasses write, and the question is why. There are
two things a sentence said out here can be, and they are not two ways of filing
the same one: a **mark** is a name only you will ever read, and a **post** is a
line left on this street for whoever comes past. Nothing about the words says
which, and there is no unsaying something to a street — so the glasses ask, and
the wheel opens on the mark, which is the answer that can still be taken back by
nobody having seen it.

The words on that screen are the words the answer you are on would actually save:
lo takes 48 characters as the name of a mark and 500 as the words of a post, so a
long sentence visibly loses its tail on the mark line and keeps it on the post
line. Replies, photos and everything else with a keyboard behind it stay on the
phone.

What a country cannot feed is a line or a group left off a page rather than a page
left out: with three of them, a page that took itself off would move the other two
under a reader who had learned where they were. So an empty Trends group is
absent rather than claiming nobody here is searching for anything, and an absent
Warnings line is not an all clear nobody checked.


Signing in
----------

The password is asked for once, on the first launch. The session that comes back
is written down, and every launch after it takes that session up again without
asking anybody anything — both halves of the app, the glasses on the token itself
and the phone view on a fresh link key minted from it. A session lo no longer
knows, because it aged out or the server restarted, brings the password screen
back and is forgotten in the same breath.

Signing out is lo's own button, inside the phone view. There are two sessions
behind these two screens and the site can only end its own, so it says so to the
frame around it on the way out — one `postMessage`, no credential in it — and the
package ends the other and forgets what it was keeping. Both of these are written
up in [server-integration.md](server-integration.md).


Development
-----------

Requirements: Node 22+, npm 10.9+, and the `evenhub` CLI for simulation/packaging.

```bash
./setup.sh
./develop.sh
```

Open the printed URL in the Even Hub simulator. An ordinary browser also works for phone-UI development; when native location is unavailable, the development build uses central Tokyo as sample data.

The helper scripts mirror `sc-even`:

- `develop.sh` — Vite on the LAN plus an Even Hub QR code.
- `simulate.sh` — open the simulator against port 5173.
- `login.sh` — authenticate the Even Hub CLI.
- `package.sh` — build and produce the versioned `.ehpk`.
- `serve.sh` — foreground production preview.
- `start.sh`, `stop.sh`, `restart.sh` — optional PM2 staging preview lifecycle.


### Checking the glasses without glasses

Two tools in [src/glassesui/dev/](src/glassesui/dev/) run the display under node,
because most of what can go wrong up there is wrong long before a pair of glasses
would show it. Neither is bundled into the app.

```bash
npm run glasses:preview          # every page, drawn as text
npm run glasses:preview -- ja many
npm run glasses:preview -- en bare   # a country lo can feed none of
npm run glasses:check            # drive the display against a fake bridge
```

`glasses:preview` renders every screen in the app to a character grid the shape of
the panel — the three pages, then each page's list at every group boundary, then
the longest entry of each group read whole — so the columns can be read the way
the wearer would read them. Pass `ja` or `zh` — a column measured in characters
rather than cells fits English and clips Japanese, and that is only visible side
by side. Pass `many` to lengthen the posts and watch the lines they are given get
dealt out differently, or `bare` for a country lo can feed none of.

Every number the layout is built on — the line pitch, what makes a container grow
a scroll bar, how wide each character actually is — was measured off the simulator
rather than assumed, and is written down with its method in
[docs/Screen.md](docs/Screen.md). Re-measure it against a pair of glasses before
trusting it on glass.

`glasses:check` drives the real display against a bridge that records what it was
asked to do, and asserts the things the typechecker cannot see: that scrolling
walks every page and holds its place when the ground changes underneath it; that
a tap steps into the list and a double tap comes back out of each depth in turn,
leaving the reader on the page they started from; that the wheel walks a page's
groups in the page's own order and holds onto the entry rather than its position
when the list shrinks; and that a repaint writes as little as it can — one line
for a minute of the clock, nothing at all when nothing moved, one rebuild rather
than four writes when a whole page turns.


Release
-------

```bash
./login.sh
./package.sh
```

The package identity is `com.gcc3.lo`, while its Even Hub display name is `lo`. The companion server must accept `Authorization: Bearer` on `/api/*`, answer cross-origin preflights there, and mint a link key from a token at `POST /api/me/link`, as documented in `server-integration.md`, before a packaged build can sign in and stay signed in.
