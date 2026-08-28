// lo's own way of writing down a distance, a time and a place, ported from
// lo/src/utils/format.js so that a row on the glasses reads exactly as the same
// row reads on the phone. Kept as a copy rather than shared, because the two
// live in different repositories — but the arithmetic is the website's and any
// change there belongs here too.

import type { Coordinates } from "../types";
import type { Translate } from "./strings";

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
