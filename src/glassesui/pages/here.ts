// Where you are standing, and everything that is true of it.
//
// Five of lo's tiles on one screen — the map strip, the sky, the clock, the
// compass and whatever is in force overhead — and then, on the last two lines, a
// count of everything on the two pages after this one. They are one page because
// they are one question ("what is it like here"), and because a reader who has to
// flick four times to get from the temperature to the warning over their head
// will not do it. The website can afford a tile apiece; seven lines cannot, so
// each of them is a line and each line is a sentence of readings rather than one
// figure with an acre of screen after it.
//
// Those last two lines are what makes this a dashboard rather than the first of
// three: they say how much is waiting on the other pages, so a reader can tell at
// a glance whether scrolling is worth it. Everything they count is already in
// hand — one read answers the whole of it (see feeds.ts) — so the figures cost
// nothing but the lines they are written on.
//
// Nothing here is asked of a server except the place, its weather and the
// warnings: the bearing and the speed are the handset's own instruments, and the
// clock is the device's. A row whose reading is not in yet is left off rather
// than left blank — a page with five lines on it is a page that knows five
// things, where a column of empty labels would be five promises it cannot keep.

import {
  formatAccuracy,
  formatCoords,
  formatOffset,
  joined as line,
  localClockTime,
  relativeTime,
} from "../format";
import { weatherLabelKey } from "../strings";
import { placeTitle, zoneOf } from "./chrome";
import type { PageContext, PageDefinition, PageView, ReadingRow } from "./types";

/** A dash, rather than a zero that would read as a reading. */
const NONE = "—";

// Eight points is as fine as a name is worth: a phone in a hand wanders further
// than sixteen of them are apart.
const POINTS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

// The JMA's own set, which is what Yahoo relays: seven kinds of warning, sixteen
// of advisory, and the two that arrive as neither — 土砂災害, issued with the
// prefecture, and 熱中症, issued for the heat. Carried over from
// lo/src/utils/warnings.js: Yahoo names the weather in Japanese and the level is
// fixed by the band it arrived in, so nothing has to be fetched to put the
// reader's own words on either.
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
// against: a 注意報 is level 2, a 警報 level 3, and the two above it 4 and 5. It
// goes on the line as L3 rather than as the word it arrived as — "警報" and
// "Warning" are the same claim at four cells and eight, and this line has to
// carry two of them and their names.
const LEVELS: Record<string, number> = { emergency: 5, urgent: 4, warning: 3, advisory: 2 };

// How many warnings fit on the one line there is for them. The rest are a figure
// on the end of it, because a reader who knows there are two more will look at
// their phone.
const WARNINGS = 2;

function round(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? Math.round(value as number) : null;
}

/** The day and the daylight — everything about the time but the hour, which is in the heading. */
function whenRow(context: PageContext): ReadingRow {
  const { now, weather, locale, t } = context;
  const date = new Intl.DateTimeFormat(locale, {
    timeZone: zoneOf(context),
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(now);

  // The abbreviation where the server sent one, because JST is three cells where
  // Asia/Tokyo is ten and this line has three other things to say. The offset
  // stands in where it did not: a reader who has just stepped off a plane wants
  // to know which clock this is.
  const named =
    weather?.timezone?.abbreviation ||
    (Number.isFinite(weather?.timezone?.offsetSeconds)
      ? t("clock.offset", { offset: formatOffset(weather?.timezone?.offsetSeconds) })
      : "");

  const sunrise = localClockTime(weather?.today?.sunrise);
  const sunset = localClockTime(weather?.today?.sunset);

  return {
    label: t("clock.title"),
    value: line(date, named, sunrise && sunset ? `↑${sunrise} ↓${sunset}` : ""),
  };
}

/** The fix itself: where the phone thinks it is, how sure it is of that, and how high. */
function fixRow(context: PageContext): ReadingRow | null {
  const { coords, fixAt, weather, locale, t } = context;
  if (!coords) return null;

  // How high, from whichever of the two knows: the device's own altitude where the
  // GPS gives one, and the terrain the forecast was made for where it does not —
  // which on the glasses is always, because the Even bridge hands over a fix with
  // no altitude in it.
  //
  // Written bare, as a figure. The two are not quite the same claim — Open-Meteo's
  // elevation is a model cell several kilometres wide, right about the valley and
  // silent about which storey you are on — but saying so cost a word on the
  // fullest line of the page, and the word was what was getting cut.
  const height = Number.isFinite(coords.altitude)
    ? `${Math.round(coords.altitude as number)} m`
    : Number.isFinite(weather?.elevation)
      ? `${Math.round(weather?.elevation as number)} m`
      : "";

  // How old the fix is, and only once it is old enough to matter: a reading taken
  // this minute has nothing to say about its own age, and "just now" on every
  // line of every page is a word that stops being read.
  const age = fixAt && Date.now() - fixAt > 120_000 ? relativeTime(new Date(fixAt).toISOString(), locale, t) : "";

  return {
    label: t("location.fix"),
    value: line(formatCoords(coords.latitude, coords.longitude), formatAccuracy(coords.accuracy), height, age),
  };
}

/** The two weather lines: what it is out there now, and what the day is doing. */
function skyRows({ weather, t }: PageContext): ReadingRow[] {
  const current = weather?.current;
  if (!current) return [];

  const unit = weather?.units?.temperature ?? "°C";
  const temperature = round(current.temperature);
  const apparent = round(current.apparent);
  const humidity = round(current.humidity);
  const wind = round(current.windSpeed);
  const high = round(weather?.today?.tempMax);
  const low = round(weather?.today?.tempMin);

  const rows: ReadingRow[] = [
    {
      label: t("weather.title"),
      value: line(
        temperature != null ? `${temperature}${unit}` : NONE,
        // The lowercase short form, because this is the second thing on a line
        // rather than the label of a row of its own.
        apparent != null ? `${t("weather.feels")} ${apparent}°` : "",
        t(weatherLabelKey(current.weatherCode)),
      ),
    },
  ];

  const today = line(
    high != null && low != null ? `${low}-${high}°` : "",
    humidity != null ? `${humidity}%` : "",
    wind != null ? `${wind} ${weather?.units?.wind ?? "km/h"}` : "",
  );
  if (today) rows.push({ label: t("weather.today"), value: today });
  return rows;
}

/**
 * What is in force overhead, most severe first — which is the order it is cut
 * short in, because where four warnings do not fit the two that go had better be
 * the two that matter least.
 *
 * Nothing at all when there is nothing in force. lo says "発表なし" out loud on a
 * tile of its own and is right to; a line here saying the same would cost the
 * page a line on every clear day in exchange for a fact the reader can read off
 * its absence. What is never silent is a failure — "nothing in force" is the one
 * wrong answer this screen can give when nobody could be reached (see feed.ts).
 */
function warningRow({ warnings, components, t }: PageContext): ReadingRow | null {
  if (!components.includes("warnings")) return null;

  const items = [...(warnings.data?.items ?? [])].sort(
    (a, b) => (LEVELS[b.severity] ?? 0) - (LEVELS[a.severity] ?? 0),
  );

  if (items.length === 0) {
    return warnings.status === "failed"
      ? { label: t("warnings.title"), value: t("warnings.unavailable") }
      : null;
  }

  const said = items.slice(0, WARNINGS).map((item) => {
    const key = item.name in KINDS ? `warnings.kind.${KINDS[item.name]}` : null;
    // Filled for anything at warning strength, hollow for an advisory: the level
    // beside it is the claim, this is only what the eye catches first. lo draws
    // these as two discs; here they are the two characters nearest to them.
    const mark = item.severity === "advisory" ? "○" : "●";
    // Nothing back for a kind the table has never seen: the Japanese it arrived
    // as is worth more to a reader standing in Japan than a blank or a guess.
    const level = LEVELS[item.severity];
    return `${mark} ${key ? t(key) : item.name}${level ? ` L${level}` : ""}`;
  });

  const rest = items.length - said.length;
  return { label: t("warnings.short"), value: said.join(" · ") + (rest > 0 ? ` +${rest}` : "") };
}

/**
 * A word and how many of them there are, for the two lines that are a table of
 * contents. Joined with lo's own " · ", the way every other line on every page
 * here is joined: these read as three things in a sentence rather than as three
 * columns, and a page where one line is spaced differently from the six above it
 * is a page the eye has to be told about.
 *
 * The dot itself comes from the dictionary, because this line runs to within a
 * cell of the end of the screen in the language that needs the most room:
 * `ニュース 3 · イベント 2 · トレンド 3` is one cell too wide and loses the last
 * count to the clipper, where `ニュース 3・イベント 2・トレンド 3` fits — and a
 * tight interpunct is what Japanese writes a list with anyway. Counts that run to
 * two digits will still take a line past the end, and always could: the clipper is
 * the backstop, and `npm run glasses:preview -- ja` is where to look before any of
 * these words is made longer.
 */
function counted(join: string, pairs: Array<[string, number | null]>): string {
  return pairs
    .filter((pair): pair is [string, number] => pair[1] != null)
    .map(([word, count]) => `${word} ${count}`)
    .join(join);
}

/**
 * The last two lines: what is on the two pages after this one. A count rather
 * than a promise — "posts 3" is a reason to scroll and an empty page is not, and
 * this is the only screen that can say so before the reader has spent the flick
 * finding out.
 *
 * A feed the country does not have is left out of the count rather than counted
 * as none: nought trends in a place Google does not answer for is not a fact
 * about the place.
 */
function tallyRows(context: PageContext): ReadingRow[] {
  const { posts, people, news, events, trends, components, username, t } = context;
  const rows: ReadingRow[] = [];

  const join = t("tally.join");

  // In the order the page they count is in, so the line reads as a table of
  // contents rather than as three figures: who is here, what they left here,
  // what is on here.
  const others = (people.data ?? []).filter((person) => person.username !== username);
  const nearby = counted(join, [
    [t("people.title"), people.data ? others.length : null],
    [t("posts.title"), posts.data?.length ?? null],
    [t("events.title"), components.includes("events") ? (events.data?.length ?? null) : null],
    // The letters are not counted here, and they are the one group on that page
    // that is not: how much is waiting to be read is in the corner of the
    // heading of every screen in the app, badge and hour together (see
    // theme.ts), so a fourth count here would be the same figure twice on one
    // screen — and it is the figure that pushed this line past the end of it.
  ]);
  if (nearby) rows.push({ label: t("nearby.title"), value: nearby });

  const wider = counted(join, [
    [t("news.title"), components.includes("nearby") ? (news.data?.length ?? null) : null],
    [t("trends.title"), components.includes("trends") ? (trends.data?.length ?? null) : null],
  ]);
  if (wider) rows.push({ label: t("world.title"), value: wider });

  return rows;
}

export const herePage: PageDefinition = {
  // The warnings are the one read this page waits on beyond the fix itself, and
  // it is the page the app opens on — so that read goes out with the fix rather
  // than waiting to be scrolled to (see feeds.ts).
  id: "here",

  // Standing somewhere is not a thing any country can fail to support.
  offered: () => true,

  render(context): PageView {
    const { coords, heading: bearing, t } = context;

    // The compass rides in the heading beside the clock rather than taking a line
    // of its own: seven lines is seven, and a bearing is two words next to the
    // hour where it would be an eighth of the screen underneath it. Only while the
    // instruments are actually answering — a compass that is confidently wrong is
    // worse than none, and this is the phone's magnetometer rather than the
    // glasses' bare x/y/z (see sensors.ts).
    const facing =
      bearing.status === "on" && bearing.heading != null
        ? `${Math.round(bearing.heading)}° ${t(`direction.point.${POINTS[Math.round(bearing.heading / 45) % 8]}`)}`
        : "";
    const heading = { title: placeTitle(context), meta: facing || undefined };

    if (!coords) {
      return { ...heading, block: { kind: "note", text: t("glasses.noFix") } };
    }

    const rows: ReadingRow[] = [whenRow(context)];
    const fix = fixRow(context);
    if (fix) rows.push(fix);
    rows.push(...skyRows(context));
    const warning = warningRow(context);
    if (warning) rows.push(warning);
    rows.push(...tallyRows(context));

    return { ...heading, block: { kind: "readings", rows } };
  },
};
