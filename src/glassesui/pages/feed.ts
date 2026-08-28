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

import { feedTime, joined } from "../format";
import type { Translate } from "../strings";
import type { LoFeedItem } from "../../types";
import { nothing } from "./list";
import type { Feed, Item, PageContext } from "./types";

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

/**
 * One of lo's upstream feeds as a list of entries: where each came from and when
 * over the top of it, and what it says underneath (see pages/list.ts).
 *
 * The newswire and the listings are the same shape and are read the same way
 * round — a source and an hour are what tell you whether a headline is worth the
 * tap, and the headline itself is the thing being read. All that separates them
 * is which way the clock points, and that is `feedTime`'s to know rather than
 * this function's (see format.ts).
 *
 * A feed with nothing in it is still one entry, saying which of the three kinds
 * of nothing it is. That is this file's whole subject, and it does not stop being
 * true a level down.
 */
export function feedItems(
  group: string,
  feed: Feed<LoFeedItem[]>,
  { locale, t }: PageContext,
  words: FeedWords,
): Item[] {
  const rows = feed.data ?? [];
  if (rows.length === 0) return [nothing(group, feedWord(feed, t, words))];
  return rows.map((item) => {
    const when = feedTime(item.time, locale, t);
    return {
      group,
      key: item.url || item.title,
      // The group's own name where the feed said neither who nor when, so the
      // first line of an entry is never blank: an entry with one line where the
      // three around it have two reads as a list that failed to draw a row.
      //
      // Nothing in the corner of the heading while it is read: the hour is
      // already the second half of this line, and a screen that said `Aug 28`
      // twice would be a screen saying it once and then again.
      head: joined(item.source, when) || t(`${group}.title`),
      line: item.title,
      body: item.title,
    };
  });
}
