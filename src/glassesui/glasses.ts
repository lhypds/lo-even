// The dashboard, as the glasses see it.
//
// This is the whole of what main.ts talks to: hand it everything that is known
// right now and it draws the screenful the reader is looking at; tell it the
// wheel turned and it moves to the next one. It owns exactly one piece of state,
// which is where in the dashboard the reader has got to.
//
// **The sequence.** lo's dashboard is a grid of tiles turned with a thumb. There
// is no grid up here and nothing to put a thumb on, so the same dashboard becomes
// three screenfuls walked with the wheel: where you are, what is around you, what
// is being said about the wider place. Each of them is built to come in at or
// under the lines there are, so a scroll is always a page rather than sometimes
// the rest of one — but a page that did overflow would contribute a second screen
// rather than lose the difference (see layout.ts).
//
// **Where the reader is** is kept as a page and a screen within it, never as an
// index into that line. The line is rebuilt on every repaint — a page appears
// when the country turns out to feed it, another grows a screen when four posts
// become nine — and an index into a list that grew underneath you is how a reader
// ends up looking at something they did not scroll to. Named, it survives all of
// it.

import type { EvenAppBridge } from "@evenrealities/even_hub_sdk";
import { offeredPages } from "./pages";
import type { PageContext, PageDefinition, PageView } from "./pages/types";
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
   * Put a screen in front of everything, or `null` to take it away. The anchor is
   * not touched either way: a question asked in the middle of the dashboard puts
   * the reader back on the page they were reading, which is the least a question
   * that interrupted them can do.
   */
  takeover(screen: Takeover | null): void;
  /** Which page the reader is looking at, for anything that needs to know. */
  current(): string | null;
  shutdown(): Promise<void>;
}

/** One screenful: a page, and which screen of that page. */
interface Step {
  page: PageDefinition;
  view: PageView;
  screen: number;
}

/** Where the reader is, by name rather than by index. */
interface Anchor {
  pageId: string;
  screen: number;
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
  let latest: PageContext | null = null;
  let latestStatus = "";
  let taken: Takeover | null = null;

  function draw(): void {
    if (!latest) return;

    // The screen in front of everything, where there is one. It wears the same
    // chrome as a page — the place, the hour, whatever the status line has to say
    // — because it is the same screen with a different question on it, and the
    // reader should not have to work out that it is.
    if (taken) {
      painter.paint(
        layout(taken.view, 0, {
          place: formatPlace(latest.place),
          time: clockFace(latest),
          status: latestStatus,
          unread: latest.unread,
        }),
      );
      return;
    }

    const steps = sequence(latest);
    if (steps.length === 0) {
      painter.paint(bootPanels(latest.t("glasses.empty")));
      return;
    }

    const index = locate(steps, anchor);
    const step = steps[index];
    // Written back, so that a screen the anchor only reached by falling back is
    // the one the next scroll moves on from.
    anchor = { pageId: step.page.id, screen: step.screen };

    const chrome: Chrome = {
      place: formatPlace(latest.place),
      time: clockFace(latest),
      status: latestStatus,
      unread: latest.unread,
      index: index + 1,
      total: steps.length,
    };
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
      // the wheel is choosing between two answers rather than walking the pages,
      // and a sequence that moved underneath it would put the reader somewhere
      // they never scrolled to (see main.ts).
      if (taken) return;
      const steps = sequence(latest);
      if (steps.length === 0) return;
      // Round rather than stopping at either end. On a phone a dashboard resists
      // at its edges because there is a thumb on it and the resistance is felt;
      // a wheel gives nothing back, so an edge there is just a scroll that did
      // nothing — and where you are standing is never more than one flick away
      // either way.
      const next = (locate(steps, anchor) + direction + steps.length) % steps.length;
      anchor = { pageId: steps[next].page.id, screen: steps[next].screen };
      draw();
    },

    takeover(screen) {
      taken = screen;
      draw();
    },

    current() {
      return taken?.id ?? anchor.pageId;
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
    // Nothing to draw, but the answer to `current` still has to be the truth: the
    // gestures that drive the composer are gated on it (see main.ts).
    takeover(screen) {
      taken = screen?.id ?? null;
    },
    current: () => taken ?? pageId,
    async shutdown() {},
  };
}
