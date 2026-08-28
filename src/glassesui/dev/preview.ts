// A paper proof of the glasses layout: render each card to panels, then paint
// those panels onto a character grid the same shape as the display. Nothing here
// ships — it exists to check the columns line up and nothing overlaps.

import { CARDS } from "../cards/index";
import type { CardContext } from "../cards/types";
import { layout, pageCount } from "../layout";
import { translator } from "../strings";
import { localeFor, formatPlace } from "../format";
import { CHAR_WIDTH, LINE_HEIGHT, SCREEN_HEIGHT, SCREEN_WIDTH } from "../theme";
import { cells } from "../metrics";
import { args } from "./host";

const COLS = Math.round(SCREEN_WIDTH / CHAR_WIDTH);
const ROWS = Math.round(SCREEN_HEIGHT / LINE_HEIGHT);

const [language = "en", scale] = args() as ["en" | "ja" | "zh", string?];
const t = translator(language);

const ctx: CardContext = {
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
  nearby: {
    status: "ready",
    data: {
      place: { name: "Shibuya" },
      items: [
        { kind: "news", title: "Shibuya Station east exit redevelopment enters final phase", url: "x", source: "NHK", time: new Date(Date.now() - 2 * 3600_000).toISOString() },
        { kind: "news", title: "渋谷スクランブル交差点、週末は歩行者天国に", url: "y", source: "朝日新聞", time: new Date(Date.now() - 6 * 3600_000).toISOString() },
        { kind: "news", title: "New rooftop garden opens above Miyashita Park", url: "z", source: "Japan Times", time: new Date(Date.now() - 30 * 3600_000).toISOString() },
      ],
    },
  },
  events: { status: "loading", data: null },
  trends: {
    status: "ready",
    data: {
      name: "Tokyo",
      items: [
        { name: "台風12号", count: 200000, headline: "関東は明日未明が最接近", url: "a" },
        { name: "Shohei Ohtani", count: 50000, headline: "Two more home runs against the Padres", url: "b" },
        { name: "秋分の日", count: 2000, url: "c" },
      ],
    },
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
      let col = col0 + inset;
      for (const ch of line) {
        if (col >= COLS) break;
        grid[row][col] = ch;
        col += cells(ch);
      }
    });
  }

  return grid
    .map((row, r) => {
      const line = row.join("").replace(/\s+$/, "");
      return (box[r][0] ? "│" : " ") + line.padEnd(COLS, " ") + (box[r][0] ? "│" : " ");
    })
    .join("\n");
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

const steps: Array<{ id: string; page: number; pages: number }> = [];
for (const card of CARDS) {
  if (!card.offered(ctx)) continue;
  const view = card.render(ctx);
  const pages = pageCount(view.block);
  for (let page = 0; page < pages; page += 1) steps.push({ id: card.id, page, pages });
}

let index = 0;
for (const card of CARDS) {
  if (!card.offered(ctx)) continue;
  const view = card.render(ctx);
  const pages = pageCount(view.block);
  for (let page = 0; page < pages; page += 1) {
    index += 1;
    const panels = layout(view, page, {
      place: formatPlace(ctx.place),
      status: "",
      index,
      total: steps.length,
    });
    console.log(`\n╔══ ${card.id}${pages > 1 ? ` (page ${page + 1}/${pages})` : ""} ${"═".repeat(Math.max(0, 40 - card.id.length))}`);
    console.log(raster(panels));
  }
}
console.log(`\n${steps.length} screenfuls, ${COLS}x${ROWS} cells\n`);
