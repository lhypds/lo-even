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
// **The days ahead are a line, not a row apiece.** Everything else here answers
// a question about the minute the reader is standing in; lo's weather tile also
// lists the two days after this one, and a range is short enough — `Today
// 19-28°` is a word and six characters — that today, tomorrow and what tomorrow
// is doing fit on one line in every language. They were dealt the lines nothing
// else wanted while each of them was a row, and the arithmetic that did the
// dealing is gone with the rows: seven lines is one screenful, this page's most
// is seven, and a second screenful is the one thing it may not have — the count
// of everything else on the app is on the last line of this one, and a count a
// flick away is a count nobody reads.
//
// The third day lo sends is not drawn. The room it wanted went to tomorrow's
// condition instead, which is the reading a forecast is actually read for (see
// skyRows).
//
// Nothing here is asked of a server except the place, its weather and the
// warnings: the bearing and the speed are the handset's own instruments, the
// clock is the device's, and the light left in the day is the two ends of it
// subtracted from the hour. Every line is cut to its column by dropping whole
// readings off it rather than by cutting the last one in half (see fitted), and
// a row whose reading is not in yet is left off rather than left blank — a page
// with five lines on it is a page that knows five things, where a column of
// empty labels would be five promises it cannot keep.

import {
  formatAccuracy,
  formatAge,
  formatCoords,
  formatOffset,
  formatSpan,
  joined as line,
  localClockTime,
} from "../format";
import { textWidth } from "../metrics";
import { weatherLabelKey } from "../strings";
import { READING_VALUES } from "../theme";
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

  // The sun, in one event rather than two. This line used to carry `↑05:12
  // ↓18:20` — both ends of the day, whichever of them had already happened — and
  // it now carries the one that has not, with how long there is until it beside
  // it. The reading it makes room for is worth more than the time it drops: at
  // two in the afternoon the hour the sun came up is a fact about this morning,
  // where `↓18:20 · light 3h48m` is the answer to the question a reader looking
  // at this line is actually asking (see sunReading).
  const [sun, span] = sunReading(context);

  // And the clock time of that event is the first thing off the line when it will
  // not fit, rather than the span or the zone. Wherever the server named the zone
  // — which is nearly everywhere — all four readings fit in all three languages
  // with four to eighty-six pixels over. It is the offset standing in for a name
  // that fills the line: `9月30日周三 · UTC+09:00 · ↑05:13 · 日出 13小时20分钟` is
  // sixty-two pixels past the end of the column, and the same line without the
  // hour is nineteen inside it. What the span says is how long the reader has;
  // the hour it lands on is the same fact told a second way, and the second way
  // is the one that can go.
  const whole = line(date, named, sun, span);
  return {
    label: t("clock.title"),
    value: textWidth(whole) <= READING_VALUES.width ? whole : line(date, named, span),
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
 * The sun: the next thing it is going to do, and how long there is until it —
 * the one reading on this page that is neither the server's nor an instrument's,
 * but the two clocks either side of the reader subtracted from each other.
 *
 * Two strings rather than one because the line above may only have room for the
 * second of them, and the second is the one worth keeping (see whenRow). What
 * they say is decided by where the hour falls between the day's two ends:
 *
 *   • Before the sun is up: when it comes up, and how long until it does.
 *   • While it is up: when it goes down, and how long there is left of it —
 *     which is the figure this was added for. A reader deciding whether to walk
 *     the long way home is asking exactly this, and the sunset time alone makes
 *     them do the subtraction in their head against an hour that is in the far
 *     corner of the screen.
 *   • After dark: tomorrow's sunrise, and how long until it — the one that has
 *     to cross midnight, which is the minutes left of tonight plus the minutes
 *     into tomorrow that the sun comes back.
 *
 * The event named is always the one that has not happened yet, so the hour on
 * this line and the stretch beside it are the same moment written twice. Both
 * ends of the day used to be here and neither of them was: at two in the
 * afternoon `↑05:12` is a fact about a morning that is over.
 *
 * Tomorrow's own sunrise where the forecast reaches that far, which it does: lo
 * asks Open-Meteo for three days and hands over the two after this one. Today's
 * stands in where it somehow does not, and it is wrong by the minute or two the
 * sunrise moves in a day — worth saying, rather than saying nothing.
 *
 * Nothing at all inside the polar circles in their season, where Open-Meteo
 * answers with no sunrise and no sunset because there is none: a reading with
 * nothing behind it is a reading this page leaves off.
 */
function sunReading(context: PageContext): [at: string, span: string] {
  const { weather, t } = context;
  const rising = localClockTime(weather?.today?.sunrise);
  const setting = localClockTime(weather?.today?.sunset);
  const rise = minutesOfClock(rising);
  const set = minutesOfClock(setting);
  if (rise == null || set == null) return ["", ""];

  const now = clockMinutes(context);
  if (now >= rise && now < set) {
    return [`↓${setting}`, t("weather.daylight", { span: formatSpan(set - now, t) })];
  }

  const next = localClockTime(weather?.upcoming?.[0]?.sunrise);
  const tomorrow = minutesOfClock(next) ?? rise;
  const before = now < rise;
  return [
    `↑${before ? rising : next || rising}`,
    t("weather.sunrise", { span: formatSpan(before ? rise - now : DAY_MINUTES - now + tomorrow, t) }),
  ];
}

/**
 * A line of readings cut to its column by dropping whole readings off the end,
 * rather than by cutting the last of them in half.
 *
 * The body is clipped in pixels wherever it overruns (see layout.ts), and that
 * is the right answer for a sentence, a place name or a headline — the words are
 * one thing and half of it is still most of it. A row of readings is not one
 * thing. Clip that and the line ends in `61…`, which is a figure with its unit
 * taken off and no way to tell that from a figure; and what pushed it over is
 * always the *widest* reading on it, so the one that gets mangled is chosen by
 * the length of a translated word rather than by what it says.
 *
 * So the readings that may go are named as such and go whole, from the end. What
 * comes back always fits or is down to the ones that may not go, and those are
 * the paint's to clip in the ordinary way.
 */
function fitted(kept: string[], optional: string[]): string {
  for (let take = optional.length; take > 0; take--) {
    const text = line(...kept, ...optional.slice(0, take));
    if (textWidth(text) <= READING_VALUES.width) return text;
  }
  return line(...kept);
}

/**
 * The same cut, for a reading that has a shorter *form* to fall back to rather
 * than only its own absence. The forms are written longest first and the line
 * gets the first of them that fits; where none does, the reading goes the way
 * `fitted` would have taken it.
 *
 * The difference is what a full line costs. `fitted` gives up whole readings,
 * which is right where each of them is a separate fact — a wind speed dropped
 * off the weather row takes nothing else with it. It is the wrong trade where
 * one reading is a fact with a detail attached: the forecast's second day is a
 * range with a sky beside it, and giving up the whole thing to save the words
 * would lose tomorrow to save what tomorrow is doing.
 */
function fittedTo(kept: string[], forms: string[]): string {
  for (const form of forms) {
    if (!form) continue;
    const text = line(...kept, form);
    if (textWidth(text) <= READING_VALUES.width) return text;
  }
  return line(...kept);
}

/** The two weather lines: what it is out there now, and what the days ahead are doing. */
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
      // The humidity and the wind belong on *this* line and not the one under
      // it, because they are readings of the same minute the temperature is:
      // Open-Meteo sends all four in the `current` block, and a forecast day
      // carries a range, a code and the two ends of the light and no aggregate
      // of either of these (see LoWeatherDay). A 61% under a label that says
      // "Today" is a claim about the whole day that nothing measured.
      //
      // They are also the two that give way when the line is full, and in that
      // order. Three readings and a condition fitted the column in every
      // language with room over; five of them do not, and it is the longest
      // conditions that put it past the end — `Severe thunderstorm with hail`
      // spends the whole line on its own. What is out there is worth more than
      // how much water is in it, and both are worth more than a mangled word, so
      // the wind goes first, the humidity after it, and the temperature and the
      // sky stay whatever the weather is called (see fitted).
      value: fitted(
        [
          temperature != null ? `${temperature}${unit}` : NONE,
          // The lowercase short form, because this is the second thing on a line
          // rather than the label of a row of its own.
          apparent != null ? `${t("weather.feels")} ${apparent}°` : "",
          t(weatherLabelKey(current.weatherCode)),
        ],
        [
          humidity != null ? `${humidity}%` : "",
          wind != null ? `${wind} ${weather?.units?.wind ?? "km/h"}` : "",
        ],
      ),
    },
  ];

  // And under it the forecast: today and tomorrow on one line, a name and a range
  // apiece, and what the sky is doing written after tomorrow's.
  //
  // One row rather than the two or three this used to be dealt, and that is what
  // a range costs to write down: `Today 19-28°` is a word and six characters, so
  // both days and a word fit the column in every language. Rows of the same
  // figures would have been half the screen for a table with one column in it —
  // and the arithmetic that dealt them the lines nothing else wanted is gone with
  // them, because a page whose forecast is a single line has a line for
  // everything else whatever the weather is doing.
  //
  // **Two days, and the word on the second of them is what the third one paid
  // for.** A range says how warm tomorrow is and not whether to carry an
  // umbrella, which is the question a forecast is read for; `Light rain` is as
  // wide as a whole extra day, and the day it was competing with was the one
  // furthest from the reader. So the day after tomorrow is not on this row at
  // all — not dropped when the line fills, gone — because a row that had a third
  // day on short words and lost it on long ones would change shape with the
  // weather, and a reader would have to work out which day the last range belongs
  // to before they could read it.
  //
  // Today's own sky is not written either, and that is the line above's to say:
  // it carries the condition *now*, measured this minute, where today's daily
  // code is a whole day averaged into one word. Two conditions a line apart, one
  // of them true of the minute and the other of the day, is a row a reader has to
  // be told the shape of — and it was the pair of them that put this line past
  // the end of the column in English.
  const tomorrow = weather?.upcoming?.[0];
  const top = round(tomorrow?.tempMax);
  const bottom = round(tomorrow?.tempMin);
  // A day with no range is not a reading, and it is not a gap either: a missing
  // tomorrow leaves the row reading `Today 19-28°` rather than putting a name and
  // an empty range where a day should be.
  const ahead = top != null && bottom != null ? `${t("weather.tomorrow")} ${bottom}-${top}°` : "";
  const said = tomorrow?.weatherCode != null ? t(weatherLabelKey(tomorrow.weatherCode)) : "";

  // Today is the one that may not go — a forecast whose first day is tomorrow is
  // a forecast with a hole where the reader is standing. What gives way as the
  // column runs out is tomorrow's word first and tomorrow itself only after it
  // (see fittedTo), because a reader who loses the word still has the day, where
  // a reader who loses the day has nothing.
  //
  // It is the word that goes in practice and the day never. Two ranges and a
  // condition fit this column in Japanese and Chinese whatever the sky is doing,
  // and in English for all but the seven longest of them — `Severe thunderstorm
  // with hail`, `Light snow showers` and the like, which are the conditions worth
  // spending a whole line on and the ones that have no line to spend.
  const forecast = fittedTo([high != null && low != null ? `${t("weather.today")} ${low}-${high}°` : ""], [
    said && ahead ? `${ahead} ${said}` : "",
    ahead,
  ]);
  if (forecast) rows.push({ label: t("weather.forecast"), value: forecast });
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

    // What is standing here, in the order it is read: the day, the fix, the sky
    // and the days after it, then whatever is in force overhead and the count of
    // the two pages after this one.
    //
    // Seven of them at the very most — the day, the fix, two of weather, a
    // warning and two of tally — which is the whole of the arithmetic now that
    // the forecast is a line rather than a row a day. There used to be a sum
    // here, dealing whatever lines were left over to the days ahead so that a
    // screen under a warning could not paginate; a page that cannot overrun in
    // the first place does not need one.
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
