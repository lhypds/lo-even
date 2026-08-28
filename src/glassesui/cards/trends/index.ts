// What the country is searching for.
//
// Ten rows by definition, numbered, with the volume Google rounds each of them
// down to. A search word seldom explains itself, so where the feed carries the
// story behind the spike lo shows it — here it goes in the lead column, in front
// of the word rather than under it, because a row on this screen is one line.
//
// The heading names the place Google actually answered for. "Trending in Kyoto"
// and "trending in Japan" are different claims, and the server says which of the
// two it got — repeated here rather than letting the reader assume the narrower.

import { feedNote } from "../feed";
import type { CardDefinition, CardView, ListRow } from "../types";

export const trendsCard: CardDefinition = {
  id: "trends",
  label: "trends.title",

  offered: ({ components }) => components.includes("trends"),

  render({ trends, locale, t }): CardView {
    // Google rounds search volume down to a floor — 200+, 20000+ — so the number
    // is an order of magnitude and is shown as one, with the + it arrived with.
    const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });

    const items = trends.data?.items ?? [];
    const rows: ListRow[] = items.map((item, index) => ({
      lead: `${index + 1}.`,
      title: item.headline ? `${item.name} — ${item.headline}` : item.name,
      trail: item.count != null ? `${compact.format(item.count)}+` : "",
    }));

    const note = feedNote(trends, rows.length, t, {
      loading: "trends.loading",
      empty: "trends.empty",
      failed: "trends.unavailable",
    });

    return {
      title: t("trends.title"),
      meta: trends.data?.name,
      block: note ? { kind: "note", text: note } : { kind: "list", rows },
    };
  },
};
