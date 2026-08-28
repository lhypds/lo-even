// Who else has a tab open around here.
//
// lo's PeopleCard, and the list arrives the same way it does there: it is not a
// request of this card's own but the answer to publishing our own fix, which the
// minute loop is making anyway (PUT /api/position hands back everyone else's —
// see lo/server/index.js, and services/feeds.ts on this side). Presence costs
// the glasses nothing extra.
//
// Nearest first, and you at the top of it. Your own row is built here rather
// than sent by the server, which leaves the asker out on purpose — and it
// carries no distance and no age, because both are zero and "0.0 m · just now"
// is three ways of saying "here".

import { distanceMeters, formatDistance, formatUsername, relativeTime } from "../../format";
import { feedNote } from "../feed";
import type { CardDefinition, CardView, ListRow } from "../types";

export const peopleCard: CardDefinition = {
  id: "people",
  label: "people.short",

  // lo's own: people stop at no border, so there is nothing on the server to ask.
  offered: () => true,

  render({ people, coords, username, locale, t }): CardView {
    const rows: ListRow[] = [];

    if (username) {
      rows.push({ title: formatUsername(username), trail: t("people.you") });
    }

    // Without a fix of our own there is no distance to sort on, and the order the
    // server sent — most recently seen first — is the better one anyway.
    const others = (people.data ?? [])
      .map((person) => ({ person, away: coords ? distanceMeters(coords, person) : Infinity }))
      .sort((a, b) => a.away - b.away);

    for (const { person, away } of others) {
      // A position is only worth as much as its age — a dot ten minutes old is
      // somebody who has already walked off.
      const seen = relativeTime(person.time, locale, t);
      const near = Number.isFinite(away) ? formatDistance(away) : "";
      rows.push({
        title: formatUsername(person.username),
        trail: [near, seen].filter(Boolean).join(" · "),
      });
    }

    // Bars under your own row until the first trade comes back. Nothing after
    // that: the list is never empty now that you are on it, and a sentence saying
    // nobody is here under a row with your name on it would be the card arguing
    // with itself.
    const note =
      rows.length === 0
        ? feedNote(people, 0, t, {
            loading: "common.loading",
            empty: "common.loading",
            failed: "glasses.offline",
          })
        : null;

    return {
      title: t("people.short"),
      // Everyone the list holds, your own row included: a figure that counted the
      // rows differently from the way they are drawn would be the card arguing
      // with itself.
      meta: rows.length ? String(rows.length) : undefined,
      block: note ? { kind: "note", text: note } : { kind: "list", rows },
    };
  },
};
