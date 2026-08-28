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
 */
const CORNER_SLOT = textWidth("msg (99+) · 00:00");

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
 * how far through this level of it — `lo/nearby/messages · 3/9`.
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
 */
export function trailSlot(path: string): number {
  return path ? textWidth(`${path} · `) + PAGER_SLOT : 0;
}

export function trailRect(path: string): Rect {
  const slot = trailSlot(path);
  return { x: INNER_RIGHT - slot, y: FOOT_Y, width: slot, height: LINE_HEIGHT };
}

/**
 * What is left of the footer for the place you are standing in — the rest of the
 * line, ending a cell before the trail begins. Cut against the trail rather than
 * run the whole width underneath it: `lo/nearby/messages · 3/9` is a fifth of
 * this line, and a place name measured against the full width would be a place
 * name with a path written over the end of it.
 */
export function footLineRect(path: string): Rect {
  const slot = trailSlot(path);
  return {
    x: EDGE,
    y: FOOT_Y,
    width: INNER_WIDTH - (slot > 0 ? slot + CHAR_WIDTH : 0),
    height: LINE_HEIGHT,
  };
}

// The body of every page: a word in the margin, and the line that answers it.
// Ten cells of margin because that is the widest any of those words gets in the
// language that needs the most room — メッセージ is five characters and ten cells
// — and every cell left over goes to the line, which is where the readings are.
//
// Left-aligned, both of them, and that is not a small decision: a column pushed
// to the right end with spaces only lands there if a space is exactly as wide as
// this file thinks it is, and it is not (see CHAR_WIDTH). A column that starts
// where its container starts lands where it is meant to whatever face the
// firmware is setting.
const LABEL_CELLS = 10;
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
  width: SCREEN_WIDTH - EDGE - READING_GAP,
  height: BODY_HEIGHT,
};

/** How wide a line of the body is — what a note is wrapped against. */
export const BODY_WIDTH = INNER_WIDTH;

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
    width: INNER_WIDTH,
    height: ITEM_HEIGHT,
  };
}

/**
 * The whole body, for the screen that is one thing read rather than a list of
 * them. Left against the margin where the labels start, not centred like a note:
 * this is the words themselves, and words are read from a left edge.
 */
export const PROSE: Rect = { x: EDGE, y: BODY_Y, width: INNER_WIDTH, height: BODY_HEIGHT };

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

/** How wide a plain container is, in character cells. */
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
} as const;
