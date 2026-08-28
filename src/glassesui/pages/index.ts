// The three pages, and the order they are walked in.
//
// lo's dashboard is a grid of ten tiles turned with a thumb. There is no grid on
// a 576×288 heads-up display and nothing to put a thumb on, and a screen that
// carries one tile's worth of answer is a screen the reader has to leave to learn
// anything else — so the whole of it becomes three pages, each as full as seven
// lines can be made:
//
//   1. where you are standing, and a count of what is on the other two;
//   2. who is here, what they left, and who has written;
//   3. what is being reported, searched and put on in the wider place.
//
// The order is the website's own — where you are, then who is around you, then
// the readings of somewhere larger — so a reader who knows where things are on
// the phone knows where they are here. All three are always in the sequence: with
// only three, a page that took itself off would move the other two under a reader
// who had learned where they were, so what a country cannot feed is a line or a
// group left off a page instead.
//
// lo's mark button is not on this list at all: it is a tile on the phone because
// a phone has somewhere to put a button, and up here it is a hold on the touchpad
// — there is no page to draw for it, only something the whole screen can do (see
// main.ts). What that hold turns into does have a screen, and it is not on this
// list either: the composer takes the display over to ask whether what was just
// said is a mark or a post, and gives it back where it found it (compose.ts).

import type { PageContext, PageDefinition } from "./types";
import { herePage } from "./here";
import { nearbyPage } from "./nearby";
import { worldPage } from "./world";

export const PAGES: PageDefinition[] = [herePage, nearbyPage, worldPage];

/** The pages worth drawing where the reader is standing right now. */
export function offeredPages(context: PageContext): PageDefinition[] {
  return PAGES.filter((page) => page.offered(context));
}

export type { PageContext, PageDefinition } from "./types";
