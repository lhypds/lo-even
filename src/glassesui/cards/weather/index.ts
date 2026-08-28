// The sky here.
//
// lo's WeatherCard, in the same three parts: a big number, a line naming what it
// is, and the readings along the bottom. What does not survive the trip is the
// glyph — WeatherGlyph draws an SVG sun, and there is no drawing here — so the
// condition carries the whole of that job as words, which is why it sits beside
// the temperature rather than under it. The day's range goes in the heading,
// where lo puts it too.
//
// The forecast strip at the foot of lo's tile is left off. Three more days is
// four figures a line, and this card is already the widest thing on the screen;
// a reader who wants the week has a phone in their pocket.

import { weatherLabelKey } from "../../strings";
import type { CardDefinition, CardView, FaceRow } from "../types";

function round(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? Math.round(value as number) : null;
}

export const weatherCard: CardDefinition = {
  id: "weather",
  label: "weather.title",

  offered: () => true,

  render({ weather, t }): CardView {
    // The tile stands either way — only what is in it waits. This card has no
    // request of its own: the weather rides in with the place (GET /api/local),
    // so a null reading here means that one read has not landed or did not.
    if (!weather?.current) {
      return {
        title: t("weather.title"),
        block: { kind: "note", text: t("weather.unavailable") },
      };
    }

    const { current, today, units } = weather;
    const unit = units?.temperature ?? "°C";
    const temperature = round(current.temperature);

    const rows: FaceRow[] = [];
    const apparent = round(current.apparent);
    if (apparent != null) rows.push({ label: t("weather.feelsLike"), value: `${apparent}${unit}` });
    const humidity = round(current.humidity);
    if (humidity != null) rows.push({ label: t("weather.humidity"), value: `${humidity}%` });
    const wind = round(current.windSpeed);
    if (wind != null) rows.push({ label: t("weather.wind"), value: `${wind} ${units?.wind ?? "km/h"}` });

    const high = round(today?.tempMax);
    const low = round(today?.tempMin);

    return {
      title: t("weather.title"),
      meta: high != null && low != null ? `${high}° / ${low}°` : undefined,
      block: {
        kind: "face",
        hero: temperature != null ? `${temperature}${unit}` : "—",
        caption: t(weatherLabelKey(current.weatherCode)),
        rows,
      },
    };
  },
};
