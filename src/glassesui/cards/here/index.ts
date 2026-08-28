// Where you are standing, as figures.
//
// This is lo's map tile, and it is the one card that could not be carried over
// as it stands: a map is a picture, and the only picture this display can be
// given is a 4-bit bitmap pushed over BLE a fragment at a time. A tile of grey
// mush is worse than no map, so what stands in its place is the other half of
// what lo says about the ground — the strip above its dashboard, which names the
// place, gives the coordinates and says how good the fix is.
//
// Local, all of it. The fix comes off the handset (see main.ts) and only the
// name on it is the server's, which is why the card still draws with everything
// filled in but the top line when lo.gcc3.com cannot be reached.

import { formatAccuracy, formatCoords, relativeTime } from "../../format";
import type { CardDefinition, CardView, FaceRow } from "../types";

export const hereCard: CardDefinition = {
  id: "here",
  label: "location.title",

  offered: () => true,

  render({ coords, fixAt, place, locale, t }): CardView {
    if (!coords) {
      return {
        title: t("location.title"),
        block: { kind: "note", text: t("glasses.noFix") },
      };
    }

    // The hero is the place rather than the coordinates: a name is what a reader
    // recognises, and the numbers under it are what they would write down.
    const name = place?.name || place?.locality || t("location.title");

    // The coordinates go in the label column and take the whole line, which is
    // the one row here that is not a pair. lo does the same thing above its
    // dashboard — the figures stand on their own and the accuracy is what is
    // said *about* them — and a row of digits pushed to the right under a
    // labelled one would read as the value of a label that is not there.
    const rows: FaceRow[] = [
      { label: formatCoords(coords.latitude, coords.longitude), value: "" },
      { label: t("location.accuracy"), value: formatAccuracy(coords.accuracy) || "—" },
    ];

    return {
      title: t("location.title"),
      // How old the fix is, which is the one thing about a position the position
      // itself cannot say — a reading ten minutes old is somebody who has since
      // walked off.
      meta: fixAt ? relativeTime(new Date(fixAt).toISOString(), locale, t) : t("location.locating"),
      block: {
        kind: "face",
        hero: name,
        // The wider place beside the narrow one, and never the same word twice:
        // a locality that is its own name adds nothing, and the footer is
        // already carrying the full string.
        caption:
          [place?.locality !== name ? place?.locality : null, place?.region]
            .filter(Boolean)
            .filter((part, index, all) => all.indexOf(part) === index)
            .join(" · ") || undefined,
        rows,
      },
    };
  },
};
