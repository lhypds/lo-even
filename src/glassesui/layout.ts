// Turning what a page said into rectangles of type.
//
// Everything about fitting lives here and nowhere else: no page knows how wide
// the screen is or which screenful of itself is being looked at. That is what
// keeps a page down to a few dozen lines — it says "these rows, in this order" and
// this decides what that costs.
//
// The output is a flat list of panels. A panel is one text container: where it
// goes, what it says, how bright it is, and whether it draws its own box. The
// painter downstream (paint.ts) is the only thing that knows about the bridge,
// and it can tell a page turn from a clock tick by comparing two of these lists —
// which is what decides between rebuilding the page and updating a line of it.
//
// Seven containers where the firmware allows eight, and the one spare is not an
// oversight: every page here is the same shape — a frame with the heading written
// in it, what the page has to say about itself over the end of that line, the
// unread badge and the hour in the corner beyond it, a footer line with the pager
// on its end, and a column of labels beside a column of readings — so the reader
// is never learning a new arrangement, and the painter can write a changed line
// into a container that is already up rather than building the page again.
//
// The badge and the clock share the corner's one container rather than taking two
// of them, and that is about spacing rather than about the budget: see theme.ts,
// where the reason a gap between two boxes on this screen cannot be held still is
// written down.

import { clip, padLeft, wrap } from "./metrics";
import {
  BODY_LINES,
  BODY_WIDTH,
  CONTAINER,
  FAINT,
  FOOT_LINE,
  FOOT_PAGER,
  FRAME,
  HEAD_META,
  HEAD_TIME,
  INK,
  MUTED,
  READING_LABELS,
  READING_VALUES,
  cellsIn,
  frameCells,
  noteRect,
  type Rect,
} from "./theme";
import type { Block, PageView } from "./pages/types";

/** One text container, ready to be created or updated. */
export interface Panel {
  id: number;
  rect: Rect;
  text: string;
  brightness: number;
  /** The frame draws the one box there is; everything else floats inside it. */
  bordered: boolean;
  zOrder: number;
}

/**
 * How many screenfuls this page is. Every page is built to come in at or under
 * the seven lines there are, so in practice this is always one — but a page that
 * grew an eighth row would be paginated rather than cut off, because a line
 * dropped without trace is the one failure this display cannot show.
 */
export function screens(view: PageView): number {
  if (view.block.kind === "note") return 1;
  return Math.max(1, Math.ceil(view.block.rows.length / BODY_LINES));
}

/** What the footer and the heading carry, which is the driver's to say rather than a page's. */
export interface Chrome {
  /** The place you are standing in — lo's HereStrip, moved to the foot of the screen. */
  place: string;
  /** The hour where that is, which every page wears in the same corner. */
  time: string;
  /** A running commentary that takes the footer over while it has something to say. */
  status: string;
  /**
   * How much is waiting to be read, which every page wears beside the clock. A
   * count rather than a light: nought is drawn as nought, because a badge that
   * disappears when there is nothing in it is a badge a reader has to remember the
   * absence of, and this display has room to simply say so.
   */
  unread: number;
  /**
   * Where this screenful stands in the whole sequence, one-based — and left off
   * altogether by a screen that is not part of one. The composer is the only such
   * screen there is: it takes the display over rather than joining the line of
   * pages, and a `1/1` in the corner of it would be an answer to a question the
   * reader is not being asked (see glasses.ts).
   */
  index?: number;
  total?: number;
}

// The mark in the unread badge, which is a word rather than a picture. There are
// no images on this display and no way to load one, so an icon here can only be a
// character the face actually has — and the shapes that survive are the wrong
// ones. ✉ draws as nothing at all (see the note under the table in metrics.ts),
// and ▤, which stood here in its place, is a ruled box that reads as a list or a
// menu rather than as a mailbox. Three lowercase letters say it outright and cost
// seventeen pixels more than the box did, which the corner has to spare.
const MAIL = "msg";

// Past this, the exact figure has stopped being worth the pixels: a reader with a
// hundred unread messages is being told to open their phone, not being told a
// number. It is also what fixes the width of the badge's slot, so the box never
// moves (see HEAD_MAIL in theme.ts).
const MAIL_MAX = 99;

/** What the badge says, which is a count and never a blank. */
function mailCount(unread: number): string {
  if (!Number.isFinite(unread) || unread <= 0) return "0";
  return unread > MAIL_MAX ? `${MAIL_MAX}+` : String(Math.round(unread));
}

function panel(
  id: number,
  rect: Rect,
  text: string,
  brightness: number,
  zOrder: number,
  bordered = false,
): Panel {
  return { id, rect, text, brightness, bordered, zOrder };
}

/** The frame, the heading and the footer, which every page wears identically. */
function chromePanels(view: PageView, chrome: Chrome): Panel[] {
  const panels: Panel[] = [
    // The one box on the screen, and the heading is written in it: the frame is a
    // container like any other, and a container with a border and a line of text
    // is a box with a heading in the corner of it.
    panel(CONTAINER.frame, FRAME, clip(view.title, frameCells()), INK, 0, true),
  ];

  // The corner, on every page: how much is waiting to be read, then the hour,
  // with a space either side of the dot between them. One string in one container
  // because that is the only way those two spaces stay the size they are written
  // as — two boxes would each be pinned at the right and loose at the left, and
  // the gap between them would have breathed with the hour (see theme.ts).
  //
  // It is the driver's line rather than any page's, because it is the same answer
  // whichever page is up and a page that had to remember to draw it is a page that
  // can forget.
  panels.push(
    panel(
      CONTAINER.headTime,
      HEAD_TIME,
      padLeft(`${MAIL} (${mailCount(chrome.unread)}) · ${chrome.time}`, HEAD_TIME.width),
      MUTED,
      1,
    ),
  );

  // Whatever else the page has to say about itself, ending a space before the
  // clock. Laid over the heading's own line rather than beside it, so that it can
  // be quieter than the title — which one container cannot do (see theme.ts).
  if (view.meta) {
    panels.push(panel(CONTAINER.headMeta, HEAD_META, padLeft(view.meta, HEAD_META.width), MUTED, 2));
  }

  // Whatever is going on takes the footer, and the place has it the rest of the
  // time. One line, because there is one line: a status that appeared *beside*
  // the place would push the place off the screen just when something is
  // happening to it.
  const foot = chrome.status || view.context || chrome.place;
  panels.push(panel(CONTAINER.footLine, FOOT_LINE, clip(foot, cellsIn(FOOT_LINE.width)), MUTED, 3));

  if (chrome.index != null && chrome.total != null) {
    panels.push(
      panel(
        CONTAINER.footPager,
        FOOT_PAGER,
        padLeft(`${chrome.index}/${chrome.total}`, FOOT_PAGER.width),
        FAINT,
        4,
      ),
    );
  }

  return panels;
}

/**
 * A word in the margin and the line that answers it — which is the whole body of
 * every page here. Two containers rather than one, and that is the point of it:
 * it is what lets the label stay quiet while the reading beside it is bright, on
 * a display whose only weight is brightness. The rows line up because they are
 * lines of the same two strings, not because anything measured them against each
 * other.
 *
 * Both columns are left-aligned. A column pushed to the right end with spaces
 * only lands there if a space is exactly as wide as this file thinks it is, and
 * it is not (see CHAR_WIDTH); a column that starts where its container starts
 * lands where it is meant to whatever face the firmware is setting.
 */
function readingPanels(block: Extract<Block, { kind: "readings" }>, screen: number): Panel[] {
  const rows = block.rows.slice(screen * BODY_LINES, screen * BODY_LINES + BODY_LINES);
  if (rows.length === 0) return [];
  const labelCells = cellsIn(READING_LABELS.width);
  const valueCells = cellsIn(READING_VALUES.width);
  return [
    panel(
      CONTAINER.labels,
      READING_LABELS,
      rows.map((row) => clip(row.label, labelCells)).join("\n"),
      MUTED,
      5,
    ),
    panel(
      CONTAINER.values,
      READING_VALUES,
      rows.map((row) => clip(row.value, valueCells)).join("\n"),
      INK,
      6,
    ),
  ];
}

/**
 * The sentence a page puts up when it cannot draw at all. Broken to the width of
 * the body first and then hung in the middle of the screen around however many
 * lines that turned out to be (see theme.ts).
 */
function notePanels(block: Extract<Block, { kind: "note" }>): Panel[] {
  const lines = wrap(block.text, cellsIn(BODY_WIDTH), BODY_LINES);
  return [panel(CONTAINER.note, noteRect(lines), lines.join("\n"), MUTED, 7)];
}

/** One screenful: the heading, the body, the footer. */
export function layout(view: PageView, screen: number, chrome: Chrome): Panel[] {
  const panels = chromePanels(view, chrome);
  panels.push(
    ...(view.block.kind === "note" ? notePanels(view.block) : readingPanels(view.block, screen)),
  );
  return panels;
}

/**
 * What makes two screenfuls the same *page* rather than the same picture: the
 * set of containers and where each of them stands. Equal signatures mean the
 * text can be written straight into the containers already on the glasses;
 * different ones mean the page has to be built again (see paint.ts).
 */
export function signature(panels: Panel[]): string {
  return panels
    .map(({ id, rect, brightness, bordered, zOrder }) =>
      [id, rect.x, rect.y, rect.width, rect.height, brightness, bordered ? 1 : 0, zOrder].join(","),
    )
    .join("|");
}
