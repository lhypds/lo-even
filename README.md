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

A word is also a thing that can be translated, which a picture is not: the badge
reads `msg (2)` in English and `未読 (2)` or `未读 (2)` in the other two — three
narrow Latin letters against two full-width characters, thirty-seven pixels
against forty. The corner is measured against whichever is widest and every
language gets that same box, because everything on that line is placed from this
edge: a corner that resized with the dictionary would make the heading a different
width in Japanese than in English.

**1 · Where you are standing.** The heading is the place and the hour there, with
the bearing beside it while the compass is on. Under it: the day, the two ends of
its light and the zone; the fix, how sure it is, how high and how fast if the
phone is actually moving; what it is like out; what the day is doing and how much
of its light is left; whatever is in force overhead — and then two lines counting
what is waiting on the other two pages, so a flick is never spent finding out
there was nothing there.

Whatever lines are left over after all that go to the days ahead — tomorrow's
range and weather, then the day after's — which is one line on an ordinary day and
none at all under a warning. The forecast is the only thing on this page that is
not about the minute you are standing in, so it is the thing that gives way: the
alternative was a page that spilled onto a second screenful, and the count of
everything else in the app is on the last line of the first one.

**2 · Who is here.** The last word of each row waiting in the inbox, the latest
posts left on this street, what is on within walking distance, and the names of
everyone else with a tab open nearby. The messages come first because they are the
one thing on the page addressed to the reader — the posts are everybody's and the
names are whoever happens to be about.

The inbox is two kinds of row in one list, which is lo's own arrangement: a word
addressed to you and a word left under something you wrote are the same thing to
whoever is reading them — somebody said something, and here is where to answer. A
letter is headed by whoever wrote it; a column of remarks is headed by **the post
everybody in it is talking about** — `On “the cherry blossom is out”` — because a
column has as many voices in it as came past and no one of them is what the row is
about. Under the heading, both say who spoke last and what they said.

A name says how far away and how long ago, and never where. Somebody's fix
written out to four decimal places is eleven metres of where they actually are,
printed for anybody within reach who has a pair of glasses on; no screen in lo
has ever shown it and neither does this one. What is on the screen says there is
somebody here without saying which window they are behind.

**3 · What is being said.** The newswire for this corner of the map, and what the
country is searching for — the freshest few of each rather than all of one.
Listings are on the second page rather than this one, because something on this
evening a street away is a fact about where you are standing; a newswire is not.

How many lines each group gets is dealt rather than fixed: every group keeps its
first line whatever happens, and the ones left over go round in the order the page
lists them, so the letters take the spare line on the morning three people have
written and the posts take it on the afternoon everybody is out. The order is the
priority, and it is the same order the wheel walks the list in one level down. See
[src/glassesui/](src/glassesui/), where a page says what it has to say and
[layout.ts](src/glassesui/layout.ts) does all the fitting.


### Underneath the pages

A dashboard fits by cutting, and what it cuts is the ends of sentences. That is
the right answer to "what is going on here" and no answer at all to "what did
they say", so there are three taps under each of the two pages that have groups
on them:

1. **A tap puts a box round one of the groups**, on the page itself. The wheel
   moves the box: Messages, Posts, Events, People. Nothing else changes — you are
   choosing where to go, and you have not gone yet.
2. **A tap on the boxed group opens it.** Only that group: its entries get two
   lines apiece and three are on screen at a time, the box round the one you are
   on and that one written in ink.
3. **A tap on an entry reads it whole**, a screenful at a time if it runs long.

The choosing is a step of its own because the page has four things on it. A tap
that opened *a* list would have to guess which, and the wheel would then have to
carry you across group boundaries to correct the guess — so the choice is made
where all four are already in front of you.

One entry reads as a list rather than as a thing, and that is the letters: the
third tap opens the whole exchange with that person, not the one line the inbox
had. **Newest at the top**, which is upside down for a correspondence and the
right way up for a wheel. lo's own sheet runs oldest first and opens itself
scrolled to the bottom — a sheet can be scrolled before you see it, and this
cannot. Here you land on the first screenful and go forward a flick at a time, so
the usual order would put the line you came for behind everything you had already
read. The hour is on the heading rather than repeated down the margin.

A post reads as a thing with a list under it, which is the same screen arranged
the other way round: the words first, and then what was said back about them,
**oldest at the top**. Nothing is upside down about that and it is not a different
rule — the line you came for is the post, it is already at the top, and everything
below it came after it. Where a letter has to be turned round to put the newest
line on the first screenful, a post is on the first screenful whatever happens.

Which is the same screen a column in the inbox opens into, and deliberately: a
post read off the street and the same post reached through the row about it are
one screen, so what you find is the same either way. It is why the inbox's row
carries the post's own words — that is what it is headed by, and what it is read
as.

Every message the app draws — down that exchange, down the column under a post,
under a name in the list, and on the summary a page up — is written the same way:
**a name, a colon, and the sentence**, `You:` for your own. Nothing in the words
themselves says which direction a line went, and there is no left and right up here
to say it with; lo's own sheet has bubbles and this has one column, so the
attribution has to be in the type. The summary is the one row that names two people, because it is the only
place that says who a letter is with as well as who spoke: `@mari: on my way` when
it is theirs, `@mari · You: on my way` when it is yours. The second shape never
wears the unread disc — a thread you spoke in last is a thread with nothing waiting
in it.

The third tap on a name opens the other page lo has always had on the phone: who
that person is. How far off and how recently, then how many read them and how many
they read, the line they wrote about themselves, the ways to reach them off lo, and
the last five things they have left on the ground. It is fetched when you open that
one name and not while you are walking past a list of them. Five posts where the
website lists twenty, because this page is walked a screenful at a time rather than
scrolled: the other fifteen would be four flicks of somebody else's afternoon
between you and the end of the screen.

The corner of the footer says where you are and how far through it:

```
lo/ · 1/3              where you are standing
lo/nearby · 2/3        who and what is around you
lo/info · 3/3          what is being said about the wider place

lo/nearby · 1/4        the same page, choosing the first of its four groups
lo/nearby/msg · 2/4    that group opened: the second of four letters waiting
lo/nearby/msg · 1/2    that letter, whole, over two screenfuls
```

Every page carries its own name; the group joins the path only once it is open.
The counter beside it counts whatever the path has just named. The four groups
under `lo/nearby` are `msg`, `posts`, `events` and `people`, in that order; the
two under `lo/info` are `news` and `trends`.

The wheel means the same thing at all four depths — the next thing along,
rounding at the end rather than stopping — and a double tap comes back out of
each in turn. Every group keeps its place on the page even when it is empty, with
one line saying which kind of empty it is, so the wheel always walks the same
route; there is simply nothing behind that sentence to read. The standing page is
instruments rather than a list of anything, and a tap on it does nothing.

The box is the only mark in the app that is not brightness, and it exists because
brightness could not reach the screen that needed a pointer first: a summary row
is a quiet word in the margin beside a bright reading, which is two containers,
and a container is one brightness for all seven of its lines. It then follows you
down onto the lists, where every entry is a container of its own and brightness
alone would have done, because picking a group and picking an entry are one
gesture and a pointer that changed shape half way through would be two things to
learn. On a list you get both: the box, and the entry written in ink with the two
beside it muted.

The things behind these pages that answer back are the three that are somebody's:
a letter, a person, and a post. lo's own row opens a post *and its replies*, and
so does this one — the column of remarks comes up under the words, in the same
name-colon-sentence every other message here is written in, oldest first because
the post is already at the top and everything under it came after it. Only for a
post that has been answered: the count rides in on the post itself, so a post
nobody has replied to costs no request at all.

These three are the exception because what they want back is one sentence said to
somebody, which is the whole of what a hold on the temple already records — so a
hold on a letter answers it, a hold on somebody's page says the first thing to
them, and a hold on a post leaves a remark under it. The newswire's rows are links
out to somebody else's article and have nothing to answer. What is still on the
phone is everything with a keyboard or a camera behind it: a post's picture, and
editing any of it afterwards.

- **Scroll up/down** — the next page, group, entry or screenful, or the previous
  one.
- **Single tap** — one step in: pick out a group, open the one you picked, read
  the entry you are on.
- **Double tap** — one step back out. At the top there is nowhere to come back
  from, and it is the standard Even exit confirmation it has always been.
- **Press and hold** — record from the glasses microphone. Release to stop, and
  what you said comes back as words on the screen with a question under it:
  **mark** or **post**? — or, where you had a letter, one person's page or one
  post open when you started talking, whether that goes to them.
- **Scroll**, while that question is up — the other answer, where there are two.
- **Single tap**, while that question is up — send it as the answer you are on.
- **Double tap**, while that question is up — throw it away.
- **Press and hold**, while that question is up — say it again, over the top of
  what is there. A transcriber mishears and there is no keyboard up here to
  correct it with, so the answer to the wrong words is the gesture that got them.
  A reply said again goes to the same person.
- **Single tap**, while a recording or a transcript is still in the air — throw it
  away.

The tap saves and two taps drop only on that one screen, and the swap is the point:
everywhere else a tap costs nothing, but a sentence you have already said is worth
something, and throwing it away should take a gesture you had to mean.

The hold is the one gesture that means the same thing on that screen as on every
other, and it is the only one of the four not written on it. The wheel and the taps
are spelled out there because they do something they do nowhere else; a hold opens
the microphone everywhere, and a line saying so would be teaching you the one thing
you already know.

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

The other two are **answers to something**, and neither is on that wheel. What
decides them is where you were standing when you started talking rather than
anything in the words: hold while a letter or somebody's page is open and the
sentence goes to them, hold while one post is open and it is a remark left in the
column under that post, hold anywhere else and it is about the ground under you. A
wheel that could turn a letter meant for one person into a line left in the street
would be one flick away from a mistake nobody should be able to make by rolling a
thumb, and the address is the one thing here the reader has already stated — by
opening that letter, that name or that post and not another.

So both of those screens ask the shorter question. There is nothing to choose, only
whether it goes: the words as they were heard, who is about to read them, a tap to
send and two taps to drop it. They are asked at all because the words are a
transcriber's rather than yours, and these are the things the glasses write that
land under somebody else's name — in their inbox, or in the column under something
they left on the street. The last row is where the two differ: a letter names the
person it is going to, and a remark names whose post it is going under and that
everybody who comes past reads it.

The words on those screens are the words as they were heard, five lines of them —
which is the whole body of the screen bar the two lines the answers sit on, and
enough for anything a held touchpad will take short of a speech. What each answer
saves of them is lo's own business and is not drawn: lo takes 48 characters as the
name of a mark, 300 as a remark under a post, 500 as the words of a post and 1000
as the words of a letter, and the mark is the only one of the four an ordinary
sentence reaches — so a spoken mark is filed under its first few words. Photos, and
everything else with a keyboard or a camera behind it, stay on the phone.

The footer of those screens is the entry's own, where every other screen in the app
has the place you are standing in there — a letter is not about a place, and a post
carries its own. It says two things, in this order. While the rest of the exchange
or the column is on its way it says so: one line on a screen is a short
correspondence and a long one that has not arrived yet, and without a word about it
you would take the one line for the whole of it and leave. Once it is all there it
says **hold to reply**, which is the verb these screens have and no other screen in
the app does, and so the one verb nobody can be expected to find on their own. Where
lo could not be reached it says that instead of either. A post nobody has answered
skips the first of the two and says the verb straight away — the count came in on
the post, so there is nothing on its way to wait for.

**Anything you stopped on has been read.** Three seconds on the screen that reads
a letter and lo is told so — the dot goes out beside that name, here and on the
phone, and whoever wrote it can see it arrived. The same three seconds on a post
say the same thing about the column under it. There is no gesture for either and lo
has never had one: something somebody has been shown is something they have seen,
and a screen that asked you to confirm it afterwards would be asking you to file
your own post. Three seconds rather than none because the wheel walks these a flick
at a time and the screen changes with every flick — arriving on something is not
reading it. It is only the screen that reads one whole, never the list: on a list
you have chosen nothing yet.

Those same three seconds are what fetch the exchange, or the remarks, because
saying a thing has been read and asking for it are one request in lo and there is
no wanting them apart. They are invisible all the same: what is on the screen until
they are up is the last thing said — or the post itself — drawn exactly as the rest
will be drawn, and what arrives arrives *underneath* it. Nothing you are reading
moves.

This is the piece that had to wait for the reply. Marking anything read from a
screen that could not answer it would have cleared the badge on the phone for
something you had been shown and could do nothing about — the reader would have
gone home to an inbox that looked dealt with and was not. Now the same screen that
says you read it is the screen you answer from, and the two halves are one gesture
apart. That is as true of a remark under your photo as of a letter, which is why
the badge counts both: the dot means "somebody wrote", and which of the two it came
from is the inbox's answer to give rather than the corner's.

What a country cannot feed is a line or a group left off a page rather than a page
left out: with three of them, a page that took itself off would move the other two
under a reader who had learned where they were. So an empty Trends group is
absent rather than claiming nobody here is searching for anything, and an absent
Warnings line is not an all clear nobody checked.

The one thing that cannot be said here is that there is no here. The start-up page
*is* the display, and a launch where the glasses answer and refuse to make one
leaves a package that looks well from the inside — the session comes back, the
feeds arrive, the touchpad reports every scroll and tap and hold — and puts
nothing on any glass. That used to be a line in the console, and the first anybody
heard of it was a hold failing to open the microphone, which is this page's absence
reported as something else entirely. So a refusal is an error now, and the sentence
goes on the phone, over lo's own site: **nothing is reaching the glasses, close lo
and open it again**. It is a line rather than a stop — the phone half never needed
the glasses and still works — and it is told apart from an ordinary browser, where
there is no native handler to refuse anything and the display is meant to be
absent.


Signing in
----------

The password is asked for once, on the first launch. The session that comes back
is written down, and every launch after it takes that session up again without
asking anybody anything — both halves of the app, the glasses on the token itself
and the phone view on a fresh link key minted from it. A session lo no longer
knows, because it aged out or the server restarted, brings the password screen
back and is forgotten in the same breath.

The asking is lo's own screen, in two goes: the name, and then the password. The
name is put to lo before the second screen comes up, so a mistyped one is answered
on the field it was typed into rather than after a password has been given and
refused — and a name nobody is using is answered with the offer to open it, which
is the same sheet, the same words and the same next screen the website has. The
password given there is the one the account is opened with.

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
the panel — the three pages, then for each group: the page with that group boxed,
the group's own list, and its longest entry read whole — so the columns can be
read the way the wearer would read them. The selection box shows as `┃` down both
edges of the rows it covers; its top and bottom are half a line above and below
them, which a grid of whole lines cannot draw. Pass `ja` or `zh` — a column measured in characters
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
three taps go in and three double taps come back out, leaving the reader on the
page they started from; that the wheel walks a page's groups in the page's own
order, then stays inside the one that was opened, and holds onto the entry rather
than its position when the list shrinks under it; and that a repaint writes as
little as it can — one line for a minute of the clock, nothing at all when
nothing moved, one rebuild rather than four writes when a whole page turns.


Release
-------

```bash
./login.sh
./package.sh
```

The package identity is `com.gcc3.lo`, while its Even Hub display name is `lo`. The companion server must accept `Authorization: Bearer` on `/api/*`, answer cross-origin preflights there, and mint a link key from a token at `POST /api/me/link`, as documented in `server-integration.md`, before a packaged build can sign in and stay signed in.
