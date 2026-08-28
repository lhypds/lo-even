// What is being reported, searched and put on in the wider place you are in.
//
// lo keeps these as three cards on purpose: they come off the same upstream,
// which is what made merging them look free, and what it cost was the reader's
// question — somebody who came to find out what is happening got a list with half
// its rows answering something else. They are one page here and still three
// answers, because the word in the margin says which of the three each line is,
// and because seven lines of the freshest of each is worth more on a screen this
// size than seven headlines and two more flicks to reach the rest.
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
// There is nothing to press. The website's rows are links out to the article, the
// search or the ticket, and a pair of glasses has nowhere to open one — so what a
// row carries is what can be read on the spot. The rest is on the phone, where
// the link works.

import { BODY_LINES } from "../theme";
import { placeTitle } from "./chrome";
import { feedWord } from "./feed";
import { stack, type Group } from "./stack";
import type { PageDefinition, PageView } from "./types";

export const worldPage: PageDefinition = {
  // Three feeds, all of them already in hand: they come back with the fix on the
  // one read this app makes of it (see feeds.ts), so arriving here costs nothing.
  id: "world",

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
        label: t("news.title"),
        lines: (news.data ?? []).map((item) => item.title),
        note: feedWord(news, t, {
          loading: "news.loading",
          empty: "news.empty",
          failed: "news.unavailable",
        }),
        max: 4,
      });
    }

    if (components.includes("trends")) {
      groups.push({
        label: t("trends.title"),
        lines: (trends.data ?? []).map((item) =>
          // A search word seldom explains itself, so where the feed carries the
          // story behind the spike it goes on the same line — which is what lo
          // does with it too, under the word rather than after it.
          item.headline ? `${item.name} — ${item.headline}` : item.name,
        ),
        note: feedWord(trends, t, {
          loading: "trends.loading",
          empty: "trends.empty",
          failed: "trends.unavailable",
        }),
        max: 3,
      });
    }

    if (components.includes("events")) {
      groups.push({
        label: t("events.title"),
        lines: (events.data ?? []).map((item) => item.title),
        note: feedWord(events, t, {
          loading: "events.loading",
          empty: "events.empty",
          failed: "events.unavailable",
        }),
        max: 3,
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
};
