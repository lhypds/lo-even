// The parts of the frame every screen wears: where you are, what time it is
// there, and where in the app you are standing.
//
// The heading is the same pair on all three pages rather than a name for each. A
// page's name is a word the reader learns once and then never reads again, and it
// would be paid for out of the one line that is on screen whichever page they are
// on — where they are standing and the hour there. What page this is is answered
// by the words in the margin under it, and by the path in the corner of the
// footer, which is the other half of this file.

import type { PageContext, PageDefinition } from "./types";

// The path, and the app's own name at the head of it. `lo/` rather than a bare
// `/`: this glass has two screens on it, the phone's and this one, and the one
// word says which of them is being read — and the page it names is a place you
// can stand, so it is written as one.
export const ROOT = "lo/";

// What a group is called in a path, where that is not simply its name. There is
// one of them, and it is the one the badge in the opposite corner has already
// settled: that corner says `msg (2)` because the face has no envelope to draw,
// and a path that spelled the same group out in full would be two words for one
// thing on one screen. It is also the longest of the four, on the narrowest line
// there is.
const SHORT: Record<string, string> = { messages: "msg" };

/**
 * Where a screen is, written the way a path is written: the page, and the group
 * within it once the reader has stepped in far enough for there to be one.
 *
 * The standing page is the root itself and has nothing after the slash. It is
 * where lo opens, where a double tap eventually returns everybody, and the only
 * page with nothing underneath it — a name for it would be a name nobody ever
 * navigates by.
 */
export function pathOf(page: PageDefinition, group?: string): string {
  const here = `${ROOT}${page.segment}`;
  return group ? `${here}/${SHORT[group] ?? group}` : here;
}

/** The zone the reader is standing in, or the handset's own until that lands. */
export function zoneOf({ weather }: PageContext): string {
  return weather?.timezone?.id || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** The place, short enough to be a heading: the spot, and the country it is in. */
export function placeTitle({ place, t }: PageContext): string {
  const spot = place?.name || place?.locality;
  if (!spot) return t("location.title");
  // The country rather than the region, which is what the footer is already
  // spelling out in full: on a heading it is the one word that tells a reader
  // who has just landed which country's afternoon they are looking at.
  return place?.country ? `${spot}, ${place.country}` : spot;
}

/**
 * The hour where the reader is standing. No seconds, where the website has them:
 * on a phone a ticking second is free, and here every changed line is a write
 * down a BLE link — a page that redrew itself sixty times a minute would spend
 * the whole radio budget saying what the minute already said.
 */
export function clockFace(context: PageContext): string {
  return new Intl.DateTimeFormat(context.locale, {
    timeZone: zoneOf(context),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(context.now);
}
