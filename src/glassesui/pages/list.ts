// The two screens behind every page: the list a page is a summary of, and one
// entry of that list, read.
//
// **Why there is anything behind a page at all.** The three pages are a
// dashboard, and a dashboard's whole trick is that it fits: every group is cut
// to the lines it can be spared, so four posts are four half-sentences and the
// fifth is a number. That is the right answer to "what is going on here" and the
// wrong one to "what did they say" — and until now the second question had no
// answer up here except to take the glasses off and open the phone.
//
// So a tap steps into the page under the reader. The same rows, no longer
// competing for the screen with anything else: two lines each, three at a time,
// and the whole of any one of them a tap further in. The wheel means the same
// thing at every depth — the next thing along — and a double tap is the way back
// out of all of them.
//
// **What a page owes this file.** Nothing but its entries, in the order it lists
// its groups in, so that a reader who has just read a summary finds its list in
// the order they read it (see `items` on PageDefinition). The two screens here
// are the same two for every page, which is the point: there is one list screen
// in this app and one reading screen, and learning either of them is learning
// both of the pages that have one.

import type { Translate } from "../strings";
import type { Item, ItemRef, PageView } from "./types";

/**
 * A page's own list. The heading is the group the reader is standing in rather
 * than the place they are standing in — the place is on the footer of every
 * screen anyway, and up here the useful thing to know is that the wheel has just
 * carried you out of the posts and into the letters.
 *
 * Which entry is under the reader is not in the view: it is the screen number,
 * because a list of nine entries is a page nine screenfuls deep as far as
 * everything downstream is concerned (see layout.ts).
 */
export function listView(items: Item[], focus: number, t: Translate): PageView {
  return {
    title: t(`${items[focus].group}.title`),
    block: { kind: "items", items },
  };
}

/**
 * One entry, whole. Its first line becomes the heading — the same words in the
 * same place, so the step in reads as the entry growing rather than as a screen
 * arriving — and everything it has to say goes under it.
 */
export function readView(item: Item): PageView {
  return {
    title: item.head,
    meta: item.meta,
    block: { kind: "prose", text: item.body },
  };
}

/**
 * Where the reader is in a list that has been rebuilt underneath them, which it
 * is on every paint: a post is deleted on somebody's phone, a letter arrives, a
 * name walks out of range. Held by name for the same reason the page they are on
 * is (see glasses.ts) — an index into a list that moved is how a reader ends up
 * reading something they never scrolled to.
 *
 * A gone entry falls back to the first of its own group rather than to the top
 * of the list: the reader was reading the posts, and the posts are still there.
 */
export function locate(items: Item[], at: ItemRef | null): number {
  if (!at) return 0;
  const exact = items.findIndex((item) => item.group === at.group && item.key === at.key);
  if (exact !== -1) return exact;
  const group = items.findIndex((item) => item.group === at.group);
  return group === -1 ? 0 : group;
}

/** What a group with nothing in it puts in the list, so the group is still there to walk to. */
export function nothing(group: string, said: string): Item {
  // No key and no body, which is what makes it un-enterable: there is nothing
  // behind "no posts around here yet" but the same sentence again (see
  // glasses.ts). It keeps its place in the list all the same — a group that
  // vanished when it emptied would move the two below it under a reader who had
  // learned where they were, and "the posts have not arrived yet" is a claim
  // this screen has to be able to make.
  return { group, key: "", head: said, line: "", body: "" };
}
