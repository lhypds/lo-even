// Which way you are pointing, and how you are moving.
//
// Every figure on this card is an instrument's, and no part of it is asked of a
// server. Two of the three readings come off the fix — speed over the ground and
// the altitude the GPS claims — and the bearing comes off the phone's
// magnetometer through the same events lo's own compass card listens to (see
// sensors.ts, which is a port of lo/src/utils/sensors.js).
//
// The phone's, not the glasses'. The bridge does offer the glasses' IMU
// (`imuControl`, and IMU_DATA_REPORT events carrying a bare x/y/z), but a bare
// triple with no documented axis convention is not a bearing — turning it into
// one would be guesswork dressed up as a reading, and a compass that is
// confidently wrong is worse than none. The handset is bolted to the same person
// as the glasses and its compass is a known quantity.
//
// The tile is in two halves and they fail separately, which is lo's own
// arrangement and worth keeping: a phone that will not give up its gyroscope
// still knows where it is and how fast it is going, and a card going blank over
// the half it lacks would be hiding the half it has.

import type { CardDefinition, CardView, FaceRow } from "../types";

/** A dash, rather than a zero that would read as a reading. */
const NONE = "—";

// Eight points is as fine as a name is worth: a phone in a hand wanders further
// than sixteen of them are apart.
const POINTS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

function pointKey(heading: number): string {
  return POINTS[Math.round(heading / 45) % 8];
}

export const directionCard: CardDefinition = {
  id: "direction",
  label: "direction.title",

  offered: () => true,

  render({ coords, weather, heading, t }): CardView {
    const live = heading.status === "on";

    // The device's own altitude first and the ground under it second: a GPS that
    // can answer this is answering about the phone, which is what the rest of
    // the card is about. Open-Meteo's elevation is the terrain of a model cell
    // several kilometres wide — right about the valley, silent about the
    // building — so the card says which of the two it is showing.
    const altitude = Number.isFinite(coords?.altitude)
      ? { metres: coords?.altitude as number, ground: false }
      : Number.isFinite(weather?.elevation)
        ? { metres: weather?.elevation as number, ground: true }
        : null;

    // Over the ground, off the GPS, and never off the accelerometer — that
    // instrument measures force, and steady movement has none.
    const speed = Number.isFinite(coords?.speed) ? (coords?.speed as number) : null;

    const rows: FaceRow[] = [
      {
        label: altitude?.ground ? t("direction.ground") : t("direction.altitude"),
        value: altitude ? `${Math.round(altitude.metres)} m` : NONE,
      },
      { label: t("direction.speed"), value: speed == null ? NONE : `${speed.toFixed(1)} m/s` },
    ];
    // The one row that is an instrument's, and so the one that goes when the
    // instruments are off.
    if (live) {
      rows.push({
        label: t("direction.gyroscope"),
        value: heading.turnRate == null ? NONE : `${Math.round(heading.turnRate)} °/s`,
      });
    }

    // Half the tile has room for the bearing or for the reason there is none.
    // Where the instruments have not answered, the readings below still stand.
    let hero = NONE;
    let caption: string | undefined;
    if (live && heading.heading != null) {
      hero = `${Math.round(heading.heading)}°`;
      caption = t(`direction.point.${pointKey(heading.heading)}`);
    } else if (heading.status === "listening" || heading.status === "asking") {
      caption = t("common.loading");
    } else if (heading.status === "denied") {
      caption = t("direction.denied");
    } else if (heading.status === "unsupported") {
      caption = t("direction.unsupported");
    } else {
      caption = t("direction.enable");
    }

    return {
      title: t("direction.title"),
      // How sure the instrument is of itself, which is the one thing about a
      // bearing the bearing cannot say. Only iOS gives a figure for it.
      meta:
        live && Number.isFinite(heading.headingAccuracy)
          ? t("direction.accuracy", { degrees: Math.round(heading.headingAccuracy as number) })
          : undefined,
      block: { kind: "face", hero, caption, rows },
    };
  },
};
