// What is being reported, what is on, and what is being searched for.
//
// lo keeps these as cards of their own on purpose: two of them come off the same
// upstream, which is what made merging them look free, and what it cost was the
// reader's question — somebody who came to find out what is happening got a list
// with half its rows answering something else. They are one page here and still
// three answers, because the word in the margin says which of the three each line
// is, and because seven lines of the freshest of each is worth more on a screen
// this size than seven headlines and four more flicks to reach the rest.
//
// **The listings are back on this page**, and the move is about what a listing is
// rather than about where there was room. They stood on the standing-around page
// for a while on the argument that what is on tonight within walking distance is
// a fact about this street; what that argument missed is how a listing is *read*.
// A row here is a source, an hour and something to decide about — a thing that
// has not happened yet, that will have happened by Sunday, and that the reader
// weighs exactly as they weigh a headline. That is this page's whole subject.
// What actually belongs beside the people and the posts is the fixture rather
// than the occasion: where the nearest coffee is, which is true tomorrow as well
// (see nearby.ts). So the three feeds here are the three that are read rather
// than walked into, in the order a reader takes them: what has happened, what is
// going to, and what everyone is looking up.
//
// How many lines each gets is dealt rather than fixed (see stack.ts): the
// newswire is named first so it takes the spare line on the evenings it has one
// to spare, and a feed with nothing to say still keeps its own line to say so.
//
// A feed the country has no answer for is left off this page altogether rather
// than shown empty — an empty Trends group would read as "nobody here is
// searching for anything" rather than as "Google does not cover this country".
// That is the server's half of lo's own two-part question, and the reader's half,
// the plus in the top bar, has no counterpart up here.
//
// A headline does not fit on a line of this display and never did. What the
// summary shows is as much of one as there is room for; the rest of it is a tap
// away, on this page's own list, where a story gets two lines and the whole of it
// gets the screen (see list.ts). What is still not here is the article: the
// website's rows are links out to the piece, the search or the ticket, and a pair
// of glasses has nowhere to open one. What lo was told is what can be read here.

import { BODY_LINES } from "../theme";
import { placeTitle } from "./chrome";
import { feedItems, feedWord, type FeedWords } from "./feed";
import { nothing } from "./list";
import { stack, type Group } from "./stack";
import type { Item, PageDefinition, PageView } from "./types";

// The three groups, in the order the page lists them and the wheel walks them.
// Each is named by the key its words are under in the dictionary, which is also
// the last part of its path — `lo/info/news` is the news group's own screen, and
// `news.title` is what the heading of it says (see list.ts).
const NEWS: FeedWords = { loading: "news.loading", empty: "news.empty", failed: "news.unavailable" };
const EVENTS: FeedWords = {
  loading: "events.loading",
  empty: "events.empty",
  failed: "events.unavailable",
};
const TRENDS: FeedWords = {
  loading: "trends.loading",
  empty: "trends.empty",
  failed: "trends.unavailable",
};

export const infoPage: PageDefinition = {
  // Three feeds, all of them already in hand: they come back with the fix on the
  // one read this app makes of it (see feeds.ts), so arriving here costs nothing
  // — which is as true of the listings as of the other two, and is why moving
  // them between pages is a question of where they read best rather than of what
  // either page can afford.
  //
  // Named for what lo calls the card rather than for the wider world it is about,
  // because the name is written on the screen now: it is the middle of the path
  // in the corner of every screen under this one (see glasses.ts).
  id: "info",
  segment: "info",

  // Never off the sequence, however little the country can feed: three pages is
  // few enough that losing one would move the other two under a reader who had
  // learned where they were. What a country cannot feed is a group left off this
  // page instead.
  offered: () => true,

  render(context): PageView {
    const { news, events, trends, components, t } = context;
    const groups: Group[] = [];

    if (components.includes("nearby")) {
      groups.push({
        id: "news",
        label: t("news.title"),
        lines: (news.data ?? []).map((item) => item.title),
        note: feedWord(news, t, NEWS),
        max: 4,
      });
    }

    // What is on, between what has happened and what is being looked up, which is
    // the order in time as well as the order of the page. Fewer lines than either
    // of its neighbours: a fortnight of listings is a shorter answer than a day of
    // news and a less urgent one than what the country is searching for this hour,
    // and it is the group most likely to have two rows and no more.
    if (components.includes("events")) {
      groups.push({
        id: "events",
        label: t("events.title"),
        lines: (events.data ?? []).map((item) => item.title),
        note: feedWord(events, t, EVENTS),
        max: 3,
      });
    }

    if (components.includes("trends")) {
      groups.push({
        id: "trends",
        label: t("trends.title"),
        lines: (trends.data ?? []).map((item) =>
          // A search word seldom explains itself, so where the feed carries the
          // story behind the spike it goes on the same line — which is what lo
          // does with it too, under the word rather than after it.
          item.headline ? `${item.name} — ${item.headline}` : item.name,
        ),
        note: feedWord(trends, t, TRENDS),
        max: 4,
      });
    }

    return {
      title: placeTitle(context),
      block:
        groups.length > 0
          ? { kind: "readings", rows: stack(groups, BODY_LINES) }
          : // Nowhere lo can read a newswire, a trend or a listing for. Said once,
            // rather than three times in three empty groups.
            { kind: "note", text: t("world.unavailable") },
    };
  },

  /**
   * The same three groups, entry by entry — and the same three absences: a
   * country Google does not answer for has no Trends group on the summary and
   * none in the list either, so the wheel never carries the reader into a group
   * that was never on offer. A country with none of the three has no list at all,
   * and the tap that would open one does nothing (see glasses.ts).
   *
   * A listing is the same shape as a headline down here as well as up there, and
   * `feedItems` draws both: a source, an hour and the words, with lo's reading of
   * the page behind it once the row is opened. All that separates them is which
   * way the clock points (see feedTime in format.ts) and which word main.ts sends
   * with the request for the reading.
   */
  items(context): Item[] {
    const { news, events, trends, components } = context;
    return [
      ...(components.includes("nearby") ? feedItems("news", news, context, NEWS) : []),
      ...(components.includes("events") ? feedItems("events", events, context, EVENTS) : []),
      ...(components.includes("trends")
        ? trends.data?.length
          ? trends.data.map((item) => ({
              group: "trends",
              key: item.name,
              head: item.name,
              line: item.headline ?? "",
              body: item.headline ? `${item.name} — ${item.headline}` : item.name,
            }))
          : [nothing("trends", feedWord(trends, context.t, TRENDS))]
        : []),
    ];
  },
};
