# What the screen actually does

Every vertical number in [theme.ts](../src/glassesui/theme.ts) and every width in
[metrics.ts](../src/glassesui/metrics.ts) is derived from the measurements below.
They were taken off the Even Hub simulator a pixel at a time, because the display
answers no questions about itself: a text container takes a position, a size, a
border, a padding and a string, and nothing in the SDK will say how tall a line
is, how wide a glyph is, or what happens when either does not fit.

**Everything here is the simulator, not glass.** The simulator's own README says
font rendering may not match the hardware, and it re-implements the drawing rather
than sharing the firmware's code. Re-run the method below against a pair of
glasses before trusting any of it on glass. The two numbers to check first are the
line pitch (everything vertical hangs off it) and the digit advances (the clock and
the pager are positioned with them).

Measured on simulator **0.9.3** unless noted. The panel is **576 × 288**.


## Method

Launch the simulator with its automation server and drive it over HTTP:

```bash
evenhub-simulator http://localhost:5173/probe.html --automation-port 9899
curl -s -o shot.png http://127.0.0.1:9899/api/screenshot/glasses   # RGBA PNG, 576×288
curl -s http://127.0.0.1:9899/api/console                          # what the page logged
```

`probe.html` is a throwaway page that builds text containers with known geometry
and paints them through the real [paint.ts](../src/glassesui/paint.ts). The
screenshot is then decoded and read as pixels — for each row, the leftmost and
rightmost lit pixel — which is enough to recover every number here. The glasses
canvas is drawn in one colour on transparency, so a pixel counts as ink when its
alpha is set.

The app itself can be driven instead of a probe page, which is how the screens
that only exist a few taps in get measured. `POST /api/input` is the touchpad:

```bash
curl -s -X POST -H 'Content-Type: application/json' \
     -d '{"action":"click"}' http://127.0.0.1:9899/api/input
```

`action` is one of `up`, `down`, `click`, `double_click`, `long_press`,
`long_press_release`, `context_menu` — the wheel, the tap, the double tap and the
hold, which between them reach every screen in this app. Point the simulator at
`http://localhost:5173/` rather than at the probe, wait for the session to come
back, and step in.

**Advances** cannot be read off one glyph, because ink is not advance: the span of
one `M` is its ink, not the step to the next character. Ten copies span nine
advances plus one ink width, and one copy spans the ink width alone, so

```
advance = (span of ten − span of one) / 9
```

is exact — and every character measured this way came out a whole number, which is
the sign that it is. The space has no ink at all, so it is measured as the
difference between `0 0 0 0 0 0 0 0 0 0` and `0000000000` over the nine spaces
between. Ten characters to a screenful is ten screenshots for all of ASCII; the
probe rotates a set every three seconds and the capture polls `/api/console` for
which set is up.


## The line

| What | Value |
| --- | --- |
| Line pitch | **27 px** |
| Ink top, from the top of the content box | 6 px |
| Ink height (cap top to descender bottom, `Hgy`) | 21 px |
| Vertical alignment | **top**, never centred |

The pitch is the same for Latin and for CJK: three lines of `日本語` land 27 apart,
exactly as three lines of `Hgy` do. Mixed lines do not grow.

Top alignment is the one that catches people out. Two lines in a 70 px container
put their first ink at 6 px, not at 8 — the text is set from the top of the content
box down, and the room left over is all at the bottom. Anything overlaid on a line
of text has to be positioned on that line, not centred in the box that holds it.


## Boxes, padding and the scroll bar

`paddingLength` is charged on **all four sides**, top and bottom included. This is
the one that had the heading and the footer wearing scroll bars: a 34 px band with
a 1 px border and 10 px of padding has

```
34 − 2×1 − 2×10 = 12 px
```

of content box, which is less than half a line — and a text container short of its
content does not crop it, it **grows a scroll bar** and clips the line inside.

The threshold is exactly the line pitch, measured with a 1 px border and no
padding:

| Container height | Content box | Scroll bar |
| --- | --- | --- |
| 27 | 25 | yes |
| 28 | 26 | yes |
| 29 | **27** | no |
| 30 | 28 | no |

The same held with 8 px of padding (44 → content 26 → bar; 46 → content 28 → no
bar) and for CJK (29 px tall, content 27, no bar). So the rule is:

> **content height ≥ 27 px per line, or the box scrolls.**

Which is why nothing in [theme.ts](../src/glassesui/theme.ts) is given a round
number: the frame, the lines inside it and the body between them are all derived
from `LINE_HEIGHT`, so a firmware that sets its type differently is one constant to
change rather than a layout to redraw.

Text origin inside a bordered box is `x + borderWidth + padding`, confirmed at
paddings of 4, 6 and 10. With **no** padding it is not: a box with `borderRadius: 9`
and `paddingLength: 0` put its text 9 px in — the corner radius, not the border. Do
not rely on zero padding to put text at the edge of a rounded box.


## The face

The face is **not fixed-width**, which the layout assumed for a long time and paid
for in two ways: columns clipped a line earlier than they had to, and anything
right-aligned with spaces landed nowhere near the edge it was aimed at.

Every printable ASCII character, measured. Advances in pixels:

| | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | a | b | c | d | e | f |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **2x** | ` ` 6 | `!` 4 | `"` 6 | `#` 14 | `$` 12 | `%` 14 | `&` 15 | `'` 4 | `(` 6 | `)` 6 | `*` 8 | `+` 10 | `,` 5 | `-` 10 | `.` 5 | `/` 5 |
| **3x** | `0` 12 | `1` **7** | `2` 11 | `3` 12 | `4` 12 | `5` 12 | `6` 12 | `7` 12 | `8` 12 | `9` 12 | `:` 4 | `;` 5 | `<` 10 | `=` 10 | `>` 10 | `?` 12 |
| **4x** | `@` 17 | `A` 13 | `B` 12 | `C` 11 | `D` 12 | `E` 10 | `F` 10 | `G` 12 | `H` 12 | `I` 5 | `J` 8 | `K` 12 | `L` 9 | `M` 16 | `N` 12 | `O` 12 |
| **5x** | `P` 12 | `Q` 12 | `R` 12 | `S` 11 | `T` 10 | `U` 12 | `V` 13 | `W` 16 | `X` 13 | `Y` 13 | `Z` 12 | `[` 7 | `\` 5 | `]` 7 | `^` 10 | `_` 9 |
| **6x** | `` ` `` ? | `a` 11 | `b` 11 | `c` 10 | `d` 11 | `e` 10 | `f` 7 | `g` 11 | `h` 11 | `i` 5 | `j` 5 | `k` 9 | `l` **4** | `m` 16 | `n` 11 | `o` 10 |
| **7x** | `p` 11 | `q` 11 | `r` 7 | `s` 10 | `t` 6 | `u` 11 | `v` 11 | `w` 15 | `x` 11 | `y` 11 | `z` 9 | `{` 8 | `\|` 4 | `}` 8 | `~` 16 | |

And beyond ASCII: `·` 5, `°` 7, and CJK a uniform **20** (北 東 南 西 日 本 語 all
came to 20). The backtick drew no ink at all in the probe, so it has no
measurement; nothing lo shows contains one.

Three things follow.

**Digits are not tabular.** `1` is seven pixels where `0` is twelve, so the width
of a clock changes as it ticks. That is why the clock's container is sized for the
widest time it can ever show rather than for the time it is showing: a container
that moved every time a `1` turned into a `2` would rebuild the page for two
pixels (see [paint.ts](../src/glassesui/paint.ts) on rebuild versus write).

**The cell over-estimates by about a fifth.** Latin averages a little under ten
pixels against the cell's twelve; CJK is 20 against 24. That rounding is what
makes cells safe to cut a column to — nothing measured by the cell can overrun —
and useless for putting anything in a corner, which is why the two corners and the
centred sentence are placed by `textWidth` instead.

**Cutting is still done by the cell.** `clip()` and `wrap()` count cells, which
leaves 10–15 % of a long line unused. Switching them to pixels is a small change
and buys that back; what it costs is the margin that keeps a line from wrapping if
the firmware's face turns out to be a shade wider than the simulator's — and a
line that wraps in a box one line tall is a scroll bar.

Glyphs confirmed to render: `↑ ↓ → ● ○ ◇ ▣ ▤ ▥ ▦ · ・ ° ± √` and the CJK and kana
the three languages use. Every geometric shape in that list advances **20**, the
same as a kanji; `·` is 5, `・` is 20, `√` is 10.

**Glyphs the face does not have draw as nothing at all.** Not a placeholder box —
nothing: no ink anywhere in the band, and an advance of about four pixels where
the character stood. Confirmed for `✉` U+2709 and `✓` U+2713, and for `▭ ◫ ◧ ◨ ▮
☐ ☰ ⊞`. Both of the first two are Dingbats, so treat that whole block as absent
until a screenshot says otherwise. (Measured on simulator **0.7.3**, where the
`LV_USE_FONT_PLACEHOLDER` this note used to claim is plainly not in effect. The
advances agree with 0.9.3 exactly — `M` came back 16 — so the face is the same;
what may differ between the two is only what each does with a glyph it lacks.)

This is the failure mode to know about, because it is silent twice over. The
character is invisible, so a missing icon reads as a layout that has gone
slightly wrong rather than as a missing icon — and `textWidth` still charges the
table's width for it, so every right-aligned string containing one is padded as
though the glyph were there and lands that far short of the edge it was aimed at.
An envelope written down as 20 and drawn as 4 put the whole unread badge and the
clock beside it sixteen pixels adrift of the corner. Anything new and
non-alphabetic goes through the probe before it goes on the screen.


## Container limits

From the SDK's own constraints rather than from measurement (see
`@evenrealities/even_hub_sdk`):

| Limit | Value |
| --- | --- |
| Containers on a page (`containerTotalNum`) | 1–12 |
| Text containers (`textObject`) | **8** |
| Image containers (`imageObject`) | 4 |
| Brightness (`textColor`) | 0–4 |

and one from the simulator's changelog rather than the SDK: a text container's
content is capped at **999 bytes**.

An image container is **20–288 wide and 20–144 tall** (the SDK's own ranges), is
created empty, and is filled by `updateImageRawData` with **raw Gray8 bytes** —
one byte a pixel, row by row, exactly width × height of them. Measured on
simulator 0.9.3 by sending rendered squares (the venue map, see `navmap.ts`):
the call answers `success` and the bytes draw at the container's position with
0 as unlit and 255 as full ink. The simulator's own error strings say it also
takes Gray4 at half the length; that path has not been exercised.

A picture taller than 144 goes out as **stacked containers tiling one bitmap**,
and they tile exactly: the 190 px venue map is two 95-row slices at `y` and
`y + 95`, and a screenshot across the join shows every diagonal street crossing
it unbroken — no gap, no repeated row, no inset. (A 1 px error either way would
kink every diagonal, so the join is its own measurement.)

The host LZ4s the bytes on their way to the glass, so a
mostly-dark square is a small write — but it is still the biggest single write
this app makes, which is why the painter compares keys rather than re-sending
frames (see paint.ts).

Eight text containers is the budget the whole layout is drawn against, and it is
spent to the last one. Five go on the chrome — the frame with the heading in it,
whatever the screen says about itself, the badge and clock in one corner, the
footer line, and the path in the other corner — and three are the body. That is
why a summary page is a column of labels beside a column of readings rather than
a grid, why a list screen shows three entries and not four, and why a list names
its group in the heading rather than in a margin of its own: there was no ninth
container to put one in.

The box round whatever the wheel is pointing at is the eighth on the screens that
have one, and it gets there by taking the id of the container that says what a
screen has to say about itself — which is free on exactly those screens, a page
with something in that corner being one with nothing to point at. A list screen
is therefore four of chrome, three entries and the box: eight exactly, with
nothing left over.

A ninth would not be refused, either. The protocol drops it, so it goes missing
on glass and nowhere else — which is what `npm run glasses:check` counts.

### The box round a selection

The box drawn round whatever the wheel is pointing at — a group on a summary page,
an entry on a list — is a bordered container holding a single space, with no
padding (`boxAround` in [theme.ts](../src/glassesui/theme.ts)). Three things about
it were assumptions until the app was driven through `/api/input` and the result
read off a screenshot. All three hold:

- **A container with no text draws its border.** A single space is enough; the
  container is not skipped for having nothing to draw inside it.
- **The border is drawn on the rectangle itself.** Measured on a two-line entry
  at `y` 117, `height` 57: the top border landed on row 117 and the bottom on row
  173, and the horizontal borders were 564 px wide against a `width` of 564. No
  inset, no rounding.
- **`paddingLength: 0` behaves** on a bordered box. Nothing moved.

The content height is inside the rule as well: a one-row box is 30 px, and 30 less
a 1 px border top and bottom leaves 28 for a 27 px line; a two-line entry comes to
57 and leaves 55 for 54.

**What the air actually comes to.** Measured inside that same two-line box: five
clear pixels between the top border and the first ink, and two between the last
ink and the bottom border. The asymmetry is the line's own — the face sets its
type six pixels down from the top of a line and runs it to the bottom — so a box
that hugs the row is a box with all its daylight above the letters, and the
constant that answers it is not the one that looks obvious. Shrinking the box from
the top is nearly out of room (29 px is the least a one-row box can be before it
grows a scroll bar). Moving the *whole* box down a pixel is not: it costs nothing
in height, and takes the pair to four above and three below, which is as even as a
pixel grid gets.


## Simulator versions

The simulator has to be new enough for the SDK the app uses (`0.0.14`):

| Version | What it added |
| --- | --- |
| 0.8.0 | `zOrderIndex` |
| 0.9.0 | `textColor` |

An older simulator **rejects the whole page** — `createStartUpPageContainer`
returns an error naming the unknown field, and this app falls back to its browser
view, so the glasses canvas stays blank. If the panel is empty and the console
says `unknown field 'textColor'`, upgrade:

```bash
npm i -g @evenrealities/evenhub-simulator@latest
```
