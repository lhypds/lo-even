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
// Five containers of chrome and at most three of body, which is the eight the
// firmware allows and not one more. The chrome is the same on every screen in
// the app — a frame with the heading written in it, what the screen has to say
// about itself over the end of that line, the unread badge and the hour in the
// corner beyond it, a footer line with where you are standing on it, and the
// path in the corner beyond that — so the reader is never learning a new
// arrangement, and the painter can write a changed line into a container that is
// already up rather than building the page again.
//
// What the three body containers are used for is the only thing that changes: a
// column of labels beside a column of readings, three big entries of a list, or
// one block of type being read. A screen that wants all five pieces of chrome
// and three of body is exactly full, which is why the compass is in the heading
// of the standing page rather than on a line of its own, and why a list names
// its group in the heading rather than in a margin beside it.
//
// The badge and the clock share the corner's one container rather than taking two
// of them, and that is about spacing rather than about the budget: see theme.ts,
// where the reason a gap between two boxes on this screen cannot be held still is
// written down.

import { clip, clipCells, padLeft, wrap } from "./metrics";
import {
  BODY_LINES,
  BODY_WIDTH,
  CONTAINER,
  FAINT,
  FRAME,
  FRAME_PADDING,
  HEAD_META,
  HEAD_TIME,
  INK,
  ITEMS_PER_SCREEN,
  MUTED,
  PROSE,
  READING_LABELS,
  READING_VALUES,
  cellsIn,
  footLineRect,
  itemRect,
  titleCells,
  noteRect,
  selectItemRect,
  selectRect,
  trailRect,
  trailSlot,
  type Rect,
} from "./theme";
import { spans } from "./pages/stack";
import type { Block, Item, PageView, ReadingRow } from "./pages/types";

/** One text container, ready to be created or updated. */
export interface Panel {
  id: number;
  rect: Rect;
  text: string;
  brightness: number;
  /**
   * Whether this container draws a box. Two do: the frame round the screen, and
   * the one round the group the reader is choosing on a summary page.
   */
  bordered: boolean;
  /**
   * The gutter it keeps inside its own edges, charged on all four sides. Only the
   * frame wants one — a body column is placed where it is meant to be and padding
   * would shift it off the grid the columns share — and the selection box must
   * not have one at any price: padding comes out of the content box, a content
   * box shorter than a line grows a scroll bar, and a box round one row is
   * exactly one line tall (see docs/Screen.md).
   */
  padding: number;
  zOrder: number;
}

/**
 * How many steps of the wheel this screen is worth, and what one step means
 * depends on what is on it.
 *
 * A summary page is built to come in at or under the seven lines there are, so
 * in practice it is one — but a page that grew an eighth row is paginated rather
 * than cut off, because a line dropped without trace is the one failure this
 * display cannot show. A list is one step per entry: the wheel moves the reader
 * from one to the next, and three of them are on screen at a time so the step is
 * usually the highlight moving rather than the screen changing. A thing being
 * read is one step per screenful of it, which is how a post longer than the
 * screen is read to the end rather than cut off at it.
 */
/**
 * A body broken to the width of the line, with its own paragraph breaks kept.
 *
 * `wrap` collapses whitespace, which is right everywhere else in this app — a
 * heading, a summary line and a list row are each one run of words, and a stray
 * newline in one of them is a mistake to be swallowed. The reading screen is the
 * exception: what arrives here is a story somebody wrote in paragraphs, and run
 * together they are fifteen screenfuls of unbroken text with nothing to hold on
 * to. So the breaks are honoured here and nowhere else, by wrapping each
 * paragraph on its own and laying the results end to end.
 *
 * No blank line between them. The body is five lines deep and a rule of air
 * every paragraph would spend a fifth of the screen saying nothing; a paragraph
 * starting at the margin after a short line is break enough at this size.
 */
function proseLines(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((paragraph) => wrap(paragraph, BODY_WIDTH));
}

export function screens(view: PageView): number {
  switch (view.block.kind) {
    case "note":
      return 1;
    case "items":
      return Math.max(1, view.block.items.length);
    case "prose":
      return Math.max(1, Math.ceil(proseLines(view.block.text).length / BODY_LINES));
    default:
      return Math.max(1, Math.ceil(view.block.rows.length / BODY_LINES));
  }
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
   * Where in the app this screen is — `lo/`, `lo/nearby`, `lo/nearby/msg`.
   * Left off by a screen that is nowhere in it, which is the composer: it takes
   * the display over rather than standing anywhere, and it has its own way out.
   */
  path?: string;
  /**
   * Where this screenful stands in the level the path names, one-based — and
   * left off with the path, for the same reason. A `1/1` in the corner of the
   * composer would be an answer to a question the reader is not being asked
   * (see glasses.ts).
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
  padding = 0,
): Panel {
  return { id, rect, text, brightness, bordered, padding, zOrder };
}

/** The frame, the heading and the footer, which every page wears identically. */
function chromePanels(view: PageView, chrome: Chrome): Panel[] {
  const panels: Panel[] = [
    // The one box on the screen, and the heading is written in it: the frame is a
    // container like any other, and a container with a border and a line of text
    // is a box with a heading in the corner of it.
    //
    // Cut to the room before the corner rather than to the width of the frame,
    // which is the whole screen: the badge and the hour are their own container
    // laid over the far end of this same line, and a title measured against the
    // box it is written in is a place name that runs underneath the clock (see
    // titleCells in theme.ts).
    panel(CONTAINER.frame, FRAME, clipCells(view.title, titleCells()), INK, 0, true, FRAME_PADDING),
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
  // happening to it. What it may not run into is the path in the corner beyond
  // it, so it is cut to whatever that has left it (see theme.ts).
  const path = chrome.path ?? "";
  const footLine = footLineRect(path);
  const foot = chrome.status || view.context || chrome.place;
  panels.push(panel(CONTAINER.footLine, footLine, clipCells(foot, cellsIn(footLine.width)), MUTED, 3));

  // Where the reader is standing in the app, and how far through it. Faint,
  // because it is the one thing on the screen that is about the app rather than
  // about the world: a reader who wants it can find it, and a reader reading a
  // post is not competing with it.
  if (path) {
    const counter = chrome.index != null && chrome.total != null ? ` · ${chrome.index}/${chrome.total}` : "";
    panels.push(
      panel(
        CONTAINER.footTrail,
        trailRect(path),
        padLeft(`${path}${counter}`, trailSlot(path)),
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
/** Which of a page's rows this screenful of it is showing. */
function shownRows(block: Extract<Block, { kind: "readings" }>, screen: number): ReadingRow[] {
  return block.rows.slice(screen * BODY_LINES, screen * BODY_LINES + BODY_LINES);
}

function readingPanels(block: Extract<Block, { kind: "readings" }>, screen: number): Panel[] {
  const rows = shownRows(block, screen);
  if (rows.length === 0) return [];
  return [
    panel(
      CONTAINER.labels,
      READING_LABELS,
      rows.map((row) => clip(row.label, READING_LABELS.width)).join("\n"),
      MUTED,
      5,
    ),
    panel(
      CONTAINER.values,
      READING_VALUES,
      rows.map((row) => clip(row.value, READING_VALUES.width)).join("\n"),
      INK,
      6,
    ),
  ];
}

/**
 * The one mark in this app that is not brightness: a box round whatever the
 * wheel is pointing at. It is laid over what is already on the screen rather
 * than replacing any of it — nothing about a row or an entry changes when the
 * box arrives, which is the whole point of a pointer.
 *
 * It holds a space rather than nothing at all. There is no text to put in it —
 * the words are already on the screen underneath — and a container with a
 * genuinely empty string is the one thing on this display nobody has held a
 * screenshot up to (see docs/Screen.md); a space is a string, and it draws no
 * ink.
 */
function box(rect: Rect): Panel {
  return panel(CONTAINER.select, rect, " ", MUTED, 8, true);
}

/**
 * The box round the group the reader is choosing, on a summary page.
 *
 * A group that is not on this screenful gets no box rather than a box at the
 * edge. In practice every summary page fits in one screenful and there is no
 * such group, and a page that grew an eighth row should paginate rather than
 * point at something the reader cannot see.
 */
function selectPanel(rows: ReadingRow[], select: number): Panel[] {
  const span = spans(rows)[select];
  return span ? [box(selectRect(span.first, span.count))] : [];
}

/**
 * Three entries of a list, and which of them the reader is on.
 *
 * **A container each, rather than two columns.** Everywhere else on this display
 * a row is a quiet word beside a bright reading, because one container is one
 * brightness and that is the only weight there is. Here the unit is the entry
 * rather than the line, so the entry is the container — which buys something a
 * table of readings cannot have: the entry under the reader written in ink with
 * the two beside it muted.
 *
 * **And the box as well.** Brightness alone was enough to say which entry the
 * wheel is on, and it is still doing that; what it could not do is say that this
 * is the *same gesture* as the one a level up. The reader picked a group out of
 * the page with a box round it, tapped, and is now picking an entry out of a
 * list — one motion, and it should not change its mark half way through. So the
 * box follows them down, and `●` is left to mean the only thing it means on
 * these screens, which is that nobody has read this yet.
 *
 * **The window.** The reader is kept in the middle where there is a middle to be
 * in, so there is always the next entry to move onto and the last one to come
 * back to. At either end of the list the window stops and the highlight walks
 * the last three on its own — a list that scrolled past its own end to keep a
 * cursor centred would be two blank rows and a reader wondering what went.
 */
function itemPanels(items: Item[], focus: number): Panel[] {
  const width = itemRect(0).width;
  const start = Math.max(0, Math.min(focus - 1, items.length - ITEMS_PER_SCREEN));
  const panels = items.slice(start, start + ITEMS_PER_SCREEN).map((item, slot) =>
    panel(
      CONTAINER.items[slot],
      itemRect(slot),
      `${clip(item.head, width)}\n${clip(item.line, width)}`,
      start + slot === focus ? INK : MUTED,
      5 + slot,
    ),
  );
  if (focus >= start && focus < start + panels.length) {
    panels.push(box(selectItemRect(focus - start)));
  }
  return panels;
}

/**
 * One thing, read. The whole body given over to it, broken to the width of the
 * line and cut into screenfuls where it runs longer than the screen — which a
 * post is allowed to, at five hundred characters against this display's three
 * hundred-odd cells.
 *
 * Written in ink and left against the margin. It is not a note and must not read
 * as one: a note is the screen apologising for having nothing, and this is the
 * one screen in the app that has exactly what the reader asked for.
 */
function prosePanels(block: Extract<Block, { kind: "prose" }>, screen: number): Panel[] {
  const lines = proseLines(block.text).slice(screen * BODY_LINES, screen * BODY_LINES + BODY_LINES);
  if (lines.length === 0) return [];
  return [panel(CONTAINER.prose, PROSE, lines.join("\n"), INK, 5)];
}

/**
 * The sentence a page puts up when it cannot draw at all. Broken to the width of
 * the body first and then hung in the middle of the screen around however many
 * lines that turned out to be (see theme.ts).
 */
function notePanels(block: Extract<Block, { kind: "note" }>): Panel[] {
  const lines = wrap(block.text, BODY_WIDTH, BODY_LINES);
  return [panel(CONTAINER.note, noteRect(lines), lines.join("\n"), MUTED, 7)];
}

/**
 * One screenful: the heading, the body, the footer. `screen` is where in this
 * page the reader has got to, and each shape of body reads it as the thing it
 * counts in — the screenful of a long page, the entry of a list, the screenful
 * again of something being read (see `screens`).
 *
 * `select` is the one thing on top of all that: which group of a summary page has
 * a box round it, where the reader is choosing between them. Left off everywhere
 * else, which is every screen but that one.
 */
export function layout(view: PageView, screen: number, chrome: Chrome, select?: number): Panel[] {
  const panels = chromePanels(view, chrome);
  const { block } = view;
  panels.push(
    ...(block.kind === "note"
      ? notePanels(block)
      : block.kind === "items"
        ? itemPanels(block.items, screen)
        : block.kind === "prose"
          ? prosePanels(block, screen)
          : readingPanels(block, screen)),
  );
  if (select != null && block.kind === "readings") {
    panels.push(...selectPanel(shownRows(block, screen), select));
  }
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
    .map(({ id, rect, brightness, bordered, padding, zOrder }) =>
      [id, rect.x, rect.y, rect.width, rect.height, brightness, bordered ? 1 : 0, padding, zOrder].join(","),
    )
    .join("|");
}
