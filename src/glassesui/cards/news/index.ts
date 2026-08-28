// What is happening around here — the newswire alone.
//
// lo keeps this and "what is on" as two cards on purpose: both come off the same
// upstream, which is what made merging them look free, and what it cost was the
// reader's question — somebody who came to find out what is happening got a list
// with half its rows answering something else. Two cards here for the same
// reason, and each can be scrolled past on its own.
//
// A row is a headline with its source and its age. There is nothing to press:
// the website's rows are links out to the article, and a pair of glasses has
// nowhere to open one — so what the row carries is what can be read on the
// spot. The whole story is on the phone, where the link works.

import { relativeTime } from "../../format";
import { feedNote } from "../feed";
import type { CardDefinition, CardView, ListRow } from "../types";

export const newsCard: CardDefinition = {
  id: "nearby",
  label: "news.title",

  // The server's answer, not ours: a country whose newswire lo cannot read is a
  // card left off rather than a card left empty.
  offered: ({ components }) => components.includes("nearby"),

  render({ nearby, locale, t }): CardView {
    const items = nearby.data?.items ?? [];
    const rows: ListRow[] = items.map((item) => ({
      lead: item.source,
      title: item.title,
      trail: relativeTime(item.time, locale, t),
    }));

    const note = feedNote(nearby, rows.length, t, {
      loading: "news.loading",
      empty: "news.empty",
      failed: "news.unavailable",
    });

    // The newswire answers with articles; where it has nothing for this corner of
    // the map the server sends Wikipedia's nearby places instead, and the heading
    // follows rather than calling a list of landmarks "news".
    const kind = items.length > 0 && items.every((item) => item.kind === "place") ? "places" : "local";

    return {
      title: t("news.title"),
      meta: items.length > 0 ? t(`news.${kind}`) : nearby.data?.place?.name,
      block: note ? { kind: "note", text: note } : { kind: "list", rows },
    };
  },
};
