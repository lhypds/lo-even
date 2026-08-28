// The time here — read off this device and nothing else.
//
// Nothing on this card is asked of a server. The one thing that is not the
// handset's own is the zone, which arrives with the weather because Open-Meteo
// is asked for the coordinates' own timezone rather than the visitor's
// (`timezone=auto`, see lo/server/geo.js); until it lands the browser's own zone
// stands in, exactly as lo's ClockCard does it — the numbers are right for the
// reader before they are right for the coordinates.
//
// No seconds, where the website has them. On a phone a ticking second is free;
// here every changed line is a write down a BLE link, and a card that redrew
// itself sixty times a minute would spend the whole radio budget saying what the
// minute already said. The clock is repainted when the minute turns (see the
// wake in main.ts).

import { formatOffset, localClockTime } from "../../format";
import type { CardDefinition, CardView, FaceRow } from "../types";

export const clockCard: CardDefinition = {
  id: "clock",
  label: "clock.title",

  // Standing somewhere is not a thing any country can fail to support.
  offered: () => true,

  render({ now, weather, locale, t }): CardView {
    const zone = weather?.timezone?.id || Intl.DateTimeFormat().resolvedOptions().timeZone;

    const time = new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);

    const date = new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(now);

    const today = weather?.today;
    const rows: FaceRow[] = [{ label: t("clock.timezone"), value: zone }];
    if (today?.sunrise) rows.push({ label: t("clock.sunrise"), value: localClockTime(today.sunrise) });
    if (today?.sunset) rows.push({ label: t("clock.sunset"), value: localClockTime(today.sunset) });

    return {
      title: t("clock.title"),
      meta: weather?.timezone
        ? t("clock.offset", { offset: formatOffset(weather.timezone.offsetSeconds) })
        : undefined,
      block: { kind: "face", hero: time, caption: date, rows },
    };
  },
};
