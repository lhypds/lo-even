// Where everything on the glasses stands, in one place.
//
// The display has no font sizes. A text container takes a position, a size, a
// border and a brightness, and that is the whole of the vocabulary — so
// everything lo does with weight and scale on a phone has to be said here with
// position and brightness instead. The three that carry it:
//
//   • Columns. A row is not one string with spaces in it but two containers side
//     by side, which is what lets the word in the margin stay quiet while the
//     reading beside it is bright. Rows line up because each column is one
//     container holding one line per row.
//   • Brightness. 0–4, and lo's own two inks map straight onto it: --ink is
//     INK, --muted is MUTED. A label is never the same weight as its value.
//   • Air. One box around the whole screen and nothing drawn inside it, so the
//     heading and the footer are told apart from the body by the blank line above
//     and below it rather than by rules of their own. Two boxes stacked with the
//     body between them spent three lines of ink saying what half a line of air
//     says as well.
//
// Everything below is measured in whole lines and whole cells, because a layout
// that lands half a line short reads as a bug rather than as air.

import { CHAR_WIDTH, textWidth } from "./metrics";
import { TRANSLATIONS, type Translations } from "../i18n/translations";

/** The G2 canvas. Nothing may be positioned outside it. */
export const SCREEN_WIDTH = 576;
export const SCREEN_HEIGHT = 288;

// The character cell every column here is measured in. It belongs to the type
// rather than to the layout, so it is defined with the rest of the face's
// measurements and passed through from here (see metrics.ts).
export { CHAR_WIDTH };

// The line, measured rather than assumed. A text container lays its lines out at
// the font's own pitch and shows a scroll bar the moment they do not fit, so a
// box that is a pixel short of one line is a box with a bar down its right-hand
// edge and a clipped line inside it. 27 is what the Even Hub simulator draws, for
// Latin and for CJK alike: two lines in a plain container land 27 apart, and a
// container whose content box is 27 holds one line with no bar where 26 does not.
// Re-measure it against a pair of glasses before trusting it on glass —
// everything vertical on this screen is derived from it, so a firmware that sets
// its type differently is this one number.
export const LINE_HEIGHT = 27;

/** The gutter every line keeps from the edge of the screen. */
export const EDGE = 10;

// Brightness, which is the only weight this display has. The names are lo's own
// so that a page written against the website reads the same here: what is --ink
// there is INK here, and what is --muted there is MUTED.
export const INK = 4;
export const MUTED = 2;
export const FAINT = 1;

// The one box on the screen, drawn around the whole of it. Kept together and
// named, because whether the screen wears a box at all is the one judgement in
// this file that is taste rather than arithmetic — a see-through display charges
// for every lit pixel, and if the frame turns out to be too much ink on real
// glass, this is the line to change rather than the layout.
//
// Square corners: a rounded box reads as a card sitting on a background, and
// there is no background here — only whatever the glass is pointed at. The frame
// is the edge of the writing, and an edge is straight.
export const FRAME_BORDER_WIDTH = 1;
export const FRAME_BORDER_COLOR = 5;
export const FRAME_BORDER_RADIUS = 0;

// Inset by a pixel so the border is never clipped by the edge of the panel.
const INSET = 1;

// The gutter the frame keeps inside its own border. Derived rather than chosen,
// so that the first character of every line lands on EDGE — the heading, the
// margin and the footer all in one column. A heading that began a pixel or two
// off the list under it would read as two layouts sharing a screen.
export const FRAME_PADDING = EDGE - INSET - FRAME_BORDER_WIDTH;

/**
 * A rectangle on the screen, in pixels. Written out rather than computed at the
 * call site so that every line and column in the app can be read off one page.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The frame, which is also the container the heading is written in. One box
 * rather than two settles what an empty bordered container would do — this one is
 * never empty — and buys back the container the second box was spending.
 */
export const FRAME: Rect = {
  x: INSET,
  y: INSET,
  width: SCREEN_WIDTH - INSET * 2,
  height: SCREEN_HEIGHT - INSET * 2,
};

// Inside the border and the gutter: where the first line starts, where the last
// one has to end, and how much of the width is left for either.
const INNER_TOP = INSET + FRAME_BORDER_WIDTH + FRAME_PADDING;
const INNER_BOTTOM = SCREEN_HEIGHT - INSET - FRAME_BORDER_WIDTH - FRAME_PADDING;
const INNER_WIDTH = SCREEN_WIDTH - EDGE * 2;

/** The heading's line, which the frame itself carries, and the footer's. */
const HEAD_Y = INNER_TOP;
const FOOT_Y = INNER_BOTTOM - LINE_HEIGHT;

// The blank line the heading and the footer are told apart by, now that neither
// has a rule under it. Half a line rather than a whole one: a whole one would
// cost the body a row, and half is already more air than a hairline of ink was.
const AIR = 12;

// What is left over is the body, and how many lines that is worth is arithmetic
// rather than a decision: 288 is 1 + 1 + 8 + 27 + 12 + 190 + 12 + 27 + 8 + 1 + 1,
// and the middle of that is seven lines with a pixel to spare. Give the frame a
// wider gutter and the body loses a line here rather than silently losing it on
// the glasses.
export const BODY_Y = HEAD_Y + LINE_HEIGHT + AIR;
export const BODY_HEIGHT = FOOT_Y - AIR - BODY_Y;
export const BODY_LINES = Math.floor(BODY_HEIGHT / LINE_HEIGHT);

// The two corners on the right, and the only two things on the screen that are
// hung from their right-hand edge rather than their left.
//
// Sized for the widest they can ever be rather than for what they say now, so
// that the box never moves: a clock whose container shifted every time a 1 turned
// into a 2 would be a page rebuilt every other minute for two pixels (see
// paint.ts).
//
// **They hang from the frame rather than from the gutter, and that is not a
// mistake.** A left-aligned line puts its first ink on the gutter — a letter's
// left side bearing is a pixel or so, and that is the whole of the difference. A
// right-aligned line does nothing of the kind. It is right-aligned by being
// padded with spaces, and a space is six pixels, so it can only land within one
// of them; then the last glyph's own right side bearing takes another five to
// nine. Measured on the simulator, the ink of both of these stopped 12–14 px
// inside its own box. Hung on the same ten-pixel gutter as the title, that left
// them twenty-odd pixels off the frame where the title sits nine off it — two
// margins that do not match, on the one line of the screen that has both.
//
// So the gutter they are given is the padding and the bearing they were losing
// anyway, and the box itself goes right up to the inside of the border.
const INNER_RIGHT = SCREEN_WIDTH - INSET - FRAME_BORDER_WIDTH;
const PAGER_SLOT = textWidth("00/00");

/**
 * The top right corner: how much is waiting to be read, then the hour, with a
 * dot between them. **One container holding all three**, and that is the whole
 * design of it rather than an economy.
 *
 * The badge earns this corner because the inbox is the one thing on these pages
 * with nothing to do with where the reader is standing: a count that appeared
 * only on the page listing it would be a count nobody saw until they had already
 * gone looking. It is drawn as a figure and never as a blank, so nought reads as
 * nought.
 *
 * **Why one box and not two.** Everything in this corner is hung from its
 * right-hand edge, and a right-aligned string is right-aligned by being padded
 * with spaces — so each box is pinned at its right edge and floats at its left by
 * however far its own characters happen to fall short. A clock reading 11:11 is
 * twenty pixels narrower than one reading 00:00. Two boxes therefore cannot hold
 * a fixed gap between them: whichever of the pair the dot went in, the space on
 * its other side breathed with the hour. In one box the dot has a space either
 * side of it, exactly and always, and what floats instead is the left-hand end of
 * the whole group — against the empty middle of the heading, where there is
 * nothing for it to breathe against.
 *
 * The price is that the badge cannot be a different weight from the clock: one
 * container is one brightness. The count says what it has to say.
 *
 * Sized for the widest it can ever be rather than for what it says now, so the
 * box never moves: a corner whose container shifted every time a 1 turned into a
 * 2 would be a page rebuilt every minute for two pixels (see paint.ts). `99+`
 * rather than three digits, because a badge is a glance rather than a figure and
 * the point past which the exact number stops mattering is well short of a
 * hundred (see MAIL_MAX in layout.ts).
 *
 * **Widest across the languages, too.** The badge is a word and lo is read in
 * several (`mail.badge` in i18n/translations.ts), so the corner is measured against whichever
 * of them takes the most room and every language gets that box. The alternative
 * — a corner that resized with the dictionary — would make the heading a
 * different width in Japanese from in English, and everything on that line is
 * measured from this edge: the title is cut against it, and so is the bearing
 * laid over the middle of it. One width is one layout to reason about.
 *
 * The width is derived from every dictionary, so adding a language cannot make
 * its badge spill out of a slot sized for an older set.
 */
const MAIL_SLOT = Math.max(...Object.values(TRANSLATIONS).map((dict) => textWidth(dict["mail.badge"])));
const CORNER_SLOT = MAIL_SLOT + textWidth(" (99+) · 00:00");

export const HEAD_TIME: Rect = {
  x: INNER_RIGHT - CORNER_SLOT,
  y: HEAD_Y,
  width: CORNER_SLOT,
  height: LINE_HEIGHT,
};

// Whatever else the page has to say about itself, ending a cell before that
// corner. Laid over the frame rather than beside it: one line of type with a
// quieter one over the end of it needs no agreement about where the middle is,
// and it lets the meta be quieter than the title, which one container cannot do.
export const HEAD_META: Rect = {
  x: SCREEN_WIDTH / 2,
  y: HEAD_Y,
  width: HEAD_TIME.x - CHAR_WIDTH - SCREEN_WIDTH / 2,
  height: LINE_HEIGHT,
};

/**
 * The footer's right-hand end: how deep in the app the reader is standing, and
 * how far through this level of it — `lo/nearby/msg · 3/9`.
 *
 * The path is there because the wheel no longer means one thing. It walked three
 * pages round a ring and there was nothing to say about where you were that the
 * counter did not already say; now a tap steps into a list and another one into
 * what a row of it says, and a reader two steps in has to be able to see that
 * they are two steps in — and which way is out.
 *
 * **One container holding both**, for the reason the top right corner is one
 * container holding the badge and the hour: everything here hangs from the
 * right-hand edge, right alignment on this display is spaces, and a space is six
 * pixels — so two boxes could not have kept the gap between them still.
 *
 * Sized for the widest this particular path can ever be rather than for what the
 * counter says at the moment, so the box does not move as the reader walks a
 * list. The path is fixed for as long as they are on one level, and `00/00` is
 * the widest a counter gets.
 *
 * This is the width the string is padded out to, which is no longer the width of
 * the box it is written in: the box is a cell wider and holds that cell empty
 * (see TRAIL_SLACK).
 */
export function trailSlot(path: string): number {
  return path ? textWidth(`${path} · `) + PAGER_SLOT : 0;
}

// The pager is the one string on this screen that lands hard against the border,
// and the two numbers below are what pull it off it.
//
// Everything else in a corner has room to spare. The hour is right-aligned inside
// a slot measured off the widest badge and `(99+) · 00:00`, which is wider than any hour it
// actually says, so it floats several pixels clear. The pager does not: its slot
// is `${path} · ` plus the width of `00/00`, and a counter of narrower digits
// falls short of that by very nearly a whole number of spaces — `lo/ · 3/3` is
// four spaces short of its slot and pads out to it exactly, with nothing left
// over. Its last digit ends on the border itself.
//
// Which is worse than it looks, and is why this is a cell and not a hair. Right
// alignment on this display is spaces, and how many is worked out from this
// file's own advance table (see metrics.ts) — measured on the simulator, not on
// glass. A face a pixel or two wider anywhere in `lo/ · 3/3` and the padded line
// no longer fits the box it is written in: it wraps, and a wrapped line in a box
// one line tall is a scroll bar with the pager hidden behind it. A corner that
// disappears now and then is that.
//
// So the box is a cell wider than the widest string it can hold and the string is
// still padded to the slot rather than to the box (see layout.ts) — the cell
// stays empty, and it is the room the pager needs to be drawn at all. The three
// pixels beyond it are an eye's answer rather than an arithmetic one: type this
// close to a border wants daylight even when it fits.
const TRAIL_NUDGE = 3;
const TRAIL_SLACK = CHAR_WIDTH;

export function trailRect(path: string): Rect {
  const width = trailSlot(path) + TRAIL_SLACK;
  return { x: INNER_RIGHT - TRAIL_NUDGE - width, y: FOOT_Y, width, height: LINE_HEIGHT };
}

/**
 * What is left of the footer for the place you are standing in — the rest of the
 * line, ending a cell before the trail begins. Cut against the trail rather than
 * run the whole width underneath it: `lo/nearby/msg · 3/9` is a fifth of
 * this line, and a place name measured against the full width would be a place
 * name with a path written over the end of it.
 */
export function footLineRect(path: string): Rect {
  // Measured off where the trail's box actually starts rather than off its slot,
  // so the cell of air between the two is a cell whatever the trail is doing with
  // its own edges.
  return {
    x: EDGE,
    y: FOOT_Y,
    width: path ? trailRect(path).x - CHAR_WIDTH - EDGE : INNER_WIDTH,
    height: LINE_HEIGHT,
  };
}

// The body of every page: a word in the margin, and the line that answers it.
// At least ten cells of margin, widened when one of the supported languages has
// a longer label. Every cell left over goes to the line beside it.
//
// Left-aligned, both of them, and that is not a small decision: a column pushed
// to the right end with spaces only lands there if a space is exactly as wide as
// this file thinks it is, and it is not (see CHAR_WIDTH). A column that starts
// where its container starts lands where it is meant to whatever face the
// firmware is setting.
//
// **Where a line of the body ends**, and it is the same answer for all three
// shapes of body: on the inside of the border, not on the gutter the line
// started from. That is the edge the badge, the hour and the pager are hung from
// (see INNER_RIGHT), so a reading, a list entry or a line of a post that runs
// the whole width is cut off level with the clock above it rather than a cell
// short of it — one line down the screen instead of two a cell apart.
//
// Nothing is set against that edge, which is what makes it the body's to take.
// These are left-aligned columns: their right-hand end is where the text is cut
// and not a margin type has to clear, so the gutter the body used to keep there
// was room held for a line that is never drawn from that side.
//
// It is a real edge rather than a nominal one, and that is the other half of it:
// the body is cut in pixels (see metrics.ts), so a line with more to say ends on
// this edge rather than the fifty-odd pixels inside it that a cell's rounding
// used to leave. Move it and a reading moves with it.
const READING_LABEL_KEYS: Array<keyof Translations> = [
  "clock.title",
  "location.fix",
  "weather.title",
  "weather.forecast",
  "warnings.title",
  "warnings.short",
  "nearby.title",
  "world.title",
  "news.title",
  "events.title",
  "trends.title",
  "messages.title",
  "posts.title",
  "people.title",
  "cafe.title",
  "food.title",
  "compose.sendTo",
  "compose.replyUnder",
];
const LABEL_CELLS = Math.max(
  10,
  Math.ceil(
    Math.max(
      ...Object.values(TRANSLATIONS).flatMap((dict) =>
        READING_LABEL_KEYS.map((key) => textWidth(dict[key])),
      ),
    ) / CHAR_WIDTH,
  ),
);
const READING_GAP = EDGE + LABEL_CELLS * CHAR_WIDTH + CHAR_WIDTH;

export const READING_LABELS: Rect = {
  x: EDGE,
  y: BODY_Y,
  width: LABEL_CELLS * CHAR_WIDTH,
  height: BODY_HEIGHT,
};
export const READING_VALUES: Rect = {
  x: READING_GAP,
  y: BODY_Y,
  // To the inside of the border, which is where a line of the body ends
  // whatever shape the body is (see above).
  width: INNER_RIGHT - READING_GAP,
  height: BODY_HEIGHT,
};

/**
 * How wide a line of the body is: the gutter it starts on to the inside of the
 * border it is cut at (see above). What a note and a post are wrapped against,
 * and how wide an entry of a list is drawn.
 */
export const BODY_WIDTH = INNER_RIGHT - EDGE;

// The body of a *list* screen, which is the other shape a body comes in: three
// big rows instead of seven small ones.
//
// A summary page has to get five subjects onto one screen and gives each of them
// a line. A list has one subject and a reader picking through it, and the same
// seven lines spent on seven entries makes every entry a clipped half-sentence
// with nothing to tell it from the one above. So an entry here gets two lines —
// who said it and when, then what they said — and three of them fill the screen
// with air between, which is what makes one of them the thing the reader is
// looking at rather than a row in a table.
//
// Every number below is arithmetic off the two above it. Seven lines take three
// entries of two, and what is left over is 28 pixels — half a line — which goes
// between them rather than under them: air inside the list is what separates the
// entries, and air at the bottom would only be a short page.
export const ITEM_LINES = 2;
export const ITEMS_PER_SCREEN = Math.floor(BODY_LINES / ITEM_LINES);
const ITEM_HEIGHT = ITEM_LINES * LINE_HEIGHT;
const ITEM_GAP = Math.floor((BODY_HEIGHT - ITEMS_PER_SCREEN * ITEM_HEIGHT) / (ITEMS_PER_SCREEN - 1));

/** Where the nth entry on a list screen stands, counting from the top of the body. */
export function itemRect(slot: number): Rect {
  return {
    x: EDGE,
    y: BODY_Y + slot * (ITEM_HEIGHT + ITEM_GAP),
    width: BODY_WIDTH,
    height: ITEM_HEIGHT,
  };
}

/**
 * The whole body, for the screen that is one thing read rather than a list of
 * them. Left against the margin where the labels start, not centred like a note:
 * this is the words themselves, and words are read from a left edge.
 */
export const PROSE: Rect = { x: EDGE, y: BODY_Y, width: BODY_WIDTH, height: BODY_HEIGHT };

// The square map beside an open venue — the one picture in the app, drawn into
// image containers rather than out of type (see navmap.ts). It stands where
// the right-hand half of a venue's reading screen was always empty: the body
// there is two short lines, a distance and a pair of coordinates, and the rest
// of the prose rect was air.
//
// The body's own height, top and bottom on the body's own lines — the same
// vertical the text on its left runs between, so the picture and the column
// read as two answers sharing one page rather than a page with a sticker on it.
// That is taller than the 144 the firmware allows one image container (20–144,
// where text has no such ceiling), so the square goes to the glasses as two
// stacked slices of one bitmap, cut where the containers are made (see
// layout.ts). Hung on the same ten-pixel gutter the type keeps at the left of
// the screen, so the picture's right margin and the column's left margin are
// one number — and the picture's own edge never sits close enough to the frame
// to read as one thick line.
export const NAV_MAP: Rect = {
  x: SCREEN_WIDTH - EDGE - BODY_HEIGHT,
  y: BODY_Y,
  width: BODY_HEIGHT,
  height: BODY_HEIGHT,
};

// How wide a line of the body is where the map stands beside it: the same
// gutter to a character of air short of the picture. The words on a venue's
// screen are short — a distance, then a pair of coordinates — but short is a
// fact about today's data, and a name or a cuisine written long would
// otherwise wrap at the full body and run under the picture (see layout.ts).
export const PROSE_MAP_WIDTH = NAV_MAP.x - CHAR_WIDTH - EDGE;

// The box round whatever the wheel is pointing at: a group on a summary page, an
// entry on a list. The one piece of ink in this app that is not the frame and not
// type.
//
// **Why a box at all, when there is brightness.** Brightness is this display's
// only weight and much the cheaper mark — but a summary row is a quiet word in
// the margin beside a bright reading, two columns which are two containers, and
// a container is one brightness for all seven of its lines. There is no way to
// light one row of a column. The box exists because that screen needed a pointer
// and brightness could not be one.
//
// **And why it then follows the reader down**, onto the list screen, where every
// entry is a container of its own and brightness would have done. Because it is
// the same gesture. The reader picks a group out of a page, taps, and goes on
// picking — an entry out of a list — and a pointer that changed its shape half
// way through that would be two pointers to learn instead of one. The brightness
// is still there underneath it, saying the same thing twice on the one screen
// that can afford to.
//
// It is drawn a hair outside the rows rather than round them exactly, out of the
// twelve pixels of air the body keeps from the heading and the footer, so the box
// has somewhere to be that is not on top of the type.
//
// All three of those pixels below it and none above, and the lopsidedness is the
// point. A line of this face is not ink from top to bottom: the type is set six
// pixels down from the top of the line and runs to the bottom of it (see
// docs/Screen.md), so a box drawn evenly round a line is a box with all its
// daylight above the letters and none under them. The air has to come off the top
// for the two gaps to look like one another, and how much is an eye's answer
// rather than an arithmetic one — read off the panel a pixel at a time, which is
// the only way there is to settle it.
//
// There is one pixel left in this direction and then no more. A box round one row
// is thirty pixels now, and twenty-nine is the least a bordered box can be before
// the line inside it grows a scroll bar and clips the row the box was pointing
// at. Past that the bottom edge has to come down with the top.
const SELECT_AIR = 3;
const SELECT_AIR_TOP = 0;

// And sideways it stands half way between the frame and the first character of
// the line, which is the only place it can stand without reading as something
// else. Against the frame it would be a second line a pixel inside the first —
// two borders that close together are one thick border with a fault in it — and
// against the text it would be a box the type is touching.
const SELECT_X = Math.round((INSET + FRAME_BORDER_WIDTH + EDGE) / 2);

/**
 * The box, round whatever is being pointed at. It runs the width of the screen
 * wherever it appears, because the thing being chosen is the whole row: the word
 * in the margin and the reading beside it are one answer, and a box round half
 * of it would be a box round half an answer.
 */
function boxAround(y: number, height: number): Rect {
  return {
    x: SELECT_X,
    y: y - SELECT_AIR_TOP,
    width: SCREEN_WIDTH - 2 * SELECT_X,
    height: height + SELECT_AIR_TOP + SELECT_AIR,
  };
}

/** Round `count` rows of a summary page, starting at `first` — one whole group. */
export function selectRect(first: number, count: number): Rect {
  return boxAround(BODY_Y + first * LINE_HEIGHT, count * LINE_HEIGHT);
}

/** Round one entry of a list, which is a block of two lines rather than rows. */
export function selectItemRect(slot: number): Rect {
  const { y, height } = itemRect(slot);
  return boxAround(y, height);
}

/**
 * A sentence where a page would otherwise be empty, in the middle of the screen.
 * A page with one line on it has no columns to line that line up with, and left
 * against the margin where the readings usually start it reads as the first row
 * of a list that failed to draw the rest of itself. In the middle it reads as
 * what it is: the whole of what this screen has to say.
 *
 * Centred by measuring, because the display has no alignment to set — the box is
 * cut to the width of the widest line it holds and put half of what is left over
 * from either edge. The measure over-estimates every character it has not been
 * given a width for, so the box is never too narrow for its text; it is only ever
 * a few pixels wider, and the sentence sits that much left of true centre (see
 * metrics.ts).
 */
export function noteRect(lines: string[]): Rect {
  const text = Math.max(1, ...lines.map(textWidth));
  const height = Math.max(1, lines.length) * LINE_HEIGHT;
  // The box gets a cell of slack and the text does not: a box cut to exactly the
  // width of what it holds wraps the moment either is a pixel out, and a wrapped
  // line in a box one line tall is a scroll bar. Hung from the left edge the text
  // would sit at, so the slack goes on the right where nothing is looking rather
  // than half a cell into the centring.
  return {
    x: Math.round((SCREEN_WIDTH - text) / 2),
    y: Math.round(BODY_Y + (BODY_HEIGHT - height) / 2),
    width: Math.min(BODY_WIDTH, text + CHAR_WIDTH),
    height,
  };
}

/**
 * How wide a plain container is, in character cells. Neither the body nor the
 * footer is cut this way any more — both have an edge of their own and are cut
 * to the pixel against it (see metrics.ts) — and what is left is the heading,
 * which is cut against a corner laid over its own rect and has nowhere but this
 * over-estimate to get the air between them from.
 */
export function cellsIn(width: number): number {
  return Math.max(1, Math.floor(width / CHAR_WIDTH));
}

/**
 * How wide the *frame* is inside its own border and padding. It is the one
 * container that keeps a gutter of its own, so it holds fewer cells than its
 * width alone suggests — and a heading measured against the wrong number is a
 * heading that runs into the edge of the box it is written in.
 */
export function frameCells(): number {
  return cellsIn(FRAME.width - (FRAME_PADDING + FRAME_BORDER_WIDTH) * 2);
}

/**
 * How much of that the *title* may actually have. Rather less, and this is the
 * number the heading is cut to: the frame runs the whole width of the screen, but
 * the badge and the clock are a separate container laid over the far end of the
 * same line, so a title measured against the frame alone is a place name that
 * runs underneath the hour. A cell of air is kept between the two, which is what
 * the last term is.
 */
export function titleCells(): number {
  return cellsIn(HEAD_TIME.x - EDGE - CHAR_WIDTH);
}

// Container identity. The ids are fixed rather than handed out as containers are
// built, because an update addresses a container by id: a page turn that
// renumbered them would write the posts into the heading. Reused across pages on
// purpose — every page is the same shape, so a turn is text written into the
// containers already up rather than a page built again (see paint.ts).
export const CONTAINER = {
  /** The box round the screen, which is also where the heading is written. */
  frame: 1,
  headMeta: 2,
  /** The right-hand corner of the heading: the unread badge and the hour, in one. */
  headTime: 3,
  footLine: 4,
  /** The other corner of the footer: the path, and how far through this level. */
  footTrail: 5,
  // The body, and there are three ids for it because there are three shapes it
  // comes in and never two at once: a column of labels beside a column of the
  // lines they name, three big entries of a list, or the one block of type a
  // screen showing a single thing is — with the sentence a page puts up when it
  // cannot draw at all standing in the last of them.
  //
  // Sharing the ids is the point rather than an economy: stepping from a list to
  // the entry it was pointing at is a body of one container where there were
  // three, and the two that go are two ids the firmware already has (see
  // paint.ts).
  labels: 6,
  values: 7,
  note: 8,
  /** The one block of type, where the labels would otherwise start. */
  prose: 6,
  /** The three entries of a list, standing where all of those do. */
  items: [6, 7, 8],
  // The box round whatever the wheel is pointing at, which is the one container
  // in the app that holds nothing and is laid over the rest rather than standing
  // beside it. It cannot borrow a body id the way the others do — on a list
  // screen all three are spoken for — so it takes the heading's spare one, which
  // is spare on exactly the screens a box can appear on: a page with something to
  // say about itself in its heading is the standing page or a screen being read,
  // and neither of those has anything to point at. Give a page with groups a
  // `meta` and this is the line that has to change.
  select: 2,
  /**
   * The map beside an open venue — the app's image containers, so they share no
   * id with any of the text above: the eight-text budget is spent on type, and
   * the firmware counts images against a ceiling of their own (four, of which
   * these are two). Two, because the square is taller than one container may
   * be: it is one bitmap cut into stacked slices, one id per slice, in order
   * from the top (see NAV_MAP above and layout.ts).
   */
  map: [9, 10],
} as const;
