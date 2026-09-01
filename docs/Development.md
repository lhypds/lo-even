Development
===========

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


Checking the glasses without glasses
------------------------------------

Two tools in [src/glassesui/dev/](../src/glassesui/dev/) run the display under node,
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
[Screen.md](Screen.md). Re-measure it against a pair of glasses before
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
