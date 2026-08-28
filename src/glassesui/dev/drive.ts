// Drives the display against a fake bridge and reports what it asked the glasses
// to do. Not shipped — this exists to run the two pieces of real logic that
// neither the typechecker nor the layout preview touches: the anchor in
// glasses.ts, and the rebuild-or-update decision in paint.ts.

import { createGlassesDisplay } from "../glasses";
import type { CardContext } from "../cards/types";
import { translator } from "../strings";
import { localeFor } from "../format";
import { fail } from "./host";

const calls: string[] = [];

const bridge = {
  createStartUpPageContainer: async (c: { containerTotalNum?: number }) => {
    calls.push(`create(${c.containerTotalNum})`);
    return 0;
  },
  rebuildPageContainer: async (c: { containerTotalNum?: number }) => {
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

function context(over: Partial<CardContext> = {}): CardContext {
  return {
    now: new Date("2026-08-28T14:32:00+09:00"),
    language: "en",
    locale: localeFor("en"),
    t,
    coords: { latitude: 35.658, longitude: 139.7016, accuracy: 12 },
    fixAt: Date.now(),
    place: { name: "Shibuya", locality: "Shibuya City", region: "Tokyo", countryCode: "JP" },
    weather: {
      timezone: { id: "Asia/Tokyo", offsetSeconds: 32400 },
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
    nearby: { status: "idle", data: null },
    events: { status: "idle", data: null },
    trends: { status: "idle", data: null },
    warnings: { status: "idle", data: null },
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
check("opens on the clock", display.current() === "clock", String(display.current()));

const visited: string[] = [];
for (let step = 0; step < 12; step += 1) {
  visited.push(`${display.current()}`);
  display.scroll(1);
  await settle();
}
const unique = [...new Set(visited)];
check(
  "scrolling walks every card in lo's order",
  unique.join(",") === "clock,weather,here,people,warnings,posts,nearby,events,trends,direction",
  unique.join(","),
);
check(
  "a 16-row list is walked as three screenfuls",
  visited.filter((id) => id === "posts").length === 3,
  `${visited.filter((id) => id === "posts").length} posts screens`,
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
while (display.current() !== "clock") {
  display.scroll(1);
  await settle();
}
calls.length = 0;
// A minute turning over is the same page with one different line in it.
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

// clock → weather: two cards that happen to share a shape, so the signature is
// unchanged and every line of it is different. One rebuild, not seven writes.
calls.length = 0;
display.scroll(1);
await settle();
check(
  "stepping to a same-shaped card rebuilds rather than writing every line",
  display.current() === "weather" && calls.length === 1 && calls[0].startsWith("rebuild"),
  `${display.current()}: ${calls.join(" ")}`,
);

// Turning between pages of one list should stay updates: the columns are measured
// across the whole list, so every page of it has the same geometry, and only the
// three body columns change.
while (display.current() !== "posts") {
  display.scroll(1);
  await settle();
}
calls.length = 0;
display.scroll(1);
await settle();
check(
  "turning a page inside one list only updates",
  display.current() === "posts" && calls.length > 0 && calls.every((c) => c.startsWith("upgrade")),
  calls.join(" "),
);

// --- the anchor survives the sequence changing ------------------------------
// Leaving Japan takes the warnings card — which is in front of this one in the
// sequence — out from under the reader.
const wasOn = display.current();
display.render(context({ components: [] }));
await settle();
check(
  "a card ahead of you vanishing leaves you where you were",
  display.current() === wasOn,
  `${wasOn} → ${display.current()}`,
);

// The reader is on page 2 of 3 of the posts; emptying the list leaves that card
// with one page and no rows. They should still be looking at the posts card.
check("still on the posts", display.current() === "posts", String(display.current()));
display.render(context({ components: [], posts: { status: "ready", data: [] } }));
await settle();
check(
  "a list emptying under you keeps you on that card",
  display.current() === "posts",
  String(display.current()),
);

console.log("\ndone");
