// lo's own way of writing down a distance, a time and a place, ported from
// lo/src/utils/format.js so that a row on the glasses reads exactly as the same
// row reads on the phone. Kept as a copy rather than shared, because the two
// live in different repositories — but the arithmetic is the website's and any
// change there belongs here too.

import type { Coordinates, LoPost } from "../types";
import type { Translate } from "./strings";

/**
 * What a post says, which is its words — or, for a photo with no words, where it
 * was taken, and the coordinates for that.
 *
 * Here rather than on either page that draws a list of posts, because both of
 * them do: the ground under the reader on one screen and one person's own last
 * few on another, and a post that read differently on the two would be the same
 * post twice. It is lo's own expression, written the same way in both of the
 * places lo lists posts.
 */
export function postSays({ body, place, latitude, longitude }: LoPost): string {
  return body || place || formatCoords(latitude, longitude);
}

/** Coordinates the way a map reads them: north/south first. */
export function formatCoords(latitude: number, longitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(4)}°${latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(longitude).toFixed(4)}°${longitude >= 0 ? "E" : "W"}`;
  return `${lat} ${lon}`;
}

// A username is never shown bare: the @ is what makes it read as a person rather
// than as a word that happens to be there.
export function formatUsername(username: string): string {
  return `@${username}`;
}

export function formatAccuracy(meters: number | undefined | null): string {
  if (!Number.isFinite(meters)) return "";
  const value = meters as number;
  if (value < 1000) return `±${Math.round(value)} m`;
  return `±${(value / 1000).toFixed(1)} km`;
}

const EARTH_RADIUS_M = 6_371_008.8;

export function distanceMeters(a: Coordinates, b: { latitude: number; longitude: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = rad(a.latitude);
  const lat2 = rad(b.latitude);
  const dLat = lat2 - lat1;
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Three significant figures at every scale: a 4 m gap reads as 4.2 m, a city
// crossing as 12.3 km.
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "";
  if (meters < 1000) return `${meters < 10 ? meters.toFixed(1) : Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 2 : 1)} km`;
}

/**
 * "3 min ago", and the date itself once it is more than a week old. Shortened
 * from the website's: a trail column is nine cells wide, so the glasses take the
 * narrow form of every unit — "3m", "2h", "4d" — where the phone has room to
 * spell them out.
 */
export function relativeTime(iso: string | null | undefined, locale: string, t: Translate): string {
  if (!iso) return "";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  const seconds = Math.round((Date.now() - time) / 1000);
  if (seconds < 60) return t("time.now");
  if (seconds < 3600) return t("time.minutes", { n: Math.floor(seconds / 60) });
  if (seconds < 86400) return t("time.hours", { n: Math.floor(seconds / 3600) });
  if (seconds < 604800) return t("time.days", { n: Math.floor(seconds / 86400) });
  return new Date(time).toLocaleDateString(locale, { month: "short", day: "numeric" });
}

/**
 * The same age with the word that says it is one: "39m ago" where the form above
 * says "39m", and 39分前 / 39分钟前 where it says 39分 / 39分钟.
 *
 * There are two of these because there is one line in the app where a bare unit
 * is not safe. Everywhere the narrow form is used it stands beside a name —
 * `@mari · 39m` — and nothing near it is a measurement. The fix row is the
 * exception: it reads `35.6580°N 139.7016°E · ±12 m · 39 m · 39m`, and the last
 * two of those are a height in metres and an age in minutes written with the
 * same letter. A reader standing 39 metres up, 39 minutes after their last fix,
 * is looking at the same figure twice and can only tell them apart by knowing
 * which order this file writes them in.
 *
 * `Intl.RelativeTimeFormat` rather than the dictionary, because it is lo's own
 * way of saying this on the phone and because the word is the language's
 * business: 前 goes after the figure and "ago" after the unit, and neither of
 * them is something this file should be deciding. Narrow, because the row it
 * goes on has about a hundred pixels to spare — the long form ("39 minutes
 * ago") is fifty over the end of it, and the short one is twenty-five over.
 *
 * The thresholds are the narrow form's, so the two never disagree about which
 * unit an age is in.
 */
export function formatAge(iso: string | null | undefined, locale: string, t: Translate): string {
  if (!iso) return "";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  const seconds = Math.round((Date.now() - time) / 1000);
  if (seconds < 60) return t("time.now");
  if (seconds >= 604800) return new Date(time).toLocaleDateString(locale, { month: "short", day: "numeric" });

  const [unit, size]: [Intl.RelativeTimeFormatUnit, number] =
    seconds < 3600 ? ["minute", 60] : seconds < 86400 ? ["hour", 3600] : ["day", 86400];
  // "auto" is what turns a day ago into "yesterday" — the wording lo's own rows
  // use, and one fewer figure on a line already full of them.
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" }).format(
    -Math.floor(seconds / size),
    unit,
  );
}

/**
 * A stretch of time in the narrow forms above — "3h48m", "48m" — for a reading
 * that is a length rather than an age. `relativeTime` answers "how long ago" and
 * rounds to one unit, which is right for a post and wrong for the light left in
 * the day: "3h" is anything from three hours to four, and a reader deciding
 * whether to walk home wants the minutes as well.
 *
 * The units are the reader's own, taken from the same two keys the trail column
 * uses, and set hard against each other: "3時間48分" is how Japanese writes it,
 * and a space between the two would be a space in the middle of one figure.
 */
export function formatSpan(minutes: number, t: Translate): string {
  const whole = Math.max(0, Math.round(minutes));
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  if (hours === 0) return t("time.minutes", { n: rest });
  if (rest === 0) return t("time.hours", { n: hours });
  return `${t("time.hours", { n: hours })}${t("time.minutes", { n: rest })}`;
}

/**
 * When a feed item is, which is not always in the past. A news story happened
 * and reads as "2h"; a listing has not happened yet, and `relativeTime` would
 * make "just now" of every one of them — a negative age falls under a minute and
 * comes back as the word for now. So anything still ahead of us is given the day
 * it falls on instead, which is what a reader wants off a listing anyway.
 */
export function feedTime(iso: string | null | undefined, locale: string, t: Translate): string {
  const time = Date.parse(iso ?? "");
  if (Number.isNaN(time)) return "";
  if (time > Date.now() + 60_000) {
    return new Date(time).toLocaleDateString(locale, { month: "short", day: "numeric" });
  }
  return relativeTime(iso, locale, t);
}

/**
 * The pieces of one line, dropping whatever is not in, joined lo's own way. The
 * dot with a space either side of it is what the website puts between the parts
 * of a reading, and every line on these pages is built with this so that none of
 * them has to decide again.
 */
export function joined(...parts: Array<string | null | undefined | false>): string {
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

/** The place, written the way lo writes it in the strip above its dashboard. */
export function formatPlace(place: { name?: string; locality?: string; region?: string } | null): string {
  if (!place) return "";
  return [place.locality, place.name, place.region]
    .filter((part): part is string => Boolean(part))
    .filter((part, index, all) => all.indexOf(part) === index)
    .join(" · ");
}

/** The clock face out of an Open-Meteo local timestamp, which is a slice and not a parse. */
export function localClockTime(value: string | null | undefined): string {
  return typeof value === "string" && value.includes("T") ? value.slice(11, 16) : "";
}

/** The IANA offset as lo writes it: UTC+09:00. */
export function formatOffset(seconds: number | undefined): string {
  if (!Number.isFinite(seconds)) return "";
  const total = Math.abs(seconds as number);
  const sign = (seconds as number) < 0 ? "-" : "+";
  const hours = String(Math.floor(total / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

/** The locale tag for a language lo knows, which Intl wants in full. */
export function localeFor(language: string): string {
  return language === "zh" ? "zh-CN" : language === "ja" ? "ja-JP" : "en-US";
}
