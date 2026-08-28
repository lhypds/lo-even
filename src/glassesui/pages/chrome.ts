// The heading every page wears: where you are, and what time it is there.
//
// The same pair on all three pages rather than a name for each. A page's name is
// a word the reader learns once and then never reads again, and it would be paid
// for out of the one line that is on screen whichever page they are on — where
// they are standing and the hour there. What page this is is answered by the
// words in the margin under it and by the counter in the corner of the footer.

import type { PageContext } from "./types";

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
