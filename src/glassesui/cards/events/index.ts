// What is on around here.
//
// The other half of the pair the newswire feeds, and a card of its own for the
// reason it is one on the website: "what is happening here" and "what is on
// here" are two questions, and a list that answers both answers whichever one
// you were not asking in most of its rows.

import { relativeTime } from "../../format";
import { feedNote } from "../feed";
import type { CardDefinition, CardView, ListRow } from "../types";

export const eventsCard: CardDefinition = {
  id: "events",
  label: "events.title",

  offered: ({ components }) => components.includes("events"),

  render({ events, locale, t }): CardView {
    const items = events.data?.items ?? [];
    const rows: ListRow[] = items.map((item) => ({
      lead: item.source,
      title: item.title,
      trail: relativeTime(item.time, locale, t),
    }));

    const note = feedNote(events, rows.length, t, {
      loading: "events.loading",
      empty: "events.empty",
      failed: "events.unavailable",
    });

    return {
      title: t("events.title"),
      meta: events.data?.place?.name,
      block: note ? { kind: "note", text: note } : { kind: "list", rows },
    };
  },
};
