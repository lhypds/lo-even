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
import type { LoArticle, LoFeedItem } from "../../types";
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
 * What is under a headline once the reader steps into it.
 *
 * The headline is always the first line of it, whatever else happened, and that
 * is deliberate: this screen is reached by opening a row, and a screen that
 * answered a tap by replacing the words tapped on with `Still coming.` reads as
 * having lost them. It also keeps the entry enterable in every state, since an
 * entry with no body is one the app steps back out of (see glasses.ts).
 *
 * The three states under it are lo's own three, kept apart for lo's own reason:
 * still coming, nothing to be had, and the story. The middle one is not an error
 * — plenty of publishers will not answer a server at all, and a paywall answers
 * with its first paragraph — so it says where the rest is rather than apologising.
 */
function story(item: LoFeedItem, article: Feed<LoArticle>, t: Translate): string {
  const words = article.data?.paragraphs ?? [];
  // Nothing to be had — nobody answered, or the answer had no words in it. Both
  // are the same thing to a reader, and both are "it is on the phone".
  if (article.status === "failed" || (article.status === "ready" && words.length === 0)) {
    return `${item.title}\n\n${t("article.elsewhere")}`;
  }
  if (article.status !== "ready") return `${item.title}\n\n${t("article.reading")}`;
  // Paragraphs kept apart rather than run together: they are the only structure
  // a story arrives with, and on a screen five lines deep they are what stops
  // fifteen screenfuls reading as one. The reading screen is the one place in
  // the app that honours a break (see prosePanels in layout.ts).
  //
  // A story that stopped early says so at the end of what there is, where the
  // reader has just run out — not at the top, where it would be a warning about
  // something they had not read yet.
  const ending = article.data?.partial ? [t("article.partial")] : [];
  return [item.title, ...words, ...ending].join("\n\n");
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
  { locale, t, article }: PageContext,
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
      // The headline on the list, the story underneath it once the reader has
      // opened the row — which is when lo goes and reads it, and not before.
      body: story(item, article(item.url), t),
      link: item.url,
    };
  });
}
