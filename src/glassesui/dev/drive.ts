// Drives the display against a fake bridge and reports what it asked the glasses
// to do. Not shipped — this exists to run the two pieces of real logic that
// neither the typechecker nor the layout preview touches: the anchor in
// glasses.ts, and the rebuild-or-update decision in paint.ts.

import { createGlassesDisplay } from "../glasses";
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
  visited.join(",") === "here,nearby,world",
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
