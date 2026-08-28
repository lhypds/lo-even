// Drives the display against a fake bridge and reports what it asked the glasses
// to do. Not shipped — this exists to run the two pieces of real logic that
// neither the typechecker nor the layout preview touches: the anchor in
// glasses.ts, and the rebuild-or-update decision in paint.ts.

import { createGlassesDisplay } from "../glasses";
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
// A minute turning over is the same page with one different line in it — the
// clock in the corner of the heading, and nothing else on the standing page.
display.render(context({ now: new Date("2026-08-28T14:33:00+09:00") }));
await settle();
check(
  "a minute tick is one update, not a rebuild",
  calls.length === 1 && calls[0].startsWith("upgrade"),
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
check("and the second of them is where the list is", display.path() === "lo/nearby", display.path());
display.enter();
await settle();
check("which a tap steps into, at the first group", display.path() === "lo/nearby/msg", display.path());

// One entry per exchange, per post, per listing and per person — and a group
// with nothing in it still keeps one, so the wheel can always walk to it. Asked
// of the page rather than written down here: the point of the check is that a
// lap of the list is a lap of the list, whatever is on the street today.
const nearbyPage = PAGES.find((page) => page.id === "nearby");
const ENTRIES = nearbyPage?.items?.(busy()).length ?? 0;
const walked: string[] = [];
for (let step = 0; step < ENTRIES; step += 1) {
  if (walked[walked.length - 1] !== display.path()) walked.push(display.path());
  await roll(1);
}
check(
  "the wheel walks the groups in the page's own order",
  ENTRIES === 2 + 16 + 2 + 2 &&
    walked.join(" ") === "lo/nearby/msg lo/nearby/posts lo/nearby/events lo/nearby/people",
  `${ENTRIES} entries: ${walked.join(" ")}`,
);

// A lap has brought the reader back to the first letter. Two more steps is the
// first of the posts, and a tap opens it.
await roll(2);
display.enter();
await settle();
check("a tap on an entry reads it", display.path() === "lo/nearby/posts", display.path());

// Which is a screen the wheel does not leave: it pages what is being read, where
// one more flick at the depth above would have carried the reader off the end of
// the posts and into the listings.
await roll(16);
check("and the wheel inside it stays inside it", display.path() === "lo/nearby/posts", display.path());

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

// Two levels down, so two double taps out — the first back to the list it was
// read from, still standing in the posts, and the second to the page itself.
check("a double tap comes back to the list", display.back() && display.path() === "lo/nearby/posts", display.path());
await settle();
check("and the next one to the page", display.back() && display.path() === "lo/nearby", display.path());
await settle();
check("where it is the way out of the app instead", display.back() === false, display.path());
check("and the reader is on the page they stepped in from", display.current() === "nearby", String(display.current()));

// A group with nothing in it is one entry saying which kind of nothing, so the
// list is still four entries long and the wheel still walks the same route —
// and stepping back in lands on the group the reader was last in rather than at
// the top, which is the same anchor holding across a page they left and a page
// that emptied while they were away.
display.render(context({ posts: { status: "ready", data: [] } }));
await settle();
display.enter();
await settle();
check(
  "an empty page opens at the group you were last in",
  display.path() === "lo/nearby/posts",
  display.path(),
);
// And there is nothing behind that sentence to open.
display.enter();
await settle();
check("but a group with nothing in it cannot be opened", display.path() === "lo/nearby/posts", display.path());
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
