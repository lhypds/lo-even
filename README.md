lo-even
=======

`lo` for Even G2. The phone-side WebView signs in to the existing lo account and supplies location; the glasses show lo's dashboard one card at a time.


On the glasses
--------------

lo's dashboard is a grid of tiles turned with a thumb. There is no grid on a
576×288 heads-up display and nothing to put a thumb on, so the same dashboard
becomes one line of screenfuls — the time here, the sky here, the ground here,
then who is around, what is in force, and everything that is a reading of a wider
place than the one you are in. That is the website's own order, so a reader who
knows where things are on the phone knows where they are here.

A card that has more rows than fit contributes several screens, and scrolling
walks the whole line: read to the bottom of the posts and one more flick is the
news. See [src/glassesui/](src/glassesui/) — a card there says what it has to say
and nothing about where it lands, and [layout.ts](src/glassesui/layout.ts) does
all the fitting.

- **Scroll up/down** — the next screenful, or the previous one.
- **Single tap** — save the phone's current location as a lo mark.
- **Press and hold** — record from the glasses microphone. Release to transcribe and publish the message as a location-based lo post.
- **Double tap** — the standard Even exit confirmation.

Which cards appear depends on where you are standing: lo asks the server what
that country can feed, and a card it cannot feed is left out rather than left
empty — an empty Trends card would read as "nobody here is searching for
anything", and an empty Warnings card would be an all clear nobody checked.


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
npm run glasses:preview          # every card, drawn as text
npm run glasses:preview -- ja many
npm run glasses:check            # drive the display against a fake bridge
```

`glasses:preview` renders each card to a character grid the shape of the panel, so
the columns can be read the way the wearer would read them. Pass `ja` or `zh` — a
column measured in characters rather than cells fits English and clips Japanese,
and that is only visible side by side. Pass `many` to lengthen the posts list and
watch a card break into pages.

`glasses:check` drives the real display against a bridge that records what it was
asked to do, and asserts the two things the typechecker cannot see: that scrolling
walks every card and holds its place when the sequence changes underneath it, and
that a repaint writes as little as it can — one line for a minute of the clock,
nothing at all when nothing moved, one rebuild rather than seven writes when a
whole card changes.


Release
-------

```bash
./login.sh
./package.sh
```

The package identity is `com.gcc3.lo`, while its Even Hub display name is `lo`. The companion server must accept `Authorization: Bearer` on `/api/*` and answer cross-origin preflights there, as documented in `server-integration.md`, before a packaged build can sign in.
