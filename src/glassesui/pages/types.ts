// What a page is, and the only two shapes it is allowed to come back in.
//
// A page is one screenful, and it is deliberately not one subject. The website
// has room for a grid of tiles and lets each of them answer one question; a
// heads-up display has seven lines, and spending all seven on the time — then
// making the reader scroll for the temperature, and scroll again for the warning
// in force over their head — is a dashboard that costs a flick per fact. So there
// are three pages and each of them is a stack of groups: where you are standing,
// then who and what is around you, then what is being reported about the wider
// place. Every line is a different subject and none of them is a heading.
//
// What a page does *not* do is decide where any of that lands. No page knows the
// screen is 576 wide or how many lines it has: it hands back rows, the layout
// turns them into containers, and the fitting is the layout's arithmetic (see
// layout.ts). How many lines each group gets is the one piece of that a page does
// own, because it is the only thing that knows a warning matters more than a
// trend — and even that is arithmetic rather than judgement (see stack.ts).
//
// The two block shapes:
//
//   • readings — a label and a line about it, which is lo's `<dl>`, and which is
//     what all three pages are made of. A group's label is written on its first
//     row and left blank on the rest, so a stack of them reads as a list with a
//     word in the margin.
//   • note — the sentence a page puts up when it cannot draw at all, which in
//     practice means there is no fix yet.

import type {
  Coordinates,
  Language,
  LoFeedItem,
  LoPerson,
  LoPlace,
  LoPost,
  LoThread,
  LoTrend,
  LoWarningsResult,
  LoWeather,
} from "../../types";
import type { Translate } from "../strings";

/**
 * Where one feed has got to. Four states rather than a nullable, because lo is
 * careful about exactly this and the glasses have to be as careful: "no posts
 * around here" and "the posts have not arrived yet" are different claims, and a
 * page that prints the first while meaning the second is lying about the street.
 */
export interface Feed<T> {
  status: "idle" | "loading" | "ready" | "failed";
  data: T | null;
}

/** A reading off the handset's own instruments, which no server is asked about. */
export interface HeadingReading {
  status: "idle" | "asking" | "listening" | "on" | "denied" | "unsupported";
  /** Degrees clockwise from north, where the top of the phone is pointing. */
  heading: number | null;
  headingAccuracy: number | null;
  turnRate: number | null;
}

/** Everything a page is allowed to read. Assembled once per paint (see main.ts). */
export interface PageContext {
  now: Date;
  language: Language;
  locale: string;
  t: Translate;
  coords: Coordinates | null;
  /** When that fix was taken, so a page can say how old it is rather than imply it is now. */
  fixAt: number | null;
  place: LoPlace | null;
  weather: LoWeather | null;
  /** Which regional feeds this country has — the server's half of the answer. */
  components: string[];
  posts: Feed<LoPost[]>;
  people: Feed<LoPerson[]>;
  news: Feed<LoFeedItem[]>;
  events: Feed<LoFeedItem[]>;
  trends: Feed<LoTrend[]>;
  warnings: Feed<LoWarningsResult>;
  messages: Feed<LoThread[]>;
  /** How much is waiting to be read, which rides in on the presence trade. */
  unread: number;
  heading: HeadingReading;
  /** The signed-in account, so the people line can leave you out of who else is here. */
  username: string | null;
}

/**
 * One label and the line that answers it, which is lo's `<dl>` row. The value is
 * a whole sentence of readings rather than a single figure — `28°C · feels 34° ·
 * Partly cloudy` — because a line of this screen is thirty-odd cells and a lone
 * number wastes twenty-five of them. An empty label carries the row above's:
 * that is how a group of four posts is one word and four lines.
 */
export interface ReadingRow {
  label: string;
  value: string;
}

export type Block =
  | { kind: "readings"; rows: ReadingRow[] }
  | { kind: "note"; text: string };

/** What one page looks like right now — its heading, and one block under it. */
export interface PageView {
  title: string;
  /** The right end of the heading. Every page wears the same pair: where, and when. */
  meta?: string;
  block: Block;
  /**
   * What the footer says while this page is up. The place you are standing in
   * unless the page has something better, which is lo's HereStrip moved to the
   * bottom of the screen — stated once so no page has to repeat it.
   */
  context?: string;
}

export interface PageDefinition {
  /**
   * What this page is called where it has to be named — the anchor that survives
   * a repaint, and the word `feeds.ensure` is told when it comes into view.
   */
  id: string;
  /**
   * Whether this page is worth drawing where the reader is standing. All three
   * answer true: with only three of them, a page that took itself off the
   * sequence would move the other two under a reader who had learned where they
   * were. What a country cannot feed is a line left off a page, not a page.
   */
  offered(context: PageContext): boolean;
  render(context: PageContext): PageView;
}
