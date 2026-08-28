// The dashboard, as the glasses see it, and the two levels underneath it.
//
// This is the whole of what main.ts talks to: hand it everything that is known
// right now and it draws the screenful the reader is looking at; tell it the
// wheel turned and it moves to the next one, or that the touchpad was tapped and
// it steps into what is under them. All the state it owns is where the reader
// has got to.
//
// **The sequence.** lo's dashboard is a grid of tiles turned with a thumb. There
// is no grid up here and nothing to put a thumb on, so the same dashboard becomes
// three screenfuls walked with the wheel: where you are, what is around you, what
// is being said about the wider place. Each of them is built to come in at or
// under the lines there are, so a scroll is always a page rather than sometimes
// the rest of one — but a page that did overflow would contribute a second screen
// rather than lose the difference (see layout.ts).
//
// **The three levels.** A dashboard fits by cutting, and what it cuts is the ends
// of sentences. That is the right trade for the question "what is going on here"
// and no answer at all to "what did they say", so under two of the three pages
// there is the list the page is a summary of, and under each entry of that the
// whole of what it says (see pages/list.ts).
//
//   `lo/`                     three pages, one flick apart
//   `lo/nearby`               everyone here, everything left here, everyone who wrote
//   `lo/nearby/messages`      one of them, whole
//
// The wheel means the same thing at all three: the next thing along, rounding at
// the end rather than stopping. A tap goes in, a double tap comes back out, and
// at the top a double tap is the way out of the app it always was — which is the
// grammar the corner of the footer is spelling out in a path.
//
// **Where the reader is** is kept by name at every level, never as an index. A
// page appears when the country turns out to feed it, a list grows an entry when
// somebody posts, a post is deleted from a phone three streets away — all of it
// underneath a reader who has not touched anything. An index into a list that
// moved is how they end up looking at something they never scrolled to; a name
// survives all of it, and where the name has gone the fallback is the nearest
// thing to it rather than the top.

import type { EvenAppBridge } from "@evenrealities/even_hub_sdk";
import { offeredPages } from "./pages";
import type { Item, ItemRef, PageContext, PageDefinition, PageView } from "./pages/types";
import { listView, locate as locateItem, readView } from "./pages/list";
import { formatPlace } from "./format";
import { clockFace } from "./pages/chrome";
import { layout, screens, type Chrome, type Panel } from "./layout";
import { createPainter, type Painter } from "./paint";
import { BODY_LINES, BODY_WIDTH, FRAME, INK, CONTAINER, MUTED, cellsIn, frameCells, noteRect } from "./theme";
import { clip, wrap } from "./metrics";

/**
 * A screen that is not part of the sequence and takes the display over while it
 * is up. There is one of them — the composer, which asks a dictation what it is
 * (see pages/compose.ts) — and it is named rather than anonymous so that anything
 * asking what the reader is looking at gets an answer that is true.
 */
export interface Takeover {
  id: string;
  view: PageView;
}

export interface GlassesDisplay {
  /** Draw what is known now. Called on every change of data, status or minute. */
  render(context: PageContext, status?: string): void;
  /** The wheel turned: -1 back towards the standing page, +1 away from it. */
  scroll(direction: 1 | -1): void;
  /**
   * A tap: into the list under this page, or into the entry under the reader.
   * Nothing at all where there is nothing under them — the standing page is
   * instruments rather than a list of anything, and an empty group is a sentence
   * saying so rather than a screen to open.
   */
  enter(): void;
  /**
   * A double tap: back out one level. False when there was nowhere to come back
   * from, which is how the caller knows the gesture was the one that leaves the
   * app (see main.ts).
   */
  back(): boolean;
  /**
   * Put a screen in front of everything, or `null` to take it away. Where the
   * reader was is not touched either way: a question asked in the middle of the
   * dashboard puts them back on exactly the screen they were reading, which is
   * the least a question that interrupted them can do.
   */
  takeover(screen: Takeover | null): void;
  /** Which page the reader is looking at, for anything that needs to know. */
  current(): string | null;
  /** Where in the app they are, as the corner of the footer says it: `lo/nearby`. */
  path(): string;
  shutdown(): Promise<void>;
}

/** One screenful: a page, and which screen of that page. */
interface Step {
  page: PageDefinition;
  view: PageView;
  screen: number;
}

/** Where the reader is on the dashboard, by name rather than by index. */
interface Anchor {
  pageId: string;
  screen: number;
}

/**
 * How deep in: the dashboard, a page's own list, or one entry of it. A number
 * rather than three shapes of state, because the page it is all under is the
 * same one at every depth — the anchor is never disturbed by going in, so coming
 * back out is a subtraction and the reader is where they left off.
 */
type Depth = 0 | 1 | 2;

// The path in the corner, and the app's own name at the head of it. `lo/` rather
// than a bare `/`: this glass has two screens on it, the phone's and this, and
// the one word says which of them the reader is reading — and the root of a
// dashboard is a place you can stand, so it is written as one.
const ROOT = "lo/";

function pathOf(pageId?: string, group?: string): string {
  if (!pageId) return ROOT;
  return group ? `${ROOT}${pageId}/${group}` : `${ROOT}${pageId}`;
}

/** One screenful of what is underneath a page, and everything the wheel needs to leave it. */
interface Inside {
  view: PageView;
  screen: number;
  chrome: Chrome;
  items: Item[];
  focus: number;
  total: number;
}

/**
 * Every screenful the dashboard currently amounts to, in order. Rendering a page
 * to count its screens is not wasteful — a render is a pure read of data already
 * in hand, and it is the only way to know how many screens a page is worth.
 */
function sequence(context: PageContext): Step[] {
  const steps: Step[] = [];
  for (const page of offeredPages(context)) {
    const view = page.render(context);
    const total = screens(view);
    for (let screen = 0; screen < total; screen += 1) steps.push({ page, view, screen });
  }
  return steps;
}

/**
 * Where the anchor points now. A screen that is no longer there falls back to the
 * last screen of the same page rather than to a different page — a list that
 * shrank under the reader should leave them looking at the same thing, shorter.
 */
function locate(steps: Step[], anchor: Anchor): number {
  const exact = steps.findIndex((step) => step.page.id === anchor.pageId && step.screen === anchor.screen);
  if (exact !== -1) return exact;
  const lastOfPage = steps.map((step) => step.page.id).lastIndexOf(anchor.pageId);
  return lastOfPage === -1 ? 0 : lastOfPage;
}

/** The screen before there is anything to put on it. */
function bootPanels(message: string): Panel[] {
  const lines = wrap(message, cellsIn(BODY_WIDTH), BODY_LINES);
  return [
    {
      id: CONTAINER.frame,
      rect: FRAME,
      text: clip("lo", frameCells()),
      brightness: INK,
      bordered: true,
      zOrder: 0,
    },
    {
      id: CONTAINER.note,
      rect: noteRect(lines),
      text: lines.join("\n"),
      brightness: MUTED,
      bordered: false,
      zOrder: 7,
    },
  ];
}

export async function createGlassesDisplay(
  bridge: EvenAppBridge,
  bootMessage = "Connecting to your phone",
): Promise<GlassesDisplay> {
  const painter: Painter = await createPainter(bridge, bootPanels(bootMessage));

  // Where you are standing is where lo opens and so is this.
  let anchor: Anchor = { pageId: "here", screen: 0 };
  // On the dashboard, which is where every launch starts and where a double tap
  // eventually returns everybody.
  let depth: Depth = 0;
  // Which entry of the page's list the reader is on, and which screenful of that
  // entry. Both kept across a step out and back in, so a reader who left the
  // letters to check the time comes back to the letters.
  let at: ItemRef | null = null;
  let reading = 0;
  let latest: PageContext | null = null;
  let latestStatus = "";
  let taken: Takeover | null = null;
  // What the last paint actually said in the corner. Kept rather than worked out
  // again on demand, because the honest answer to "where is the reader" is the
  // one that is on the glass.
  let shownPath = ROOT;

  /** The place, the hour, the badge and whatever is being said — the same on every screen. */
  function surround(context: PageContext): Chrome {
    return {
      place: formatPlace(context.place),
      time: clockFace(context),
      status: latestStatus,
      unread: context.unread,
    };
  }

  /**
   * The screenful under the page the anchor names, or `null` where there is no
   * longer anything under it — a country that stopped feeding this page, a
   * sign-out that emptied every list. Nothing here throws the reader out on its
   * own; the caller does that, and it does it by drawing the dashboard instead.
   */
  function inside(context: PageContext): Inside | null {
    const page = offeredPages(context).find(({ id }) => id === anchor.pageId);
    const items = page?.items?.(context) ?? [];
    if (!page || items.length === 0) return null;

    const focus = locateItem(items, at);
    const item = items[focus];
    // Written back, so that an entry the reader only reached by falling back is
    // the one the next flick of the wheel moves on from.
    at = { group: item.group, key: item.key };

    if (depth === 1) {
      return {
        view: listView(items, focus, context.t),
        screen: focus,
        chrome: { ...surround(context), path: pathOf(page.id), index: focus + 1, total: items.length },
        items,
        focus,
        total: items.length,
      };
    }

    const view = readView(item);
    const total = screens(view);
    // A post that was four screenfuls when the reader stepped into it and is two
    // now — because the language changed under it, or because this is a repaint
    // of something that has been edited — leaves them on the last of what is
    // left rather than on a screen that is no longer there.
    reading = Math.min(Math.max(reading, 0), total - 1);
    return {
      view,
      screen: reading,
      chrome: {
        ...surround(context),
        path: pathOf(page.id, item.group),
        index: reading + 1,
        total,
      },
      items,
      focus,
      total,
    };
  }

  function draw(): void {
    if (!latest) return;

    // The screen in front of everything, where there is one. It wears the same
    // chrome as a page — the place, the hour, whatever the status line has to say
    // — because it is the same screen with a different question on it, and the
    // reader should not have to work out that it is. No path and no counter: it
    // is not anywhere in the app, and it has its own way out (see compose.ts).
    if (taken) {
      painter.paint(layout(taken.view, 0, surround(latest)));
      return;
    }

    if (depth > 0) {
      const step = inside(latest);
      if (step) {
        shownPath = step.chrome.path ?? ROOT;
        painter.paint(layout(step.view, step.screen, step.chrome));
        return;
      }
      // What was under the reader is not there any more. The page it was under
      // still is — that is what the anchor is — so they land back on it rather
      // than on a screen apologising.
      depth = 0;
    }

    const steps = sequence(latest);
    if (steps.length === 0) {
      shownPath = ROOT;
      painter.paint(bootPanels(latest.t("glasses.empty")));
      return;
    }

    const index = locate(steps, anchor);
    const step = steps[index];
    // Written back, so that a screen the anchor only reached by falling back is
    // the one the next scroll moves on from.
    anchor = { pageId: step.page.id, screen: step.screen };

    const chrome: Chrome = {
      ...surround(latest),
      path: ROOT,
      index: index + 1,
      total: steps.length,
    };
    shownPath = ROOT;
    painter.paint(layout(step.view, step.screen, chrome));
  }

  return {
    render(context, status = "") {
      latest = context;
      latestStatus = status;
      draw();
    },

    scroll(direction) {
      if (!latest) return;
      // The wheel belongs to whatever has the screen. While the composer has it
      // the wheel is choosing between two answers rather than walking anything,
      // and a sequence that moved underneath it would put the reader somewhere
      // they never scrolled to (see main.ts).
      if (taken) return;

      // Round rather than stopping at either end, at every depth. On a phone a
      // list resists at its edges because there is a thumb on it and the
      // resistance is felt; a wheel gives nothing back, so an edge there is just
      // a scroll that did nothing.
      if (depth > 0) {
        const step = inside(latest);
        if (step) {
          if (depth === 1) {
            const next = (step.focus + direction + step.total) % step.total;
            at = { group: step.items[next].group, key: step.items[next].key };
          } else {
            reading = (step.screen + direction + step.total) % step.total;
          }
          draw();
          return;
        }
        depth = 0;
      }

      const steps = sequence(latest);
      if (steps.length === 0) return;
      const next = (locate(steps, anchor) + direction + steps.length) % steps.length;
      anchor = { pageId: steps[next].page.id, screen: steps[next].screen };
      draw();
    },

    enter() {
      if (!latest || taken) return;

      if (depth === 0) {
        const page = offeredPages(latest).find(({ id }) => id === anchor.pageId);
        // Nothing behind the standing page, and nothing behind a page whose
        // country feeds none of its groups. A tap that opened an empty list
        // would be a step the reader has to take back.
        if (!page?.items?.(latest).length) return;
        depth = 1;
        draw();
        return;
      }

      if (depth === 1) {
        const step = inside(latest);
        // A group with nothing in it is one entry saying so, and there is
        // nothing behind that sentence but itself (see pages/list.ts).
        if (!step?.items[step.focus].body) return;
        depth = 2;
        reading = 0;
        draw();
      }
    },

    back() {
      // The composer answers its own double tap, and it answers it by throwing a
      // sentence away — which is not a step out of anywhere (see main.ts).
      if (taken || depth === 0) return false;
      depth = depth === 2 ? 1 : 0;
      draw();
      return true;
    },

    takeover(screen) {
      taken = screen;
      draw();
    },

    current() {
      return taken?.id ?? anchor.pageId;
    },

    path() {
      return taken ? "" : shownPath;
    },

    shutdown() {
      return painter.shutdown();
    },
  };
}

/**
 * What runs in an ordinary browser, where there is no bridge and so no glasses.
 * The phone view is lo's own website in a frame (see webui.ts) and draws itself,
 * so there is genuinely nothing for this to do — it exists so main.ts can be
 * written once, against a display that is always there.
 */
export function createBrowserDisplay(): GlassesDisplay {
  let pageId: string | null = null;
  let taken: string | null = null;
  return {
    render(context) {
      pageId = offeredPages(context)[0]?.id ?? null;
    },
    scroll() {},
    enter() {},
    // Never anywhere to come back from, so a double tap here is what it has
    // always been in a browser: the gesture that closes the app.
    back: () => false,
    // Nothing to draw, but the answer to `current` still has to be the truth: the
    // gestures that drive the composer are gated on it (see main.ts).
    takeover(screen) {
      taken = screen?.id ?? null;
    },
    current: () => taken ?? pageId,
    path: () => ROOT,
    async shutdown() {},
  };
}
