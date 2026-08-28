// Drives the display against a fake bridge and reports what it asked the glasses
// to do. Not shipped — this exists to run the two pieces of real logic that
// neither the typechecker nor the layout preview touches: the anchor in
// glasses.ts, and the rebuild-or-update decision in paint.ts.

import { createGlassesDisplay } from "../glasses";
import { PageRefused } from "../paint";
import { PAGES } from "../pages/index";
import { composeView } from "../pages/compose";
import type { PageContext } from "../pages/types";
import { translator } from "../strings";
import { localeFor } from "../format";
import { fail } from "./host";

const calls: string[] = [];

// What the firmware will take in one page: `textObject` is capped at eight items
// (see the SDK's RebuildPageContainer). Every page here now spends all eight, so
// the ninth container nobody meant to add is a real possibility and would be
// dropped by the protocol rather than refused by anything in this repo — which is
// to say it would go missing on glass and nowhere else.
const CONTAINER_LIMIT = 8;
let widest = 0;

const bridge = {
  createStartUpPageContainer: async (c: { containerTotalNum?: number }) => {
    widest = Math.max(widest, c.containerTotalNum ?? 0);
    calls.push(`create(${c.containerTotalNum})`);
    return 0;
  },
  rebuildPageContainer: async (c: { containerTotalNum?: number }) => {
    widest = Math.max(widest, c.containerTotalNum ?? 0);
    calls.push(`rebuild(${c.containerTotalNum})`);
    return true;
  },
  textContainerUpgrade: async (c: { containerID?: number }) => {
    calls.push(`upgrade(${c.containerID})`);
    return true;
  },
  shutDownPageContainer: async () => true,
} as never;

const t = translator("en");

function context(over: Partial<PageContext> = {}): PageContext {
  return {
    now: new Date("2026-08-28T14:32:00+09:00"),
    language: "en",
    locale: localeFor("en"),
    t,
    coords: { latitude: 35.658, longitude: 139.7016, accuracy: 12 },
    fixAt: Date.now(),
    place: { name: "Shibuya", locality: "Shibuya City", region: "Tokyo", countryCode: "JP" },
    weather: {
      timezone: { id: "Asia/Tokyo", abbreviation: "JST", offsetSeconds: 32400 },
      current: { temperature: 23, apparent: 24, humidity: 61, weatherCode: 2, windSpeed: 12 },
      today: { tempMax: 27, tempMin: 19, sunrise: "2026-08-28T05:12", sunset: "2026-08-28T18:20" },
      units: { temperature: "°C", wind: "km/h" },
    },
    components: ["nearby", "events", "trends", "warnings"],
    posts: {
      status: "ready",
      data: Array.from({ length: 16 }, (_, i) => ({
        id: i,
        time: new Date(Date.now() - i * 60_000).toISOString(),
        latitude: 35.658,
        longitude: 139.7,
        body: `post number ${i}`,
        username: `user${i % 3}`,
        comments: 0,
      })),
    },
    people: { status: "ready", data: [] },
    // Nothing is ever opened in here, so no story is ever asked for — and no
    // exchange either, which is the state a letter's screen is met in for the
    // three seconds before the request that fetches it has been made, nor any
    // profile, which is the state a person's screen is met in for the moment
    // before the same paint's request comes back.
    article: () => ({ status: "idle", data: null }),
    thread: () => ({ status: "idle", data: null }),
    profile: () => ({ status: "idle", data: null }),
    news: { status: "idle", data: null },
    events: { status: "idle", data: null },
    trends: { status: "idle", data: null },
    warnings: { status: "idle", data: null },
    messages: { status: "idle", data: null },
    unread: 0,
    heading: { status: "on", heading: 127, headingAccuracy: 8, turnRate: 14 },
    username: "heyang",
    ...over,
  };
}

// The painter writes on a queue, so let it drain between steps.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function check(name: string, pass: boolean, detail = ""): void {
  console.log(`${pass ? "  ok  " : "FAIL  "}${name}${detail ? `  — ${detail}` : ""}`);
  if (!pass) fail();
}

const display = await createGlassesDisplay(bridge, "Connecting");
await settle();
check("start-up page created once", calls.filter((c) => c.startsWith("create")).length === 1, calls[0]);

// --- the sequence -----------------------------------------------------------
display.render(context());
await settle();
check("opens on the standing page", display.current() === "here", String(display.current()));

// Exactly one lap. Every page is built to come in under the lines there are, so
// a lap is three steps and a step is always a whole page.
const visited: string[] = [];
for (let step = 0; step < 3; step += 1) {
  visited.push(`${display.current()}`);
  display.scroll(1);
  await settle();
}
check(
  "scrolling walks every page in lo's order",
  visited.join(",") === "here,nearby,info",
  visited.join(","),
);
check("a lap comes back to where it started", display.current() === "here", String(display.current()));
check(
  "sixteen posts are still one screenful",
  visited.filter((id) => id === "nearby").length === 1,
  `${visited.filter((id) => id === "nearby").length} nearby screens`,
);

// --- wrapping ---------------------------------------------------------------
display.scroll(-1);
await settle();
const beforeWrap = display.current();
for (let step = 0; step < 20; step += 1) {
  display.scroll(1);
  await settle();
}
check("the sequence rounds rather than stopping", display.current() != null, `${beforeWrap} → ${display.current()}`);

// --- rebuild vs update ------------------------------------------------------
while (display.current() !== "here") {
  display.scroll(1);
  await settle();
}
calls.length = 0;
// A minute turning over is the same page with two different lines in it: the
// clock in the corner of the heading, and the column of readings underneath it,
// because the light left in the day is counted to the minute and rides on the
// standing page's first line (see sunReading in here.ts).
//
// Two writes rather than one, and that is the whole of what this checks — the
// signature of the page has not changed, so what goes out is the two columns
// that did rather than the eight containers that did not. It said one write
// until the daylight countdown was added and has meant "not a rebuild" all
// along: the day this becomes `rebuild(8)` is the day a tick costs a whole page.
display.render(context({ now: new Date("2026-08-28T14:33:00+09:00") }));
await settle();
check(
  "a minute tick is two updates, not a rebuild",
  calls.length === 2 && calls.every((call) => call.startsWith("upgrade")),
  calls.join(" ") || "(nothing written)",
);

calls.length = 0;
display.render(context({ now: new Date("2026-08-28T14:33:00+09:00") }));
await settle();
check("an unchanged repaint writes nothing", calls.length === 0, calls.join(" "));

// Every page is the same shape now — a heading, two columns and a footer — so
// the signature does not change from one to the next and there is nothing to
// build. What does change is most of the text in it: the meta, the pager and both
// columns, which is four writes where one rebuild carries the lot. That is the
// three-way rule in paint.ts doing its job rather than failing it.
calls.length = 0;
display.scroll(1);
await settle();
check(
  "a whole page of new text is one rebuild, not four writes",
  display.current() === "nearby" && calls.length === 1 && calls[0].startsWith("rebuild"),
  `${display.current()}: ${calls.join(" ")}`,
);

// --- what the ground changing does to the reader ----------------------------
// Leaving Japan takes the newswire, the trends, the listings and the warnings
// with it. All three pages stay in the sequence — that is the point of there
// being three — so the reader is left looking at exactly what they were.
const wasOn = display.current();
display.render(context({ components: [] }));
await settle();
check(
  "a country with nothing to feed leaves you where you were",
  display.current() === wasOn,
  `${wasOn} → ${display.current()}`,
);

// And the same when the list under the reader empties: the page is still there,
// with a sentence where its rows were.
display.render(context({ components: [], posts: { status: "ready", data: [] } }));
await settle();
check(
  "a list emptying under you keeps you on that page",
  display.current() === wasOn,
  String(display.current()),
);

// --- stepping in and out ----------------------------------------------------
// The dashboard is a summary, and under two of its three pages is the list it is
// a summary of. A tap goes in, the wheel walks the entries, another tap opens
// one, and a double tap comes back out of each of them in turn.
//
// Every group needs something in it for any of that to be worth checking, so
// this half of the run is driven with a street that has people on it and letters
// waiting rather than with the sparse one above.
function busy(over: Partial<PageContext> = {}): PageContext {
  return context({
    people: {
      status: "ready",
      data: Array.from({ length: 2 }, (_, i) => ({
        username: `near${i}`,
        latitude: 35.658 + i / 1000,
        longitude: 139.7,
        time: new Date(Date.now() - i * 60_000).toISOString(),
      })),
    },
    events: {
      status: "ready",
      data: Array.from({ length: 2 }, (_, i) => ({
        kind: "event",
        title: `something on ${i}`,
        url: `e${i}`,
        source: "Peatix",
        time: new Date(Date.now() + (i + 1) * 86_400_000).toISOString(),
      })),
    },
    messages: {
      status: "ready",
      data: Array.from({ length: 2 }, (_, i) => ({
        username: `wrote${i}`,
        body: `the last thing said ${i}`,
        time: new Date(Date.now() - i * 3_600_000).toISOString(),
        mine: false,
        unread: i,
      })),
    },
    // One exchange fetched and one not, which is the pair of states the screen
    // behind a letter is met in — the whole correspondence once the three seconds
    // have marked it read, and the inbox's own last line standing in until they
    // have. The long one is what makes that screen more than one screenful, so the
    // wheel walking it below has something to walk.
    thread: (username: string) =>
      username === "wrote0"
        ? {
            status: "ready" as const,
            data: Array.from({ length: 12 }, (_, i) => ({
              id: i,
              body: `line ${i} of the exchange, long enough to want a row of its own`,
              time: new Date(Date.now() - (12 - i) * 60_000).toISOString(),
              mine: i % 2 === 1,
              read: true,
            })),
          }
        : { status: "idle" as const, data: null },
    // And one profile fetched and one not, which is the same pair of states for
    // the other group down here that is about a person. The filled one is what
    // makes that screen more than one screenful, and it answers with eight posts
    // where the screen carries five — the trim is the page's, so it has to be
    // given something to trim.
    profile: (username: string) =>
      username === "near0"
        ? {
            status: "ready" as const,
            data: {
              user: {
                username: "near0",
                bio: "walks a lot, reads on trains, mostly on the west side of the city",
                email: "near0@example.com",
                website: "https://example.com/near0",
                links: [{ kind: "github", value: "near0" }],
              },
              follows: { followers: 12, following: 30, isFollowing: false },
              posts: Array.from({ length: 8 }, (_, i) => ({
                id: 100 + i,
                time: new Date(Date.now() - i * 3_600_000).toISOString(),
                latitude: 35.658,
                longitude: 139.7,
                body: `something left on the ground ${i}`,
                username: "near0",
                comments: 0,
              })),
            },
          }
        : { status: "idle" as const, data: null },
    ...over,
  });
}

display.render(busy());
while (display.current() !== "here") {
  display.scroll(1);
  await settle();
}
display.enter();
await settle();
check(
  "the standing page has nothing under it",
  display.path() === "lo/" && display.back() === false,
  display.path(),
);

/** The wheel, that many times. */
async function roll(times: number): Promise<void> {
  for (let step = 0; step < times; step += 1) {
    display.scroll(1);
    await settle();
  }
}

// Every page says its own name, so a lap of the dashboard is a lap of the paths.
const ring: string[] = [];
for (let step = 0; step < 3; step += 1) {
  ring.push(display.path());
  await roll(1);
}
check(
  "each page carries its own name in the corner",
  ring.join(" ") === "lo/ lo/nearby lo/info",
  ring.join(" "),
);

await roll(1);
check("and the second of them is where the groups are", display.path() === "lo/nearby", display.path());

// A tap picks a group out on the page itself rather than leaving it: the reader
// is choosing where to go, and the path says they have not gone yet. What
// changes on the screen is a box, which is the one thing this check cannot see —
// what it can see is that the wheel has stopped walking pages.
display.enter();
await settle();
check("a tap picks out a group without leaving the page", display.path() === "lo/nearby", display.path());

// Four groups on this page, walked in the page's own order. Which one is boxed is
// read off the path it opens onto rather than off the box.
async function opens(): Promise<string> {
  display.enter();
  await settle();
  const path = display.path();
  display.back();
  await settle();
  return path;
}

const groups: string[] = [];
for (let step = 0; step < 4; step += 1) {
  groups.push(await opens());
  await roll(1);
}
check(
  "the wheel walks the groups in the page's own order",
  groups.join(" ") === "lo/nearby/msg lo/nearby/posts lo/nearby/events lo/nearby/people",
  groups.join(" "),
);

// A lap has brought the reader back to the letters. One step on is the posts, and
// a tap opens the list of them.
await roll(1);
display.enter();
await settle();
check("a second tap opens that group's own list", display.path() === "lo/nearby/posts", display.path());

// Sixteen posts and nothing else: the wheel stays inside the group the reader
// chose, where before it would have carried them on into the listings.
const nearbyPage = PAGES.find((page) => page.id === "nearby");
const POSTS = nearbyPage?.items?.(busy()).filter((item) => item.group === "posts").length ?? 0;
await roll(POSTS + 3);
check(
  "and the wheel stays inside it",
  POSTS === 16 && display.path() === "lo/nearby/posts",
  `${POSTS} posts, ${display.path()}`,
);

display.enter();
await settle();
check("a third tap reads one of them", display.path() === "lo/nearby/posts", display.path());

// The list is rebuilt on every paint, and the reader is held to the entry rather
// than to its position: four posts deleted from under them is the same group,
// four rows higher up.
display.render(busy({ posts: { status: "ready", data: (context().posts.data ?? []).slice(4) } }));
await settle();
check(
  "a list shrinking under you keeps you on what you were reading",
  display.path() === "lo/nearby/posts",
  display.path(),
);

// Three levels down, so three double taps out — back to the list it was read
// from, back to the page with the group still boxed, and back to the dashboard.
check("a double tap comes back to the list", display.back() && display.path() === "lo/nearby/posts", display.path());
await settle();
check("and the next to the page", display.back() && display.path() === "lo/nearby", display.path());
await settle();
check("and the next out of the choosing", display.back() && display.path() === "lo/nearby", display.path());
await settle();
check("where it is the way out of the app instead", display.back() === false, display.path());
check("and the reader is on the page they stepped in from", display.current() === "nearby", String(display.current()));

// A group with nothing in it still keeps its place among the four, so the wheel
// walks the same route — and stepping back in picks out the group the reader was
// last in rather than the first, which is the same anchor holding across a page
// they left and a page that emptied while they were away.
display.render(context({ posts: { status: "ready", data: [] } }));
await settle();
display.enter();
await settle();
display.enter();
await settle();
check(
  "an empty page opens at the group you were last in",
  display.path() === "lo/nearby/posts",
  display.path(),
);
// And there is nothing behind the sentence that group is showing.
display.enter();
await settle();
check("but a group with nothing in it cannot be read", display.path() === "lo/nearby/posts", display.path());
display.back();
await settle();
display.back();
await settle();

// --- the screen that is not a page ------------------------------------------
// The composer interrupts the dashboard to ask a dictation what it is, and the
// whole of what it owes the reader is to put them back afterwards: the anchor is
// never touched, so a sentence said and thrown away costs nobody their place.
display.render(context());
while (display.current() !== "nearby") {
  display.scroll(1);
  await settle();
}

const draft = { text: "the corner with the good coffee", coords: { latitude: 35.658, longitude: 139.7 }, kind: "mark" } as const;
display.takeover({ id: "compose", view: composeView(draft, t) });
await settle();
check("a takeover is what the reader is looking at", display.current() === "compose", String(display.current()));

// The wheel belongs to whatever has the screen. A scroll arriving while the
// composer is up must not walk the sequence underneath it — main.ts sends the
// wheel to the answers instead, and this is the second lock on the same door.
calls.length = 0;
display.scroll(1);
await settle();
check("the wheel does not move the pages underneath it", calls.length === 0, calls.join(" ") || "(nothing written)");

check("a takeover has no path, being nowhere in the app", display.path() === "", `"${display.path()}"`);

display.takeover(null);
await settle();
check("putting it away puts the reader back", display.current() === "nearby", String(display.current()));

// --- what a story costs -----------------------------------------------------
// A newswire row keeps its words somewhere else, and `reading` is the whole of
// how the app knows to go and get them (see main.ts). The point of it is where
// it stays quiet: a reader looking at a page, or at a list of twenty headlines,
// has chosen none of them, and lo reads nothing until one is opened.
const wire: PageContext = busy({
  news: {
    status: "ready",
    data: [
      { kind: "news", title: "A headline", url: "https://news.google.com/rss/articles/AAA", source: "BBC" },
      { kind: "news", title: "Another headline", url: "https://news.google.com/rss/articles/BBB", source: "NHK" },
    ],
  },
});

display.takeover(null);
display.render(wire);
await settle();
// Round to the page the newswire is on, then in as far as the entry itself.
while (display.current() !== "info") {
  display.scroll(1);
  await settle();
}
check("nothing is asked for from a page", display.reading() === null, String(display.reading()));

display.enter();
await settle();
while (display.path() !== "lo/info") {
  display.scroll(1);
  await settle();
}
check("nor while a group is only picked out", display.reading() === null, String(display.reading()));

display.enter();
await settle();
check("nor from the list of them", display.reading() === null, `${display.path()} → ${display.reading()}`);

display.enter();
await settle();
check(
  "the story is asked for only once the entry is open",
  display.reading()?.link === "https://news.google.com/rss/articles/AAA",
  `${display.path()} → ${display.reading()?.link ?? "null"}`,
);

// The wheel means the next screenful down here, not the next story — so a long
// read walks through itself without asking lo for anything more.
display.scroll(1);
await settle();
check(
  "the wheel walks the story rather than leaving it",
  display.reading()?.link === "https://news.google.com/rss/articles/AAA",
  String(display.reading()?.link ?? "null"),
);

display.back();
await settle();
check("stepping back out stops asking", display.reading() === null, `${display.path()} → ${display.reading()}`);

// Changing story is done from the list, which is where the wheel walks entries.
display.scroll(1);
await settle();
display.enter();
await settle();
check(
  "and the next story is asked for when that one is opened",
  display.reading()?.link === "https://news.google.com/rss/articles/BBB",
  String(display.reading()?.link ?? "null"),
);

// --- the letter in front of the reader --------------------------------------
// Two errands now hang off knowing which letter is open: the three seconds that
// mark it read, and the hold that answers it (see main.ts). Both ask the display
// the same question, and the whole of what makes either safe is where it answers
// with nothing — a wheel walking a list of correspondents must not be marking
// each of them read on its way past, and a hold on that list must not be a reply
// addressed to whoever it had rolled onto.
while (display.back()) await settle();
display.render(busy());
await settle();
while (display.current() !== "nearby") {
  display.scroll(1);
  await settle();
}
check("no letter is open from the page", display.opened() === null, String(display.opened()));

display.enter();
await settle();
while ((await opens()) !== "lo/nearby/msg") await roll(1);
check("nor while the group is only picked out", display.opened() === null, String(display.opened()));

display.enter();
await settle();
check("nor from the list of them", display.opened() === null, `${display.path()} → ${display.opened()}`);

display.enter();
await settle();
check(
  "the letter is named once it is open",
  display.opened()?.group === "messages" && display.opened()?.key === "wrote0",
  `${display.path()} → ${display.opened()?.key ?? "null"}`,
);

// The wheel down here walks the screenfuls of one exchange rather than the
// letters, so reading a long correspondence to its end is not a dozen letters
// being marked read on the way past.
await roll(4);
check("the wheel inside a letter stays on it", display.opened()?.key === "wrote0", String(display.opened()?.key));

// A composer standing in front of the screen answers nothing, which is what stops
// a reader dictating a reply from also being timed as reading the letter behind
// the question they are looking at.
const answer = { kind: "reply", text: "on my way", to: "wrote0" } as const;
display.takeover({ id: "compose", view: composeView(answer, t) });
await settle();
check("a composer in front of it hides the letter", display.opened() === null, String(display.opened()));

display.takeover(null);
await settle();
check("and putting it away brings the letter back", display.opened()?.key === "wrote0", String(display.opened()?.key));

display.back();
await settle();
check("stepping back out leaves no letter open", display.opened() === null, `${display.path()} → ${display.opened()}`);

// And the next one along is a different letter, which is what stops one clock and
// starts another rather than letting the first one mark the second read.
display.scroll(1);
await settle();
display.enter();
await settle();
check(
  "the next letter is named when that one is opened",
  display.opened()?.key === "wrote1",
  String(display.opened()?.key),
);
while (display.back()) await settle();

// --- and the person in front of the reader ----------------------------------
// The same question again, for the other group down here whose entries are
// addressed to somebody rather than to a place. Two errands hang off knowing
// which name is open: the read that says who they are, and the hold that sends
// them a message — and both are safe in the same place the letters are, which is
// where this answers with nothing. A wheel walking a list of names must not be
// asking lo who each of them is on the way past.
while (display.back()) await settle();
display.render(busy());
await settle();
while (display.current() !== "nearby") {
  display.scroll(1);
  await settle();
}
display.enter();
await settle();
while ((await opens()) !== "lo/nearby/people") await roll(1);
check("no name is open while the group is only picked out", display.opened() === null, String(display.opened()));

display.enter();
await settle();
check("nor from the list of names", display.opened() === null, `${display.path()} → ${display.opened()}`);

display.enter();
await settle();
check(
  "the person is named once their page is open",
  display.opened()?.group === "people" && display.opened()?.key === "near0",
  `${display.path()} → ${display.opened()?.key ?? "null"}`,
);

// A profile runs to more than one screenful on an account with anything filled
// in, and the wheel down here walks those rather than the street: a reader
// reading to the end of one person is not four other people asked about.
await roll(3);
check("the wheel inside a profile stays on it", display.opened()?.key === "near0", String(display.opened()?.key));
while (display.back()) await settle();

// Five of somebody's posts and no more, whatever lo answers with. A profile on
// the phone is scrolled and draws twenty; this one is walked a screenful at a
// time, and the other fifteen would be four flicks of somebody else's afternoon
// between the reader and the end of the screen.
const nearest = nearbyPage?.items?.(busy()).find((item) => item.group === "people" && item.key === "near0");
const drawn = (nearest?.body.match(/something left on the ground/g) ?? []).length;
check("a profile carries five of their posts at most", drawn === 5, `${drawn} of 8 drawn`);

// And the one check in this file about what must *not* be on a screen. A
// person's fix to four decimal places is eleven metres of where somebody
// actually is, and it stood on both of these screens until it was taken off:
// what is left says there is somebody here without saying which window they are
// behind (see pages/person.ts).
const COORDS = /\d+\.\d+°[NSEW]/;
const names = nearbyPage?.items?.(busy()).filter((item) => item.group === "people") ?? [];
check(
  "nobody's own position is written out on any of their screens",
  names.length > 0 &&
    names.every((item) => !COORDS.test(`${item.head} ${item.line} ${item.body.split("\n")[0]}`)),
  names.map((item) => item.line).join(" | ") || "(nobody about)",
);

// --- a screen that never came up --------------------------------------------
// The start-up page *is* the display, and a host that answers and refuses to make
// one leaves a package that looks well from the inside: the session comes back,
// the feeds arrive, the touchpad reports every scroll and tap and hold, and none
// of it lands on any glass. That used to be a line in the console. The first the
// reader heard of it was a hold failing to open the microphone — which is this
// page's absence reported as something else entirely.
//
// So it is an error now, and a named one, because main.ts has to tell it from the
// other thing that ends at the same fallback: an ordinary browser, where there is
// no native handler and the call rejects before the glasses are asked anything.
// A separate bridge, so the calls above are not disturbed.
const refusing = {
  // Oversize, and it says so every time — which is what makes this the failure
  // that survives all four tries rather than a cold start still coming up.
  createStartUpPageContainer: async () => 2,
  rebuildPageContainer: async () => true,
  textContainerUpgrade: async () => true,
  shutDownPageContainer: async () => true,
} as never;
let refused: unknown = null;
try {
  await createGlassesDisplay(refusing, "Connecting");
} catch (error) {
  refused = error;
}
check(
  "a refused start-up page is an error, not a blind display",
  refused instanceof PageRefused && refused.code === 2,
  refused instanceof Error ? refused.message : String(refused),
);

// --- what the protocol will carry -------------------------------------------
// Every page above has been through the painter by now, the fullest of them being
// the standing page with its compass in the heading. None of them may have asked
// for a ninth container.
check(
  "no screen asks for more containers than the firmware takes",
  widest > 0 && widest <= CONTAINER_LIMIT,
  `${widest} of ${CONTAINER_LIMIT}`,
);

console.log("\ndone");
