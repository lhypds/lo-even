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
// **What is left over goes to the days ahead.** Everything above answers a
// question about the minute the reader is standing in; lo's weather tile also
// lists the two days after this one, and up here they are written into whatever
// lines nothing else wanted — which is one of them on an ordinary day and none
// at all under a warning. That is the only way this page can say more without
// ever saying it on a second screenful, and a second screenful is the one thing
// it may not have: the count of everything else on the app is on the last line
// of this one, and a count a flick away is a count nobody reads.
//
// Nothing here is asked of a server except the place, its weather and the
// warnings: the bearing and the speed are the handset's own instruments, the
// clock is the device's, and the light left in the day is the two ends of it
// subtracted from the hour. A row whose reading is not in yet is left off rather
// than left blank — a page with five lines on it is a page that knows five
// things, where a column of empty labels would be five promises it cannot keep.

import {
  formatAccuracy,
  formatAge,
  formatCoords,
  formatOffset,
  formatSpan,
  joined as line,
  localClockTime,
} from "../format";
import { weatherLabelKey } from "../strings";
import { BODY_LINES } from "../theme";
import { placeTitle, zoneOf } from "./chrome";
import type { PageContext, PageDefinition, PageView, ReadingRow } from "./types";

/** A dash, rather than a zero that would read as a reading. */
const NONE = "—";

/** Minutes in a day, for the one reading that counts across midnight. */
const DAY_MINUTES = 24 * 60;

// Under this the phone is standing still and saying so badly. A GPS fix wanders
// by metres while a hand is held out, and the speed it derives from that wander
// is a tenth of a metre a second of nothing at all — so a line that printed
// every reading would say the reader was walking while they stood at a crossing.
// Half a metre a second is a third of a walking pace: past it something is
// actually happening.
const MOVING_MS = 0.5;

// Past this a fix is old enough to say so. Two minutes because the app takes one
// on the minute beat: a reading a minute old is the newest there has ever been,
// and a line that announced its age would be announcing that the app is working.
const STALE_MS = 120_000;

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

/** `05:12` as minutes since midnight, and null for anything that is not one. */
function minutesOfClock(face: string): number | null {
  const [hours, minutes] = face.split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
}

/**
 * The clock where the reader is standing, as minutes since its own midnight.
 *
 * Everything about the sun on this page is arithmetic between two wall clocks,
 * and this is what makes it arithmetic rather than timezone work: Open-Meteo
 * writes sunrise as the place's own local time with no offset on it
 * ("2026-08-28T05:12"), so a `Date` made of it would be re-read as the handset's
 * zone — right for a reader at home and an hour or two wrong for one who has
 * just landed. Two numbers of minutes taken in the same zone subtract correctly
 * without either of them ever having been a date.
 *
 * `en-GB` because this is arithmetic rather than anything anybody reads: the
 * reader's own locale would set this hour in whatever numerals and order it
 * writes an hour in, and it is being taken apart on a colon two lines below.
 */
function clockMinutes(context: PageContext): number {
  const face = new Intl.DateTimeFormat("en-GB", {
    timeZone: zoneOf(context),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(context.now);
  return minutesOfClock(face) ?? 0;
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
  // which on the glasses is nearly always, because the fix the Even bridge hands
  // over may carry an altitude and mostly does not (see main.ts).
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
  //
  // Spelled with the word that says it is an age, which no other line in the app
  // needs: this one already has two lengths in metres on it, and "39 m · 39m" is
  // a height and three quarters of an hour told apart by a space (see formatAge).
  const age = fixAt && Date.now() - fixAt > STALE_MS ? formatAge(new Date(fixAt).toISOString(), locale, t) : "";

  // How fast over the ground, and only while that is a fact rather than a jitter
  // (see MOVING_MS). It is the GPS's own figure and never the accelerometer's —
  // that instrument measures force, and steady movement has none, so a speed
  // taken off it is nought on a train doing two hundred. In metres a second,
  // which is what lo's own compass card says: the same reading in the same units
  // on both screens.
  //
  // Never beside the age, and that is about honesty rather than about the width
  // it buys back: a speed is a reading off the fix like any other, so a fix three
  // quarters of an hour old that says 1.4 m/s is saying the reader is walking
  // *now* on the strength of where they were walking then. The line either says
  // how fast this is or how old it is, and once it is old enough to have to say
  // so, that is the only one of the two that is still true.
  //
  // Left off far more often than it is drawn in any case: most fixes carry no
  // speed at all, and the Even bridge's often carries none even while the phone
  // is moving. A row that said "0.0 m/s" for all of that would be a claim about
  // the reader made out of a field nobody filled in.
  const speed =
    !age && Number.isFinite(coords.speed) && (coords.speed as number) >= MOVING_MS
      ? `${(coords.speed as number).toFixed(1)} m/s`
      : "";

  // Where, how sure, how high, and then whichever of the last two is true. The
  // ± comes off with the speed once there is an age to write, and for a plainer
  // reason than the speed's: this line is four readings and a limit, and at
  // three quarters of an hour old the answer to "how well does this screen know
  // where I am standing" is the age rather than the metres. `35.6580°N
  // 139.7016°E · ±12 m · 39 m · 39分钟前` is four pixels past the end of the
  // column in Chinese — it would arrive with its last character clipped — and
  // the reading that has to go is the one the age has already answered over.
  return {
    label: t("location.fix"),
    value: line(
      formatCoords(coords.latitude, coords.longitude),
      age ? "" : formatAccuracy(coords.accuracy),
      height,
      speed,
      age,
    ),
  };
}

/**
 * How much of the day's light is left — the one reading on this page that is
 * neither the server's nor an instrument's, but the two clocks either side of
 * the reader subtracted from each other.
 *
 * Three answers to what is really one question, and which one is true is decided
 * by where the hour falls between the two:
 *
 *   • Before the sun is up: how long until it is.
 *   • While it is up: how long there is left of it, which is the figure this was
 *     added for. A reader deciding whether to walk the long way home is asking
 *     exactly this, and the sunset time alone makes them do the subtraction in
 *     their head against an hour that is in the far corner of the screen.
 *   • After dark: how long until tomorrow's, which is the one that has to cross
 *     midnight — the minutes left of tonight plus the minutes into tomorrow that
 *     the sun comes back.
 *
 * Tomorrow's own sunrise where the forecast reaches that far, which it does: lo
 * asks Open-Meteo for three days and hands over the two after this one. Today's
 * stands in where it somehow does not, and it is wrong by the minute or two the
 * sunrise moves in a day — worth saying, rather than saying nothing.
 *
 * Nothing at all inside the polar circles in their season, where Open-Meteo
 * answers with no sunrise and no sunset because there is none: a reading with
 * nothing behind it is a line this page leaves off.
 */
function lightReading(context: PageContext): string {
  const { weather, t } = context;
  const rise = minutesOfClock(localClockTime(weather?.today?.sunrise));
  const set = minutesOfClock(localClockTime(weather?.today?.sunset));
  if (rise == null || set == null) return "";

  const now = clockMinutes(context);
  if (now >= rise && now < set) return t("weather.daylight", { span: formatSpan(set - now, t) });

  const tomorrow = minutesOfClock(localClockTime(weather?.upcoming?.[0]?.sunrise)) ?? rise;
  const until = now < rise ? rise - now : DAY_MINUTES - now + tomorrow;
  return t("weather.sunrise", { span: formatSpan(until, t) });
}

/** The two weather lines: what it is out there now, and what the day is doing. */
function skyRows(context: PageContext): ReadingRow[] {
  const { weather, t } = context;
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

  // The day's own line, and the light left in it on the end of it. The sun
  // belongs here rather than beside the hour above: the clock line already
  // carries the date, the zone and both ends of the day, and what is left of the
  // light is a fact about *this day* — which is what this row is — rather than
  // about what time it is.
  const today = line(
    high != null && low != null ? `${low}-${high}°` : "",
    humidity != null ? `${humidity}%` : "",
    wind != null ? `${wind} ${weather?.units?.wind ?? "km/h"}` : "",
    lightReading(context),
  );
  if (today) rows.push({ label: t("weather.today"), value: today });
  return rows;
}

/** The short weekday a forecast day falls on, off a date that has no time in it. */
function dayName(date: string | undefined, locale: string): string {
  // Noon rather than midnight, which is lo's own way of naming these days: a
  // date read as midnight lands on the day before wherever the parse and the
  // formatter disagree by an hour, and nothing anywhere is twelve hours out.
  const noon = Date.parse(`${date}T12:00:00`);
  return Number.isNaN(noon) ? "" : new Intl.DateTimeFormat(locale, { weekday: "short" }).format(noon);
}

/**
 * The days after this one, in as many lines as the page has left over.
 *
 * lo's weather tile lists them under its readings and this page has never had
 * the room, because every other line here answers a question about the minute
 * the reader is standing in and the forecast does not. That is exactly why it is
 * the thing that gives way: it takes the lines nothing else wanted, so a
 * screen with a warning in force over it is a screen with no forecast on it and
 * still one screenful — where a row added unconditionally would have paginated
 * the opening page and put the count of everything else a flick away.
 *
 * A day with no range is not a line. The condition on its own is a word without
 * a figure, and this row exists to be read at a glance against the one above it.
 */
function aheadRows(context: PageContext, room: number): ReadingRow[] {
  const { weather, locale, t } = context;
  if (room <= 0) return [];

  const rows: ReadingRow[] = [];
  for (const day of weather?.upcoming ?? []) {
    if (rows.length >= room) break;
    const high = round(day.tempMax);
    const low = round(day.tempMin);
    if (high == null || low == null) continue;
    rows.push({
      // The nearest day is a word and the ones after it are weekdays: "Tomorrow"
      // is what the reader is already thinking, and by the day after that the
      // word for it is longer than any margin here.
      label: rows.length === 0 ? t("weather.tomorrow") : dayName(day.date, locale),
      value: line(
        `${low}-${high}°`,
        // Nothing for a day the forecast gave no code for, where the current
        // weather above says "Unknown": that line has a temperature to hang the
        // admission on and this one would be a whole reading of it.
        day.weatherCode != null ? t(weatherLabelKey(day.weatherCode)) : "",
      ),
    });
  }
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
 * The dot itself comes from the dictionary, and it is taste now where it started
 * as arithmetic. It was chosen when this line was cut by the cell and
 * `ニュース 3 · イベント 2 · トレンド 3` came out a cell too wide to survive that
 * cut, where `ニュース 3・イベント 2・トレンド 3` fitted. The body is cut to the
 * pixel now (see metrics.ts) and both of them fit with room over — but a tight
 * interpunct is what Japanese writes a list with anyway, so it stays. The clipper
 * is still the backstop, and `npm run glasses:preview -- ja` is still where to
 * look before any of these words is made longer.
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
    [t("posts.title"), posts.data?.length ?? null],
    [t("events.title"), components.includes("events") ? (events.data?.length ?? null) : null],
    [t("people.title"), people.data ? others.length : null],
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

  // The root of the app. Where you are standing is where lo opens and where a
  // double tap eventually returns everybody, and it is the one page with nothing
  // underneath it — five instruments and a count, none of which is a list of
  // anything (see chrome.ts).
  segment: "",

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

    // What is standing here now, in the order it is read: the day, the fix, the
    // sky, then whatever is in force overhead and the count of the two pages
    // after this one. Every one of them is about the minute the reader is in.
    const rows: ReadingRow[] = [whenRow(context)];
    const fix = fixRow(context);
    if (fix) rows.push(fix);
    rows.push(...skyRows(context));

    const warning = warningRow(context);
    const rest = warning ? [warning, ...tallyRows(context)] : tallyRows(context);

    // And then the forecast, in however many lines are left once everything that
    // is about now has been written down. It is dealt the leftovers rather than
    // given a line of its own for the reason the whole page is one screenful: a
    // seventh row is the count of what is on the other two pages, and a reader
    // who had to flick past tomorrow's weather to find out whether anything is
    // waiting for them would flick once and stop coming back. This is the same
    // arithmetic the two list pages do with their groups, done between subjects
    // rather than within one (see stack.ts).
    //
    // It is the last thing decided and lands in the middle of the page all the
    // same: tomorrow belongs under today, not under the tally of the newswire.
    rows.push(...aheadRows(context, BODY_LINES - rows.length - rest.length));
    rows.push(...rest);

    return { ...heading, block: { kind: "readings", rows } };
  },
};
