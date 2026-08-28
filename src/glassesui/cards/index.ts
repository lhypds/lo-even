// Which cards the glasses carry, and in what order.
//
// The same catalog as lo/src/utils/cards.js, and deliberately the same order:
// the time here, the sky here, the ground here — then who is around and what is
// in force, then everything that is a reading of a wider place than the one you
// are in. A reader who knows where things are on the phone knows where they are
// here.
//
// Two differences, both forced. lo's map tile is a picture and this display
// cannot be handed one, so `here` stands in its place with what the website says
// about the ground in words (see cards/here). And lo's mark button is not on this
// list at all: it is a tile on the phone because a phone has somewhere to put a
// button, and up here it is a tap — there is no card to draw for it, only
// something the whole screen can do.
//
// The other half of lo's catalog does not come over. `off` — a card that arrives
// off the page, waiting to be added from the plus in the top bar — has no meaning
// on a screen with no menu to add it from; every card the place can feed is in
// the sequence. Nor do `min`/`max`: the reader cannot resize a tile they cannot
// touch, and every card here gets the same whole screen.

import type { CardDefinition, CardContext } from "./types";
import { clockCard } from "./clock";
import { directionCard } from "./direction";
import { eventsCard } from "./events";
import { hereCard } from "./here";
import { newsCard } from "./news";
import { peopleCard } from "./people";
import { postsCard } from "./posts";
import { trendsCard } from "./trends";
import { warningsCard } from "./warnings";
import { weatherCard } from "./weather";

export const CARDS: CardDefinition[] = [
  clockCard,
  weatherCard,
  hereCard,
  peopleCard,
  warningsCard,
  postsCard,
  newsCard,
  eventsCard,
  trendsCard,
  directionCard,
];

/**
 * The cards worth drawing where the reader is standing right now. Crossing into
 * a country that cannot feed one takes it out of the sequence, which is the
 * server's half of lo's own two-part question — the reader's half, the plus in
 * the top bar, has no counterpart up here.
 */
export function offeredCards(context: CardContext): CardDefinition[] {
  return CARDS.filter((card) => card.offered(context));
}

export type { CardContext, CardDefinition } from "./types";
