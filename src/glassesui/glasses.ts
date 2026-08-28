// The dashboard, as the glasses see it.
//
// This is the whole of what main.ts talks to: hand it everything that is known
// right now and it draws the screenful the reader is looking at; tell it the
// wheel turned and it moves to the next one. It owns exactly one piece of state,
// which is where in the dashboard the reader has got to.
//
// **The sequence.** lo's dashboard is a grid cut into pages and turned with a
// thumb. There is no grid up here — a card gets the whole screen — so the same
// dashboard becomes one line of screenfuls: every card the place can feed, and
// every card that has more rows than fit contributing as many screens as it
// takes. Scrolling walks that line. A reader on the second page of the posts
// scrolls once more and is on the news, which is the behaviour the phone has
// when a page of tiles runs out.
//
// **Where the reader is** is kept as a card and a page within it, never as an
// index into that line. The line is rebuilt on every repaint — a card appears
// when its feed lands, another grows a page when four posts become nine — and an
// index into a list that grew underneath you is how a reader ends up looking at
// something they did not scroll to. Named, it survives all of it.

import type { EvenAppBridge } from "@evenrealities/even_hub_sdk";
import { offeredCards } from "./cards";
import type { CardContext, CardDefinition, CardView } from "./cards/types";
import { formatPlace } from "./format";
import { layout, pageCount, type Chrome, type Panel } from "./layout";
import { createPainter, type Painter } from "./paint";
import { HEAD_BAND, INK, NOTE, CONTAINER, MUTED, bandCells, cellsIn } from "./theme";
import { clip, wrap } from "./metrics";

export interface GlassesDisplay {
  /** Draw what is known now. Called on every change of data, status or minute. */
  render(context: CardContext, status?: string): void;
  /** The wheel turned: -1 towards the clock, +1 away from it. */
  scroll(direction: 1 | -1): void;
  /** Which card the reader is looking at, for anything that needs to know. */
  current(): string | null;
  shutdown(): Promise<void>;
}

/** One screenful: a card, and which page of that card. */
interface Step {
  card: CardDefinition;
  view: CardView;
  page: number;
}

/** Where the reader is, by name rather than by index. */
interface Anchor {
  cardId: string;
  page: number;
}

/**
 * Every screenful the dashboard currently amounts to, in order. Rendering a card
 * to count its pages is not wasteful — a render is a pure read of data already
 * in hand, and it is the only way to know how many pages a card is worth.
 */
function sequence(context: CardContext): Step[] {
  const steps: Step[] = [];
  for (const card of offeredCards(context)) {
    const view = card.render(context);
    const pages = pageCount(view.block);
    for (let page = 0; page < pages; page += 1) steps.push({ card, view, page });
  }
  return steps;
}

/**
 * Where the anchor points now. A page that is no longer there falls back to the
 * last page of the same card rather than to a different card — a list that
 * shrank under the reader should leave them looking at the same thing, shorter.
 */
function locate(steps: Step[], anchor: Anchor): number {
  const exact = steps.findIndex((step) => step.card.id === anchor.cardId && step.page === anchor.page);
  if (exact !== -1) return exact;
  const lastOfCard = steps.map((step) => step.card.id).lastIndexOf(anchor.cardId);
  return lastOfCard === -1 ? 0 : lastOfCard;
}

/** The screen before there is anything to put on it. */
function bootPanels(message: string): Panel[] {
  return [
    {
      id: CONTAINER.headBand,
      rect: HEAD_BAND,
      text: clip("lo", bandCells(HEAD_BAND)),
      brightness: INK,
      bordered: true,
      zOrder: 0,
    },
    {
      id: CONTAINER.bodyA,
      rect: NOTE,
      text: wrap(message, cellsIn(NOTE.width), 5).join("\n"),
      brightness: MUTED,
      bordered: false,
      zOrder: 4,
    },
  ];
}

export async function createGlassesDisplay(
  bridge: EvenAppBridge,
  bootMessage = "Connecting to your phone",
): Promise<GlassesDisplay> {
  const painter: Painter = await createPainter(bridge, bootPanels(bootMessage));

  // The clock is where lo opens and so is this.
  let anchor: Anchor = { cardId: "clock", page: 0 };
  let latest: CardContext | null = null;
  let latestStatus = "";

  function draw(): void {
    if (!latest) return;
    const steps = sequence(latest);
    if (steps.length === 0) {
      painter.paint(bootPanels(latest.t("glasses.empty")));
      return;
    }

    const index = locate(steps, anchor);
    const step = steps[index];
    // Written back, so that a page the anchor only reached by falling back is the
    // page the next scroll moves on from.
    anchor = { cardId: step.card.id, page: step.page };

    const chrome: Chrome = {
      place: formatPlace(latest.place),
      status: latestStatus,
      index: index + 1,
      total: steps.length,
    };
    painter.paint(layout(step.view, step.page, chrome));
  }

  return {
    render(context, status = "") {
      latest = context;
      latestStatus = status;
      draw();
    },

    scroll(direction) {
      if (!latest) return;
      const steps = sequence(latest);
      if (steps.length === 0) return;
      // Round rather than stopping at either end. On a phone a dashboard resists
      // at its edges because there is a thumb on it and the resistance is felt;
      // a wheel gives nothing back, so an edge there is just a scroll that did
      // nothing — and the clock is never more than one flick away either way.
      const next = (locate(steps, anchor) + direction + steps.length) % steps.length;
      anchor = { cardId: steps[next].card.id, page: steps[next].page };
      draw();
    },

    current() {
      return anchor.cardId;
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
  let cardId: string | null = null;
  return {
    render(context) {
      cardId = offeredCards(context)[0]?.id ?? null;
    },
    scroll() {},
    current: () => cardId,
    async shutdown() {},
  };
}
