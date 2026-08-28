// A paper proof of the glasses layout: render each page to panels, then paint
// those panels onto a character grid the same shape as the display. Nothing here
// ships — it exists to check the columns line up and nothing overlaps.
//
// A grid of cells is what it is, so anything the display places by the pixel —
// the clock and the pager in their corners, a sentence centred on the screen —
// lands here only approximately. The columns are what this is for; for where a
// measured string actually falls, take a screenshot (see docs/Screen.md).
//
// The right-hand end of the heading is past what this can show at all now that
// the unread badge stands there beside the clock. A cell is the widest glyph
// there is, and that corner is made of the narrowest — `1` is seven pixels and
// `:` is four, where the grid charges twelve for each — so the two strings model
// as wider than the space they are actually given, and the second of them loses
// its last character to the first. On the glasses that corner is 158 pixels of
// room, sized off the widest it can ever be. A clock reading `14:3` here is this
// file being coarse, not the layout being wrong.

import { PAGES } from "../pages/index";
import { composeView, type DraftKind } from "../pages/compose";
import type { PageContext } from "../pages/types";
import { layout, screens } from "../layout";
import { translator } from "../strings";
import { localeFor, formatPlace } from "../format";
import { clockFace } from "../pages/chrome";
import { CHAR_WIDTH, LINE_HEIGHT, SCREEN_HEIGHT, SCREEN_WIDTH } from "../theme";
import { cells } from "../metrics";
import { args } from "./host";

const COLS = Math.round(SCREEN_WIDTH / CHAR_WIDTH);
const ROWS = Math.round(SCREEN_HEIGHT / LINE_HEIGHT);

const [language = "en", scale] = args() as ["en" | "ja" | "zh", string?];
const t = translator(language);

const ctx: PageContext = {
  now: new Date("2026-08-28T14:32:00+09:00"),
  language,
  locale: localeFor(language),
  t,
  coords: { latitude: 35.658034, longitude: 139.701636, accuracy: 12, altitude: 41.2, speed: 1.4 },
  fixAt: Date.now() - 45_000,
  place: { name: "Shibuya", locality: "Shibuya City", region: "Tokyo", country: "Japan", countryCode: "JP" },
  weather: {
    timezone: { id: "Asia/Tokyo", abbreviation: "JST", offsetSeconds: 32400 },
    elevation: 38,
    current: { temperature: 23.4, apparent: 24.1, humidity: 61, weatherCode: 2, windSpeed: 12.3, isDay: true },
    today: { date: "2026-08-28", weatherCode: 2, tempMax: 27.8, tempMin: 19.2, sunrise: "2026-08-28T05:12", sunset: "2026-08-28T18:20" },
    upcoming: [],
    units: { temperature: "°C", wind: "km/h" },
  },
  components: ["nearby", "events", "trends", "warnings"],
  posts: {
    status: "ready",
    data: [
      { id: 9, time: new Date(Date.now() - 3 * 60_000).toISOString(), latitude: 35.6582, longitude: 139.7019, body: "ラーメン美味しかった、行列は20分くらい", username: "kenji", comments: 2 },
      { id: 8, time: new Date(Date.now() - 42 * 60_000).toISOString(), latitude: 35.6601, longitude: 139.6990, body: "Great little second-hand bookshop tucked behind the station", username: "mari", comments: 0 },
      { id: 7, time: new Date(Date.now() - 5 * 3600_000).toISOString(), latitude: 35.6700, longitude: 139.7100, body: "", place: "Yoyogi Park", username: "tom", comments: 5 },
      { id: 6, time: new Date(Date.now() - 26 * 3600_000).toISOString(), latitude: 35.6400, longitude: 139.7400, body: "桜が咲いた", username: "yuki", comments: 1 },
    ],
  },
  people: {
    status: "ready",
    data: [
      { username: "mari", latitude: 35.6590, longitude: 139.7020, time: new Date(Date.now() - 90_000).toISOString() },
      { username: "kenji", latitude: 35.6620, longitude: 139.7060, time: new Date(Date.now() - 8 * 60_000).toISOString() },
    ],
  },
  news: {
    status: "ready",
    data: [
      { kind: "news", title: "Shibuya Station east exit redevelopment enters final phase", url: "x", source: "NHK", time: new Date(Date.now() - 2 * 3600_000).toISOString() },
      { kind: "news", title: "渋谷スクランブル交差点、週末は歩行者天国に", url: "y", source: "朝日新聞", time: new Date(Date.now() - 6 * 3600_000).toISOString() },
      { kind: "news", title: "New rooftop garden opens above Miyashita Park", url: "z", source: "Japan Times", time: new Date(Date.now() - 30 * 3600_000).toISOString() },
    ],
  },
  events: {
    status: "ready",
    data: [
      { kind: "event", title: "Miyashita Park night market, Fri-Sun", url: "e1", source: "Peatix", time: new Date(Date.now() + 3600_000).toISOString() },
      { kind: "event", title: "代々木公園フリーマーケット", url: "e2", source: "Peatix", time: new Date(Date.now() + 2 * 86400_000).toISOString() },
    ],
  },
  trends: {
    status: "ready",
    data: [
      { name: "台風12号", count: 200000, headline: "関東は明日未明が最接近", url: "a" },
      { name: "Shohei Ohtani", count: 50000, headline: "Two more home runs against the Padres", url: "b" },
      { name: "秋分の日", count: 2000, url: "c" },
    ],
  },
  warnings: {
    status: "ready",
    data: {
      covered: true,
      scope: "municipality",
      area: "渋谷区",
      issuedAt: new Date(Date.now() - 55 * 60_000).toISOString(),
      areaCount: 3,
      items: [
        { name: "大雨", severity: "warning" },
        { name: "雷", severity: "advisory" },
        { name: "洪水", severity: "urgent" },
      ],
    },
  },
  messages: {
    status: "ready",
    data: [
      { username: "mari", body: "明日どこで待ち合わせにする？", time: new Date(Date.now() - 12 * 60_000).toISOString(), mine: false, unread: 2 },
      { username: "tom", body: "Thanks for the bookshop tip — went yesterday", time: new Date(Date.now() - 5 * 3600_000).toISOString(), mine: false, unread: 0 },
    ],
  },
  unread: 2,
  heading: { status: "on", heading: 127.4, headingAccuracy: 8, turnRate: 14.2 },
  username: "heyang",
};

function raster(panels: ReturnType<typeof layout>): string {
  const grid: string[][] = Array.from({ length: ROWS }, () => Array<string>(COLS).fill(" "));
  const box: boolean[][] = Array.from({ length: ROWS }, () => Array<boolean>(COLS).fill(false));

  for (const panel of panels) {
    const col0 = Math.round(panel.rect.x / CHAR_WIDTH);
    const row0 = Math.round((panel.rect.y - 1) / LINE_HEIGHT);
    const inset = panel.bordered ? 1 : 0;
    if (panel.bordered) {
      const rows = Math.max(1, Math.round(panel.rect.height / LINE_HEIGHT));
      for (let r = row0; r < row0 + rows && r < ROWS; r += 1) {
        for (let c = col0; c < col0 + Math.round(panel.rect.width / CHAR_WIDTH) && c < COLS; c += 1) {
          box[r][c] = true;
        }
      }
    }
    panel.text.split("\n").forEach((line, index) => {
      const row = row0 + index;
      if (row < 0 || row >= ROWS) return;
      // A line padded on the left is one that was right-aligned in pixels, and
      // pixels are what this grid does not have: drawn from its own left edge it
      // would land a cell or two off. Hung from the container's right edge
      // instead, which is where the display puts it.
      const text = line.trimStart();
      const right = Math.round((panel.rect.x + panel.rect.width) / CHAR_WIDTH);
      // Hung from the container's right edge, and allowed to start left of the
      // container's own left edge to get there. That is not the display being
      // described wrongly, it is this grid being too coarse to describe it: the
      // corner is fifteen characters of narrow type inside 158 pixels, which is
      // thirteen cells, because a cell is the widest glyph there is and a `1` is
      // seven pixels. Clamped to the box it would lose its last characters off the
      // right of the screen instead, and a proof that drops what it cannot fit is
      // the one thing worse than a proof that is a cell out.
      let col = line.length > text.length ? right - cells(text) : col0 + inset;
      for (const ch of text) {
        if (col >= COLS) break;
        if (col >= 0) grid[row][col] = ch;
        col += cells(ch);
      }
    });
  }

  return grid
    .map((row, r) => {
      // The frame is drawn into the grid rather than printed around it. The panel
      // is 576 pixels, which is forty-eight cells, and the border stands inside
      // that at either end — so a row that put its border outside the grid would
      // be a fifty-character picture of a forty-eight character screen, two cells
      // of room this display has not got, at exactly the end everything in the
      // corner is measured from. What is left between them is 46, which is what
      // `frameCells` says the heading has to fit in (see theme.ts).
      if (box[r][0]) {
        row[0] = "│";
        row[COLS - 1] = "│";
      }
      return row.join("").replace(/\s+$/, "").padEnd(COLS, " ");
    })
    .join("\n");
}

// The country that can feed none of it, which is most of them: every group on the
// last page goes, and the page says so in one sentence instead. The first page
// loses its warnings line and its counts along with them.
if (scale === "bare") {
  ctx.components = [];
  ctx.posts = { status: "ready", data: [] };
  ctx.people = { status: "ready", data: [] };
  ctx.messages = { status: "ready", data: [] };
  ctx.unread = 0;
}

// Pagination check: a list longer than one screen has to become several steps.
if (scale === "many") {
  const base = ctx.posts.data ?? [];
  ctx.posts = {
    status: "ready",
    data: Array.from({ length: 4 }, (_, round) =>
      base.map((post) => ({ ...post, id: post.id + round * 100, body: `${post.body || post.place} #${round + 1}` })),
    ).flat(),
  };
}

const steps: Array<{ id: string; screen: number; total: number }> = [];
for (const page of PAGES) {
  if (!page.offered(ctx)) continue;
  const view = page.render(ctx);
  const total = screens(view);
  for (let screen = 0; screen < total; screen += 1) steps.push({ id: page.id, screen, total });
}

let index = 0;
for (const page of PAGES) {
  if (!page.offered(ctx)) continue;
  const view = page.render(ctx);
  const total = screens(view);
  for (let screen = 0; screen < total; screen += 1) {
    index += 1;
    const panels = layout(view, screen, {
      place: formatPlace(ctx.place),
      time: clockFace(ctx),
      status: "",
      unread: ctx.unread,
      index,
      total: steps.length,
    });
    console.log(`\n╔══ ${page.id}${total > 1 ? ` (screen ${screen + 1}/${total})` : ""} ${"═".repeat(Math.max(0, 40 - page.id.length))}`);
    console.log(raster(panels));
  }
}

// The composer, which is not one of the pages and is not in the count above: it
// takes the display over while a dictation is waiting to be told what it is. Both
// answers are drawn, because the two are not the same screenful — the sentence is
// shown as the answer under the wheel would save it, so the mark's 48 characters
// are visibly fewer words than the post's (see pages/compose.ts).
const SPOKEN =
  language === "en"
    ? "second-hand bookshop behind the station, open until nine, the one with the cat"
    : "駅の裏の古本屋、九時まで開いてる、猫がいる方の店。コーヒーも出してくれるらしいから、今度ゆっくり行ってみたい";
for (const kind of ["mark", "post"] as DraftKind[]) {
  const panels = layout(composeView({ text: SPOKEN, coords: ctx.coords!, kind }, t), 0, {
    place: formatPlace(ctx.place),
    time: clockFace(ctx),
    status: "",
    unread: ctx.unread,
  });
  console.log(`\n╔══ compose (${kind}) ${"═".repeat(30 - kind.length)}`);
  console.log(raster(panels));
}

console.log(`\n${steps.length} screenfuls and the composer, ${COLS}x${ROWS} cells\n`);
