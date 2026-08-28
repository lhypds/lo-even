// The one thing every group on these pages has to get right, in one place.
//
// lo is careful about this and says so in almost every card it has: waiting is
// not the same answer as none. "No posts around here yet" is a claim about the
// street, and printing it in the moment before the request has come back is a
// page answering before it has asked.
//
// The failed case is separate from the empty one for the reason lo keeps them
// apart on the warnings row, where it matters most: "nothing in force here" is
// the one wrong answer this screen can give when what actually happened is that
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

/** What a group with no rows says instead of them — never a blank line. */
export function feedWord<T>(feed: Feed<T>, t: Translate, words: FeedWords): string {
  if (feed.status === "failed") return t(words.failed);
  if (feed.status === "ready") return t(words.empty);
  return t(words.loading);
}
