// The one thing every list card has to get right, in one place.
//
// lo is careful about this and says so in almost every card it has: waiting is
// not the same answer as none. "No posts around here yet" is a claim about the
// street, and printing it in the moment before the request has come back is a
// card answering before it has asked. The same three-way runs here — and it has
// to be a four-way, because a feed the reader has not walked to yet has not even
// been asked for (see feeds.ts: a regional card is fetched when it is first
// looked at, not on the way in).
//
// The failed case is separate from the empty one for the reason lo keeps them
// apart on the warnings card, where it matters most: "nothing in force here" is
// the one wrong answer a card can give when what actually happened is that
// nobody could be reached.

import type { Translate } from "../strings";
import type { Feed } from "./types";

export interface FeedWords {
  /** While the answer is on its way, or before it has been asked for. */
  loading: string;
  /** The answer came back and there is genuinely nothing. */
  empty: string;
  /** Nobody could be reached. */
  failed: string;
}

/**
 * The sentence this card should be showing instead of its list, or null when it
 * has rows and should just draw them. Rows win over everything: a feed that
 * failed on a later refresh still has last time's answer worth looking at.
 */
export function feedNote<T>(
  feed: Feed<T>,
  rowCount: number,
  t: Translate,
  words: FeedWords,
): string | null {
  if (rowCount > 0) return null;
  if (feed.status === "failed") return t(words.failed);
  if (feed.status === "ready") return t(words.empty);
  return t(words.loading);
}
