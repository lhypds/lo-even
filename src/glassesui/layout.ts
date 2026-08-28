// Turning what a card said into rectangles of type.
//
// Everything about fitting lives here and nowhere else: no card knows how wide
// the screen is, how many rows survive, or which page of itself is being looked
// at. That is what keeps a card down to a dozen lines — `posts` says "these
// rows, in this order" and this decides what that costs.
//
// The output is a flat list of panels. A panel is one text container: where it
// goes, what it says, how bright it is, and whether it draws its own box. The
// painter downstream (paint.ts) is the only thing that knows about the bridge,
// and it can tell a card switch from a clock tick by comparing two of these
// lists — which is what decides between rebuilding the page and updating a line
// of it.

import { cells, clip, padLeft, wrap } from "./metrics";
import {
  BODY_LINES,
  BODY_Y,
  BODY_HEIGHT,
  CHAR_WIDTH,
  CONTAINER,
  EDGE,
  FACE_CAPTION,
  FACE_HERO,
  FACE_LABELS,
  FACE_VALUES,
  FAINT,
  FOOT_BAND,
  FOOT_PAGER,
  HEAD_BAND,
  HEAD_META,
  INK,
  MUTED,
  NOTE,
  ROWS_LABELS,
  ROWS_VALUES,
  SCREEN_WIDTH,
  bandCells,
  cellsIn,
  type Rect,
} from "./theme";
import type { Block, CardView } from "./cards/types";

/** One text container, ready to be created or updated. */
export interface Panel {
  id: number;
  rect: Rect;
  text: string;
  brightness: number;
  /** Bands draw their own box; everything in the body floats. */
  bordered: boolean;
  zOrder: number;
}

/** How many lines of readings a face has room for under its hero. */
const FACE_ROWS = 5;

// The widest the two outer columns of a list are allowed to get. Caps rather
// than sizes — a column is measured off its own rows and only ever meets these
// when something unusually long turns up. The trail is given far more room than
// the lead because one card genuinely needs it: a warning's right-hand end is
// its severity *and* its 警戒レベル ("Danger warning · Level 4"), and cut short
// that is a bulletin that no longer says how bad it is. Everywhere else the
// trail is a distance or an age and comes in under a third of this.
const LEAD_MAX = 12;
const TRAIL_MAX = 24;

/** The whole width available to the body, in cells. */
const BODY_CELLS = cellsIn(SCREEN_WIDTH - EDGE * 2);

/**
 * How many screenfuls this card is. Pure arithmetic on the block, and separate
 * from painting because the driver has to add these up across every card before
 * it can say "3 of 14" on any one of them.
 */
export function pageCount(block: Block): number {
  switch (block.kind) {
    case "face":
      return Math.max(1, Math.ceil(block.rows.length / FACE_ROWS));
    case "rows":
      return Math.max(1, Math.ceil(block.rows.length / BODY_LINES));
    case "list":
      return Math.max(1, Math.ceil(block.rows.length / BODY_LINES));
    case "note":
      return 1;
  }
}

/** What the footer and the heading carry, which is the driver's to say rather than a card's. */
export interface Chrome {
  /** The place you are standing in — lo's HereStrip, moved to the foot of the screen. */
  place: string;
  /** A running commentary that takes the footer over while it has something to say. */
  status: string;
  /** Where this screenful stands in the whole sequence, one-based. */
  index: number;
  total: number;
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

/** The heading and the footer, which every card wears identically. */
function chromePanels(view: CardView, chrome: Chrome): Panel[] {
  const panels: Panel[] = [
    // The band is one bordered box across the full width, and its bottom edge is
    // the rule under lo's card headings — the only way this display can draw one.
    panel(CONTAINER.headBand, HEAD_BAND, clip(view.title, bandCells(HEAD_BAND)), INK, 0, true),
  ];

  // Laid over the band rather than beside it: two boxes side by side would draw
  // a rule down the middle of the heading, and the meta has to be quieter than
  // the title, which one container cannot do (see theme.ts).
  if (view.meta) {
    const width = cellsIn(HEAD_META.width);
    panels.push(panel(CONTAINER.headMeta, HEAD_META, padLeft(view.meta, width), MUTED, 1));
  }

  // Whatever is going on takes the footer, and the place has it the rest of the
  // time. One line, because there is one line: a status that appeared *beside*
  // the place would push the place off the screen just when something is
  // happening to it.
  const foot = chrome.status || view.context || chrome.place;
  panels.push(panel(CONTAINER.footBand, FOOT_BAND, clip(foot, bandCells(FOOT_BAND)), MUTED, 2, true));

  const pagerWidth = cellsIn(FOOT_PAGER.width);
  panels.push(
    panel(
      CONTAINER.footPager,
      FOOT_PAGER,
      padLeft(`${chrome.index}/${chrome.total}`, pagerWidth),
      FAINT,
      3,
    ),
  );

  return panels;
}

/** A reading across the top and the figures under it — the clock, the weather, the compass. */
function facePanels(block: Extract<Block, { kind: "face" }>, page: number): Panel[] {
  const panels: Panel[] = [
    panel(CONTAINER.bodyA, FACE_HERO, clip(block.hero, cellsIn(FACE_HERO.width)), INK, 4),
  ];
  if (block.caption) {
    panels.push(
      panel(CONTAINER.bodyB, FACE_CAPTION, clip(block.caption, cellsIn(FACE_CAPTION.width)), MUTED, 5),
    );
  }

  const rows = block.rows.slice(page * FACE_ROWS, page * FACE_ROWS + FACE_ROWS);
  if (rows.length > 0) {
    const labelCells = cellsIn(FACE_LABELS.width);
    const valueCells = cellsIn(FACE_VALUES.width);
    panels.push(
      panel(
        CONTAINER.bodyC,
        FACE_LABELS,
        rows.map((row) => clip(row.label, labelCells)).join("\n"),
        MUTED,
        6,
      ),
      panel(
        CONTAINER.bodyD,
        FACE_VALUES,
        // Hard against the right, which is where lo's own `dd` sits. Two ragged
        // columns of figures would be two lists rather than one readout.
        rows.map((row) => padLeft(row.value, valueCells)).join("\n"),
        INK,
        7,
      ),
    );
  }
  return panels;
}

/** The same pair of columns with nothing over them. */
function rowsPanels(block: Extract<Block, { kind: "rows" }>, page: number): Panel[] {
  const rows = block.rows.slice(page * BODY_LINES, page * BODY_LINES + BODY_LINES);
  const labelCells = cellsIn(ROWS_LABELS.width);
  const valueCells = cellsIn(ROWS_VALUES.width);
  return [
    panel(
      CONTAINER.bodyC,
      ROWS_LABELS,
      rows.map((row) => clip(row.label, labelCells)).join("\n"),
      MUTED,
      6,
    ),
    panel(
      CONTAINER.bodyD,
      ROWS_VALUES,
      rows.map((row) => padLeft(row.value, valueCells)).join("\n"),
      INK,
      7,
    ),
  ];
}

/**
 * Three columns, and this is the whole reason the body is built out of separate
 * containers rather than one: it is what lets a username stay quiet while the
 * post beside it is bright. One container per column, one line per row — so the
 * rows line up because they are lines of the same three strings, not because
 * anything measured them against each other.
 *
 * The widths are measured off the rows rather than fixed. A fixed lead column
 * would be a stripe of empty screen on the cards that have no lead at all (see
 * people), and a fixed trail would cut "12.3 km · 2h" down to nothing on the
 * ones that need it.
 */
function listPanels(block: Extract<Block, { kind: "list" }>, page: number): Panel[] {
  const rows = block.rows.slice(page * BODY_LINES, page * BODY_LINES + BODY_LINES);
  if (rows.length === 0) return [];

  // Measured in cells, which is the only measure that means anything here: 警報
  // · レベル3 is eight characters and thirteen cells, and a column sized to the
  // eight would clip a warning down to 警報 · レ… while the screen beside it sat
  // empty. The widest row sets the column, because a column that does not fit
  // its widest row is not a column.
  //
  // Measured over the whole list rather than over this page of it. Per page it
  // packs slightly better, and it makes the columns move every time the reader
  // scrolls — a name column a cell narrower on page two because the longest name
  // happened to be on page one, which reads as the list twitching. Steady
  // columns also mean every page of one card has the same geometry, so turning
  // between them writes new text into the containers already up rather than
  // building the page again (see paint.ts).
  const widest = (pick: (row: (typeof rows)[number]) => string | undefined, cap: number) =>
    Math.min(
      cap,
      block.rows.reduce((most, row) => {
        const value = pick(row);
        return value ? Math.max(most, cells(value)) : most;
      }, 0),
    );

  const leadCells = widest((row) => row.lead, LEAD_MAX);
  const trailCells = widest((row) => row.trail, TRAIL_MAX);
  const gaps = (leadCells > 0 ? 1 : 0) + (trailCells > 0 ? 1 : 0);
  const titleCells = Math.max(1, BODY_CELLS - leadCells - trailCells - gaps);

  const panels: Panel[] = [];
  let column = EDGE;

  const rect = (cells: number): Rect => ({
    x: column,
    y: BODY_Y,
    width: cells * CHAR_WIDTH,
    height: BODY_HEIGHT,
  });

  if (leadCells > 0) {
    panels.push(
      panel(
        CONTAINER.bodyA,
        rect(leadCells),
        rows.map((row) => clip(row.lead ?? "", leadCells)).join("\n"),
        MUTED,
        4,
      ),
    );
    column += (leadCells + 1) * CHAR_WIDTH;
  }

  panels.push(
    panel(
      CONTAINER.bodyB,
      rect(titleCells),
      rows.map((row) => clip(row.title, titleCells)).join("\n"),
      INK,
      5,
    ),
  );
  column += (titleCells + (trailCells > 0 ? 1 : 0)) * CHAR_WIDTH;

  if (trailCells > 0) {
    panels.push(
      panel(
        CONTAINER.bodyC,
        rect(trailCells),
        rows.map((row) => padLeft(row.trail ?? "", trailCells)).join("\n"),
        MUTED,
        6,
      ),
    );
  }

  return panels;
}

/** The sentence a card puts up when it has nothing to show, or could not ask. */
function notePanels(block: Extract<Block, { kind: "note" }>): Panel[] {
  const width = cellsIn(NOTE.width);
  return [panel(CONTAINER.bodyA, NOTE, wrap(block.text, width, 5).join("\n"), MUTED, 4)];
}

/** One screenful: the heading, the body, the footer. */
export function layout(view: CardView, page: number, chrome: Chrome): Panel[] {
  const body =
    view.block.kind === "face"
      ? facePanels(view.block, page)
      : view.block.kind === "rows"
        ? rowsPanels(view.block, page)
        : view.block.kind === "list"
          ? listPanels(view.block, page)
          : notePanels(view.block);

  return [...chromePanels(view, chrome), ...body];
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
