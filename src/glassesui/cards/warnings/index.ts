// What is in force where you are standing.
//
// The 特別警報, 警報 and 注意報 Yahoo! 防災速報 would have pushed to a phone here.
// Japan only — the server says as much, and where it says no the card takes
// itself off the sequence rather than claiming an all clear it has no way of
// knowing. That is the one thing this card must never get wrong, which is also
// why "nobody could be reached" is a different sentence from "nothing in force":
// see feed.ts.
//
// The tables below are lo/src/utils/warnings.js, carried over. Yahoo names the
// weather in Japanese and the level is fixed by the band it arrived in, so
// nothing has to be fetched to put the reader's own words on either.

import { relativeTime } from "../../format";
import { feedNote } from "../feed";
import type { CardDefinition, CardView, ListRow } from "../types";

// The JMA's own set, which is what Yahoo relays: seven kinds of warning, sixteen
// of advisory, and the two that arrive as neither — 土砂災害, issued with the
// prefecture, and 熱中症, issued for the heat.
const KINDS: Record<string, string> = {
  大雨: "rain",
  洪水: "flood",
  暴風: "storm",
  暴風雪: "blizzard",
  大雪: "heavySnow",
  波浪: "waves",
  高潮: "surge",
  強風: "gale",
  風雪: "galeSnow",
  雷: "thunder",
  融雪: "snowmelt",
  濃霧: "fog",
  乾燥: "dry",
  なだれ: "avalanche",
  低温: "lowTemperature",
  霜: "frost",
  着氷: "icing",
  着雪: "snowAccretion",
  土砂災害: "landslide",
  竜巻: "tornado",
  記録的短時間大雨: "recordRain",
  熱中症: "heat",
};

// 警戒レベル, the five-step scale the whole country's evacuation advice is written
// against: a 注意報 is level 2, a 警報 level 3, and the two above it 4 and 5.
const LEVELS: Record<string, number> = { emergency: 5, urgent: 4, warning: 3, advisory: 2 };

export const warningsCard: CardDefinition = {
  id: "warnings",
  label: "warnings.title",

  offered: ({ components }) => components.includes("warnings"),

  render({ warnings, locale, t }): CardView {
    const result = warnings.data;
    const items = result?.items ?? [];

    const rows: ListRow[] = items.map((item) => {
      const key = item.name in KINDS ? `warnings.kind.${KINDS[item.name]}` : null;
      const level = LEVELS[item.severity] ?? null;
      return {
        // Filled for anything at warning strength, hollow for an advisory: the
        // word beside it is the claim, this is only what the eye catches first.
        // lo draws these as two discs; here they are the two characters nearest
        // to them, which is as far as a text-only display goes.
        lead: item.severity === "advisory" ? "○" : "●",
        // Nothing back for a kind the table has never seen: the card shows the
        // Japanese it arrived as, which is worth more to a reader standing in
        // Japan than a blank or a guess would be.
        title: key ? t(key) : item.name,
        trail: [t(`warnings.severity.${item.severity}`), level != null ? t("warnings.level", { level }) : ""]
          .filter(Boolean)
          .join(" · "),
      };
    });

    const note = feedNote(warnings, rows.length, t, {
      loading: "warnings.loading",
      empty: "warnings.empty",
      failed: "warnings.unavailable",
    });

    return {
      title: t("warnings.title"),
      // When it was said, which on this card is half the answer: an hour-old
      // bulletin may have been lifted since.
      meta: result?.issuedAt
        ? t("warnings.issued", { time: relativeTime(result.issuedAt, locale, t) })
        : result?.area,
      block: note ? { kind: "note", text: note } : { kind: "list", rows },
      context: result?.area,
    };
  },
};
