// Where everything on the glasses stands, in one place.
//
// The display has no font sizes. A text container takes a position, a size, a
// border and a brightness, and that is the whole of the vocabulary — so
// everything lo does with weight and scale on a phone has to be said here with
// position and brightness instead. The three that carry it:
//
//   • Columns. A list row is not one string with spaces in it but three
//     containers side by side, which is what lets the middle one be bright while
//     the two either side stay quiet. Rows line up because each column is one
//     container holding one line per row.
//   • Brightness. 0–4, and lo's own two inks map straight onto it: --ink is
//     INK, --muted is MUTED. A label is never the same weight as its value.
//   • Bands. The heading and the footer are boxes with a border; the body floats
//     between them. That border is the rule under lo's card headings, drawn the
//     only way a display with no line-drawing can draw one.
//
// Everything below is measured in whole lines and whole cells, because a layout
// that lands half a line short reads as a bug rather than as air.

/** The G2 canvas. Nothing may be positioned outside it. */
export const SCREEN_WIDTH = 576;
export const SCREEN_HEIGHT = 288;

// One character cell. The display sets its text in a fixed-width face, so a
// column count is a pixel count divided by this — which is what makes the
// right-aligned halves of the heading and the footer land where they are meant
// to. If a firmware ever changes the face, this is the one number to change.
export const CHAR_WIDTH = 12;

// The line, measured rather than assumed. A text container lays its lines out at
// the font's own pitch and shows a scroll bar the moment they do not fit, so a
// box that is a pixel short of one line is a box with a bar down its right-hand
// edge and a clipped line inside it — which is exactly what the bands were (see
// BAND_HEIGHT). 27 is what the Even Hub simulator draws, for Latin and for CJK
// alike: two lines in a plain container land 27 apart, and a container whose
// content box is 27 holds one line with no bar where 26 does not. Re-measure it
// against a pair of glasses before trusting it on glass — everything vertical on
// this screen is derived from it, so a firmware that sets its type differently is
// this one number.
export const LINE_HEIGHT = 27;

/** The gutter every band and column keeps from the edge of the screen. */
export const EDGE = 10;

// Brightness, which is the only weight this display has. The names are lo's own
// so that a card written against the website reads the same here: what is --ink
// there is INK here, and what is --muted there is MUTED.
export const INK = 4;
export const MUTED = 2;
export const FAINT = 1;

// What a band is drawn with. Kept together and named, because whether the
// heading wears a box at all is the one judgement in this file that is taste
// rather than arithmetic — a see-through display charges for every lit pixel,
// and if the boxes turn out to be too much ink on real glass, this is the line
// to change rather than the layout.
export const BAND_BORDER_WIDTH = 1;
export const BAND_BORDER_COLOR = 5;
export const BAND_BORDER_RADIUS = 9;

// The three bands, inset by a pixel so a border is never clipped by the edge of
// the panel.
const INSET = 1;

// The gutter a band keeps inside its own border. Derived rather than chosen, so
// that a band's first character lands on EDGE — the same column the body's
// left-hand list starts in. A heading that began a pixel or two off the list
// under it would read as two layouts sharing a screen.
export const BAND_PADDING = EDGE - INSET - BAND_BORDER_WIDTH;

// A band is one line of type and the box it sits in, and nothing else decides
// its height: the padding is charged on the top and the bottom as well as the
// sides, so a band that looks tall enough for its line can still be several
// pixels short of one inside its own border — and a text container that is short
// of its content does not simply crop, it grows a scroll bar. That is what the
// heading and the footer were: 34 pixels with 22 of them spent on the border and
// the gutter, leaving 12 for a 27-pixel line.
export const BAND_HEIGHT = LINE_HEIGHT + (BAND_PADDING + BAND_BORDER_WIDTH) * 2;

// Air between a band and the body, so the two rules are not read as the edges of
// the list rather than as the edges of the screen.
const BODY_GAP = 2;

// What is left over is the body, and how many lines that is worth is arithmetic
// rather than a decision: 288 is 1 + 45 + 2 + 192 + 2 + 45 + 1 and the middle of
// that is seven lines with three pixels to spare. Widen the bands and the body
// loses a line here rather than silently losing it on the glasses.
export const BODY_Y = INSET + BAND_HEIGHT + BODY_GAP;
export const BODY_HEIGHT = SCREEN_HEIGHT - (BODY_Y + BODY_GAP + BAND_HEIGHT + INSET);
export const BODY_LINES = Math.floor(BODY_HEIGHT / LINE_HEIGHT);

/**
 * A rectangle on the screen, in pixels. Written out rather than computed at the
 * call site so that every band and column in the app can be read off one page.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const BAND_WIDTH = SCREEN_WIDTH - INSET * 2;

/** The heading band: a bordered box across the top, holding the card's name. */
export const HEAD_BAND: Rect = { x: INSET, y: INSET, width: BAND_WIDTH, height: BAND_HEIGHT };

// The heading's right end, laid over the band rather than beside it. Two
// bordered boxes side by side would draw a rule down the middle of the heading;
// one box with a borderless container on top of it draws the band once and lets
// the meta be quieter than the title. That is what zOrderIndex is for.
//
// Set on the band's own line rather than centred in the band, because the
// display sets text from the top of a container down: the band starts its line
// under its border and its padding, and an overlay that started at the top of
// the box would sit that much higher than the title it is meant to be level
// with. One line tall for the same reason — the room below it is the band's, not
// this container's.
const bandLine = (band: Rect): number => band.y + BAND_BORDER_WIDTH + BAND_PADDING;

export const HEAD_META: Rect = {
  x: SCREEN_WIDTH / 2,
  y: bandLine(HEAD_BAND),
  width: SCREEN_WIDTH / 2 - EDGE,
  height: LINE_HEIGHT,
};

/** The footer band, built the same way as the heading and for the same reasons. */
export const FOOT_BAND: Rect = {
  x: INSET,
  y: BODY_Y + BODY_HEIGHT + BODY_GAP,
  width: BAND_WIDTH,
  height: BAND_HEIGHT,
};
export const FOOT_PAGER: Rect = {
  x: SCREEN_WIDTH - EDGE - 160,
  y: bandLine(FOOT_BAND),
  width: 160,
  height: LINE_HEIGHT,
};

// A face — the clock, the weather, the compass. One reading across the top and
// the smaller figures under it, which is lo's own arrangement of those three
// tiles: a big number, a line naming what it is, and the readings along the
// bottom. The gap between them is a whole blank line, because on a screen with
// one type size air is the only way left to group anything.
export const FACE_HERO: Rect = { x: EDGE, y: BODY_Y, width: 280, height: LINE_HEIGHT };
export const FACE_CAPTION: Rect = {
  x: EDGE + 290,
  y: BODY_Y,
  width: SCREEN_WIDTH - EDGE - (EDGE + 290),
  height: LINE_HEIGHT,
};
export const FACE_LABELS: Rect = {
  x: EDGE,
  y: BODY_Y + LINE_HEIGHT * 2,
  width: 260,
  height: LINE_HEIGHT * 5,
};
export const FACE_VALUES: Rect = {
  x: EDGE + 270,
  y: BODY_Y + LINE_HEIGHT * 2,
  width: SCREEN_WIDTH - EDGE - (EDGE + 270),
  height: LINE_HEIGHT * 5,
};

// The same pair of columns with no reading over them, for a card that is all
// readings — the place you are standing in, which has no one figure to lead with.
export const ROWS_LABELS: Rect = { x: EDGE, y: BODY_Y, width: 260, height: BODY_HEIGHT };
export const ROWS_VALUES: Rect = {
  x: EDGE + 270,
  y: BODY_Y,
  width: SCREEN_WIDTH - EDGE - (EDGE + 270),
  height: BODY_HEIGHT,
};

// A sentence where a card would otherwise be empty. Set in from the top rather
// than at it: a lone line of type hard against the heading reads as a row that
// failed to draw the rest of its list.
export const NOTE: Rect = {
  x: EDGE,
  y: BODY_Y + LINE_HEIGHT,
  width: SCREEN_WIDTH - EDGE * 2,
  height: LINE_HEIGHT * 5,
};

/** How wide a plain container is, in character cells. */
export function cellsIn(width: number): number {
  return Math.max(1, Math.floor(width / CHAR_WIDTH));
}

/**
 * How wide a *band* is inside its own border and padding. A band is the one kind
 * of container that keeps a gutter of its own, so it holds fewer cells than its
 * width alone suggests — and a heading measured against the wrong number is a
 * heading whose right-aligned half hangs off the edge.
 */
export function bandCells(rect: Rect): number {
  return cellsIn(rect.width - (BAND_PADDING + BAND_BORDER_WIDTH) * 2);
}

// Container identity. The ids are fixed rather than handed out as containers are
// built, because an update addresses a container by id: a card switch that
// renumbered them would write the posts list into the heading. Reused across
// layouts on purpose — only one is ever on screen, and crossing between two is a
// rebuild rather than an update (see paint.ts).
export const CONTAINER = {
  headBand: 1,
  headMeta: 2,
  footBand: 3,
  footPager: 4,
  // The body slots. Which of them exist depends on what the card came back with.
  bodyA: 5,
  bodyB: 6,
  bodyC: 7,
  bodyD: 8,
} as const;
