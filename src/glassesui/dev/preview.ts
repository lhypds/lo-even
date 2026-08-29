// A paper proof of the glasses layout: render each page to panels, then paint
// those panels onto a character grid the same shape as the display. Nothing here
// ships — it exists to check the columns line up and nothing overlaps.
//
// A grid of cells is what it is, so anything the display places by the pixel —
// the clock and the pager in their corners, a sentence centred on the screen —
// lands here only approximately. The columns are what this is for; for where a
// measured string actually falls, take a screenshot (see docs/Screen.md).
//
// Both right-hand corners are past what this can show at all. A cell is the
// widest glyph there is, and those corners are made of the narrowest — `1` is
// seven pixels and `:` is four, where the grid charges twelve for each — so the
// strings model as wider than the room they are actually given, and whichever
// gets there second loses its tail to the first. A clock reading `14:3`, or a
// deep path missing from the footer entirely because the place name reached its
// column first, is this file being coarse rather than the layout being wrong: on
// the glasses the heading's corner is 161 pixels sized off the widest it can ever
// be, and the footer's is cut against the path beside it (see theme.ts).
//
// The body is past what it can show for the same reason, and this is new: the
// body is now cut to its container in pixels rather than in cells, so a line of
// Latin holds about a fifth more characters than a grid of widest-glyph cells
// has columns for. Fifty-six characters fit in the five hundred and sixty-four
// pixels of a body line; forty-six is all this sheet can draw. A line that runs
// out of grid ends in an ellipsis here — the same mark the corners use when they
// collide — and it means "more than this can show" rather than "cut off on the
// glasses". Which lines fill and where a column ends is still worth reading off
// this; how much of a long one survives is not.
//
// The half-line of air between the entries of a list is the other thing it
// cannot draw. Three entries of two lines leave 28 pixels over and it is dealt
// between them, which rounds to nothing for the first gap here and to a whole
// blank row for the second. On the glasses the two gaps are the same.

import { PAGES } from "../pages/index";
import { composeView, type Draft } from "../pages/compose";
import { listView, readView } from "../pages/list";
import { spans } from "../pages/stack";
import type { PageContext } from "../pages/types";
import { layout, screens } from "../layout";
import { translator } from "../strings";
import { localeFor, formatPlace } from "../format";
import { clockFace, pathOf } from "../pages/chrome";
import { CHAR_WIDTH, CONTAINER, LINE_HEIGHT, SCREEN_HEIGHT, SCREEN_WIDTH } from "../theme";
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
    // The two days lo hands over with every forecast. Only the first of them is
    // drawn — the forecast row is today, tomorrow and what tomorrow is doing (see
    // skyRows) — and the second is here because lo sends it and a fixture that
    // quietly trimmed the answer would be proving the wrong thing. The sunrise on
    // the first is what the light reading counts to after dark, so it has to be
    // here for the evening half of that line to be checkable at all.
    upcoming: [
      { date: "2026-08-29", weatherCode: 61, tempMax: 26.1, tempMin: 20.4, sunrise: "2026-08-29T05:13", sunset: "2026-08-29T18:19" },
      { date: "2026-08-30", weatherCode: 3, tempMax: 24.9, tempMin: 19.8, sunrise: "2026-08-30T05:14", sunset: "2026-08-30T18:17" },
    ],
    units: { temperature: "°C", wind: "km/h" },
  },
  components: ["nearby", "events", "trends", "warnings"],
  posts: {
    status: "ready",
    data: [
      { id: 9, time: new Date(Date.now() - 3 * 60_000).toISOString(), latitude: 35.6582, longitude: 139.7019, body: "ラーメン美味しかった、行列は20分くらい", username: "kenji", comments: 2 },
      { id: 8, time: new Date(Date.now() - 42 * 60_000).toISOString(), latitude: 35.6601, longitude: 139.6990, body: "Great little second-hand bookshop tucked behind the station", username: "mari", comments: 0 },
      { id: 7, time: new Date(Date.now() - 5 * 3600_000).toISOString(), latitude: 35.6700, longitude: 139.7100, body: "", place: "Yoyogi Park", username: "tom", comments: 5 },
      // Long on purpose, and not much longer than lo will take: a post is 500
      // characters, which is more than three screenfuls of this display. It is
      // the one thing on these pages that can overrun the screen it is read on,
      // so the proof sheet has to carry one (see the prose block in layout.ts).
      { id: 6, time: new Date(Date.now() - 26 * 3600_000).toISOString(), latitude: 35.6400, longitude: 139.7400, body: "桜が咲いた。代々木公園の南門から入ってすぐの並木がいちばん早くて、もう七分咲きくらいになっている。朝のうちは人もまばらで、ベンチに座って十五分ほど眺めていた。屋台はまだ出ていないけれど、来週の週末には出るらしい。夜はライトアップもあるという話を近くの人に聞いた。花見の場所取りをするなら参道側より池のほうが空いているし、コンビニも駅の反対側まで行かずに済む。去年は満開の三日後に雨が降って一気に散ってしまったので、今年は早めに来てよかったと思う。", username: "yuki", comments: 2 },
    ],
  },
  people: {
    status: "ready",
    data: [
      { username: "mari", latitude: 35.6590, longitude: 139.7020, time: new Date(Date.now() - 90_000).toISOString() },
      { username: "kenji", latitude: 35.6620, longitude: 139.7060, time: new Date(Date.now() - 8 * 60_000).toISOString() },
    ],
  },
  // One of the three headlines has its story behind it and the other two have
  // not been opened, which is the state the reading screen is actually met in:
  // lo reads nothing until a row is tapped (see lo/server/articles.js).
  article: (link: string) =>
    link === "x"
      ? {
          status: "ready" as const,
          data: {
            id: "preview",
            url: "https://www3.nhk.or.jp/news/preview",
            title: "Shibuya Station east exit redevelopment enters final phase",
            source: "NHK",
            published: new Date(Date.now() - 2 * 3600_000).toISOString(),
            paragraphs: [
              "The final phase of the redevelopment around the east exit of Shibuya Station began on Monday, closing the pedestrian deck between the station and Hikarie for the first time since it opened.",
              "Work on the deck is expected to run until the spring, and the operator has laid a temporary crossing at street level for the eighty thousand people who use it each day.",
              "渋谷駅東口の再開発は最終段階に入り、歩行者デッキは春まで閉鎖される。",
            ],
            paywalled: false,
            partial: false,
          },
        }
      : { status: "idle" as const, data: null },
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
  // Somewhere for a coffee and somewhere to eat, off OpenStreetMap — the two
  // groups at the foot of the nearby page, each of which is one line however many
  // there are. Names of both kinds on purpose: the long Latin one and the short
  // CJK one are what decide how many of them that line actually carries, and a
  // fixture of `Cafe 1`, `Cafe 2` would prove the packing against a street that
  // does not exist (see venueLine in pages/nearby.ts).
  //
  // The rows carry the amenity and, on two of them, the cuisine, which is the
  // pair the entry's second line is made of — and the pair lo's own rule chooses
  // between: `Restaurant` says nothing beside `ramen` and is dropped, where
  // `Fast food` says something beside `gyudon` and stays.
  cafe: {
    status: "ready",
    data: [
      { id: "node/1", name: "喫茶ロマン", category: "cafe", latitude: 35.6584, longitude: 139.7011, distance: 84 },
      { id: "way/2", name: "Blue Bottle Coffee Shibuya", category: "cafe", cuisine: "coffee_shop", latitude: 35.6591, longitude: 139.7031, distance: 260 },
      { id: "node/3", name: "ドトール 道玄坂店", category: "cafe", latitude: 35.6575, longitude: 139.6982, distance: 410 },
      { id: "node/4", name: "Fuglen Tokyo", category: "cafe", latitude: 35.6669, longitude: 139.6944, distance: 1240 },
    ],
  },
  food: {
    status: "ready",
    data: [
      { id: "node/5", name: "一蘭 渋谷店", category: "restaurant", cuisine: "ramen", latitude: 35.6598, longitude: 139.7005, distance: 150 },
      { id: "way/6", name: "The Great Burger Stand", category: "fast_food", cuisine: "burger", latitude: 35.6612, longitude: 139.7042, distance: 520 },
      { id: "node/7", name: "吉野家", category: "fast_food", cuisine: "gyudon", latitude: 35.6563, longitude: 139.6996, distance: 640 },
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
      // The reader spoke last in this one, which is the other of the two shapes a
      // row of the inbox takes: the summary has to name the correspondent as well
      // as the speaker when they are not the same person, and a thread nobody is
      // waiting on never wears the disc (see pages/nearby.ts).
      { username: "tom", body: "Any time — the cat is the real draw", time: new Date(Date.now() - 5 * 3600_000).toISOString(), mine: true, unread: 0 },
      // And the other half of lo's inbox: a column of remarks rather than a
      // letter, which this list holds because the post is the reader's or because
      // they have written under it. It is the row that has to be headed by what it
      // is about — headed by a person it would be headed by whoever came past most
      // recently, which names none of what the row is — so the sheet carries one to
      // show that heading at the width it actually gets (see pages/nearby.ts).
      //
      // Post 6, which is the long one above: the same post the posts group reads
      // whole further down, so the two screens can be read against each other.
      { kind: "post" as const, postId: 6, post: "桜が咲いた。代々木公園の南門から入ってすぐの並木がいちばん早くて、もう七分咲きくらいになっている。", username: "mari", body: "南門は今日も混んでた？", time: new Date(Date.now() - 2 * 3600_000).toISOString(), mine: false, unread: 1 },
    ],
  },
  // One of the two exchanges has been opened and the other has not, which is the
  // pair of states the screen behind a letter is actually met in: the whole
  // correspondence where the three seconds have elapsed, and the last line of it
  // standing in until they have (see pages/nearby.ts). Oldest first, which is how
  // lo answers; the page turns it round.
  thread: (username: string) =>
    username === "mari"
      ? {
          status: "ready" as const,
          data: [
            { id: 1, body: "今週末って空いてる？", time: new Date(Date.now() - 3 * 3600_000).toISOString(), mine: false, read: true },
            { id: 2, body: "土曜なら空いてる。日曜は仕事", time: new Date(Date.now() - 2.5 * 3600_000).toISOString(), mine: true, read: true },
            { id: 3, body: "じゃあ土曜で。前に話してた古本屋、まだ行ってないよね？あの猫がいるところ", time: new Date(Date.now() - 40 * 60_000).toISOString(), mine: false, read: true },
            { id: 4, body: "行ってない。九時まで開いてるらしいから夕方でも大丈夫", time: new Date(Date.now() - 20 * 60_000).toISOString(), mine: true, read: true },
            { id: 5, body: "明日どこで待ち合わせにする？", time: new Date(Date.now() - 12 * 60_000).toISOString(), mine: false, read: false },
          ],
        }
      : { status: "idle" as const, data: null },
  // The same pair for the other group that is about a person: one name opened and
  // one not. The filled one carries everything a profile can carry — the two
  // figures, a bio, contacts of both kinds and more posts than the screen draws —
  // because this sheet exists to show what the fullest screen looks like, and a
  // profile is the longest thing on the nearby page now that a post is not.
  profile: (username: string) =>
    username === "mari"
      ? {
          status: "ready" as const,
          data: {
            user: {
              username: "mari",
              bio: "古本屋めぐりと、だれも見ていない路地の写真。だいたい渋谷か下北のあたりにいます。",
              email: "mari@example.com",
              website: "https://example.com/mari",
              line: "mari-line",
              links: [
                { kind: "instagram", value: "mari.walks" },
                { kind: "xiaohongshu", value: "mari_tokyo" },
              ],
            },
            follows: { followers: 1, following: 42, isFollowing: true },
            posts: [
              { id: 8, time: new Date(Date.now() - 42 * 60_000).toISOString(), latitude: 35.6601, longitude: 139.6990, body: "Great little second-hand bookshop tucked behind the station", username: "mari", comments: 0 },
              { id: 5, time: new Date(Date.now() - 20 * 3600_000).toISOString(), latitude: 35.6612, longitude: 139.7005, body: "", place: "Miyashita Park", username: "mari", comments: 3 },
              { id: 4, time: new Date(Date.now() - 3 * 86400_000).toISOString(), latitude: 35.6633, longitude: 139.6981, body: "雨上がりの路地がいちばんきれい", username: "mari", comments: 1 },
              { id: 3, time: new Date(Date.now() - 5 * 86400_000).toISOString(), latitude: 35.6644, longitude: 139.6972, body: "coffee at the counter, nine seats, no music", username: "mari", comments: 0 },
              { id: 2, time: new Date(Date.now() - 9 * 86400_000).toISOString(), latitude: 35.6655, longitude: 139.6963, body: "古本市、今日まで", username: "mari", comments: 2 },
              { id: 1, time: new Date(Date.now() - 14 * 86400_000).toISOString(), latitude: 35.6666, longitude: 139.6954, body: "the sixth post, which this screen never draws", username: "mari", comments: 0 },
            ],
          },
        }
      : { status: "idle" as const, data: null },
  // And the same pair for the column under a post: one post opened and the rest
  // not. It is the one of the three where the second state is where most posts
  // stay rather than a moment they pass through — a post that nobody has answered
  // says so on its own count, and lo is never asked about it (see feeds.ts).
  //
  // Oldest first, which is how lo answers and how this one is drawn: the post is
  // the thing at the top of the screen and everything under it came after it, where
  // an exchange has to be turned round (see `column` in pages/nearby.ts).
  // The one answered is the long one, because that is the post this sheet reads:
  // it draws the longest entry of each group, on purpose, being the only screen in
  // the app that can run past its own bottom edge — and a column under a post that
  // already overruns is exactly the case worth looking at.
  comments: (postId: string) =>
    postId === "6"
      ? {
          status: "ready" as const,
          data: [
            { id: 1, body: "南門は今日も混んでた？", time: new Date(Date.now() - 2 * 3600_000).toISOString(), username: "mari" },
            { id: 2, body: "朝のうちなら空いてる。九時をすぎると場所取りが始まる", time: new Date(Date.now() - 3600_000).toISOString(), username: "heyang" },
          ],
        }
      : { status: "idle" as const, data: null },
  unread: 2,
  heading: { status: "on", heading: 127.4, headingAccuracy: 8, turnRate: 14.2 },
  username: "heyang",
};

function raster(panels: ReturnType<typeof layout>): string {
  const grid: string[][] = Array.from({ length: ROWS }, () => Array<string>(COLS).fill(" "));
  const box: boolean[][] = Array.from({ length: ROWS }, () => Array<boolean>(COLS).fill(false));
  // The rows the box round a chosen group covers. Kept apart from the frame's,
  // because the two land in the same columns here — the selection runs the whole
  // width of the screen, inside the frame by a pixel — and a proof sheet that
  // drew them with the same character would not be showing the selection at all.
  const picked = Array.from({ length: ROWS }, () => false);

  for (const panel of panels) {
    const col0 = Math.round(panel.rect.x / CHAR_WIDTH);
    const row0 = Math.round((panel.rect.y - 1) / LINE_HEIGHT);
    const inset = panel.bordered ? 1 : 0;
    if (panel.bordered) {
      const rows = Math.max(1, Math.round(panel.rect.height / LINE_HEIGHT));
      for (let r = row0; r < row0 + rows && r < ROWS; r += 1) {
        if (panel.id !== CONTAINER.frame) picked[r] = true;
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
      // Floored rather than rounded: this is the last whole cell a right-aligned
      // line can end in, and these boxes now run to the inside of the border,
      // whose own pixel shares a cell with them. Rounded up, the last character
      // of the clock would be laid in the cell the frame is drawn in and lost.
      const right = Math.floor((panel.rect.x + panel.rect.width) / CHAR_WIDTH);
      // Hung from the container's right edge, and allowed to start left of the
      // container's own left edge to get there. That is not the display being
      // described wrongly, it is this grid being too coarse to describe it: the
      // corner is fifteen characters of narrow type inside 161 pixels, which is
      // thirteen cells, because a cell is the widest glyph there is and a `1` is
      // seven pixels. Clamped to the box it would lose its last characters off the
      // right of the screen instead, and a proof that drops what it cannot fit is
      // the one thing worse than a proof that is a cell out.
      let col = line.length > text.length ? right - cells(text) : col0 + inset;
      let written = -1;
      for (const ch of text) {
        // The last column belongs to the frame, and a line that reaches it has
        // outrun the grid rather than the screen: the body is cut in pixels and
        // this is drawn in cells, so a full line of Latin has ten more characters
        // than there are columns to put them in. Ended with the same ellipsis a
        // collision gets, because a proof that drops what it cannot fit in
        // silence is the one thing worse than a proof that is a cell out.
        if (col >= COLS - 1) {
          if (written >= 0) grid[row][written] = "…";
          break;
        }
        if (col >= 0) {
          // Whoever got here first keeps the cell, and the one that arrives
          // second stops and says so. Two strings can want the same column here
          // while standing forty pixels apart on the glasses — the bearing ends
          // at 396 and the corner begins at 437 — because a cell is the widest
          // glyph there is and both of those are made of narrower type than that.
          // Writing over would splice them into one unreadable word; carrying on
          // into the next free cell would print `127° S` for a bearing that says
          // SE, which is a proof telling a lie rather than being coarse.
          if (grid[row][col] !== " ") {
            if (written >= 0) grid[row][written] = "…";
            break;
          }
          grid[row][col] = ch;
          written = col;
        }
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
        // Heavy where the group under the reader is boxed, light where it is only
        // the frame. The real box has a top and a bottom as well, half a line
        // above and below the rows it covers, and half a line is not something a
        // grid of whole lines can draw.
        row[0] = picked[r] ? "┃" : "│";
        row[COLS - 1] = picked[r] ? "┃" : "│";
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
      mail: t("mail.badge"),
      path: pathOf(page),
      index,
      total: steps.length,
    });
    console.log(`\n╔══ ${pathOf(page)}${total > 1 ? ` (screen ${screen + 1}/${total})` : ""} ${"═".repeat(Math.max(0, 40 - page.id.length))}`);
    console.log(raster(panels));
  }
}

// The standing page in the two states the fixture above cannot reach, which are
// the states most of the world's afternoon is actually in.
//
// **Nothing in force overhead.** The fixture has three warnings out over
// Shibuya, and a warning takes the line the days ahead would otherwise have had:
// the page is seven lines, everything about the minute the reader is standing in
// is written first, and the forecast is dealt whatever is left (see aheadRows in
// pages/here.ts). So that row exists and this sheet never drew it.
//
// **And a fix that has gone stale.** The fixture's is forty-five seconds old,
// which is the state the app is in whenever it is working; past two minutes the
// row says its age instead of its speed, and drops the ± as well to make room
// for saying so (see fixRow). Two lines of the fixture changed rather than a
// fixture of its own: it is the same screen an hour later with the warnings
// lifted, which is the comparison worth having beside the one above.
{
  const page = PAGES[0];
  const clear: PageContext = {
    ...ctx,
    fixAt: Date.now() - 39 * 60_000,
    warnings: { status: "ready", data: { covered: true, items: [] } },
  };
  const view = page.render(clear);
  const panels = layout(view, 0, {
    place: formatPlace(clear.place),
    time: clockFace(clear),
    status: "",
    unread: clear.unread,
    mail: t("mail.badge"),
    path: pathOf(page),
    index: 1,
    total: steps.length,
  });
  console.log(`\n╔══ ${pathOf(page)} nothing in force, stale fix ${"═".repeat(14)}`);
  console.log(raster(panels));
}

// What is under those pages. A list screen is drawn once per group, focused on
// the first entry of it — which is what the reader sees a flick after the wheel
// has carried them over the boundary into it — and then the reading screen that
// entry opens onto. Both of them are one page's own; neither is in the count
// above, because a list is not a page of the dashboard (see pages/list.ts).
for (const page of PAGES) {
  if (!page.offered(ctx)) continue;
  const view = page.render(ctx);
  const items = page.items?.(ctx) ?? [];
  const groups = view.block.kind === "readings" ? spans(view.block.rows) : [];

  groups.forEach((group, picked) => {
    const path = pathOf(page, group.id);
    const chrome = {
      place: formatPlace(ctx.place),
      time: clockFace(ctx),
      status: "",
      unread: ctx.unread,
      mail: t("mail.badge"),
    };

    // The page itself with a box round this group, which is what the first tap
    // does. Drawn for every group rather than only the first, because the box is
    // the one thing here whose height comes out of the dealing — a group that got
    // one line and a group that got three are two different boxes (see stack.ts).
    const choose = layout(view, 0, { ...chrome, path: pathOf(page), index: picked + 1, total: groups.length }, picked);
    console.log(
      `\n╔══ ${pathOf(page)} choosing ${group.id} ${"═".repeat(Math.max(0, 24 - group.id.length))}`,
    );
    console.log(raster(choose));

    const mine = items.filter((item) => item.group === group.id);
    if (mine.length === 0) return;
    const list = layout(listView(mine, 0, t), 0, { ...chrome, path, index: 1, total: mine.length });
    console.log(`\n╔══ ${path} (the list) ${"═".repeat(Math.max(0, 26 - path.length))}`);
    console.log(raster(list));

    // The longest entry of the group rather than the first: this is the only
    // screen in the app that can run past its own bottom edge, and the whole
    // point of drawing it here is to see what happens when it does.
    const item = mine.reduce((longest, entry) => (entry.body.length > longest.body.length ? entry : longest));
    if (!item.body) return;
    const read = readView(item);
    const total = screens(read);
    for (let screen = 0; screen < total; screen += 1) {
      const panels = layout(read, screen, { ...chrome, path, index: screen + 1, total });
      console.log(
        `\n╔══ ${path} (read${total > 1 ? `, screen ${screen + 1}/${total}` : ""}) ${"═".repeat(Math.max(0, 24 - path.length))}`,
      );
      console.log(raster(panels));
    }
  });
}

// The composer, which is not one of the pages and is not in the count above: it
// takes the display over while a dictation is waiting to be sent somewhere. All
// four answers are drawn, because what is under the words differs on each — two
// marked answers, or the one name a reply is going to, or the post a remark is
// going under. The words themselves are the same on all of them now: five lines
// of what was heard, whichever answer is up, and the cut each one would save at
// is no longer drawn (see pages/compose.ts).
const SPOKEN =
  language === "en"
    ? "second-hand bookshop behind the station, open until nine, the one with the cat"
    : "駅の裏の古本屋、九時まで開いてる、猫がいる方の店。コーヒーも出してくれるらしいから、今度ゆっくり行ってみたい";
const DRAFTS: Draft[] = [
  { kind: "mark", text: SPOKEN, coords: ctx.coords! },
  { kind: "post", text: SPOKEN, coords: ctx.coords! },
  // Said into one open letter rather than at the street, which is the same screen
  // asked the shorter question: not which of two things this is, only whether it
  // goes. `mari` is the correspondent the inbox above is holding a letter from.
  { kind: "reply", text: SPOKEN, to: "mari" },
  // And said under one open post, which is that same shorter question about the
  // other of the two things a hold can answer. The last row is where they differ:
  // a letter has somebody to be addressed to and this has not, so it names the post
  // instead — the same words lo heads the column with on the phone. This is the
  // post the sheet reads whole above, which is also the longest, so the row is
  // drawn here at the width it actually has to survive.
  {
    kind: "comment",
    text: SPOKEN,
    post: 6,
    about: ctx.posts.data?.find((post) => post.id === 6)?.body ?? "",
  },
];
for (const draft of DRAFTS) {
  const panels = layout(composeView(draft, t), 0, {
    place: formatPlace(ctx.place),
    time: clockFace(ctx),
    status: "",
    unread: ctx.unread,
    mail: t("mail.badge"),
  });
  console.log(`\n╔══ compose (${draft.kind}) ${"═".repeat(30 - draft.kind.length)}`);
  console.log(raster(panels));
}

const entries = PAGES.filter((page) => page.offered(ctx)).reduce(
  (total, page) => total + (page.items?.(ctx).length ?? 0),
  0,
);
console.log(
  `\n${steps.length} screenfuls of dashboard over ${entries} entries, and the composer, ${COLS}x${ROWS} cells\n`,
);
