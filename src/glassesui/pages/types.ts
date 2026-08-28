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
  LoArticle,
  LoFeedItem,
  LoMessage,
  LoPerson,
  LoPersonPage,
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
  /**
   * The words behind a headline, for a row that has been opened. A read and
   * never a request: a page builds its whole list on every paint and must be
   * able to ask this of every row without any of them costing anything. What
   * starts the fetch is the reader arriving on the reading screen (see main.ts).
   */
  article(link: string): Feed<LoArticle>;
  /**
   * One whole exchange, for a correspondent whose letter has been opened. A read
   * and never a request, exactly as `article` is and for the same reason — and
   * more sharply here, because the request behind it is the one that tells lo the
   * letter has been read. A page that could start it by drawing a row would be
   * marking every correspondent read on the way past (see main.ts).
   *
   * Idle until the reader has stopped on one letter for three seconds. What the
   * screen draws in the meantime is the one line the inbox already handed over,
   * written exactly as the exchange will write it, so the rest arriving adds lines
   * underneath rather than moving the one being read.
   */
  thread(username: string): Feed<LoMessage[]>;
  /**
   * Who one of the names on the street is, for a person whose entry has been
   * opened: the line they wrote about themselves, how to reach them off lo, the
   * two follow figures and their last few posts. A read and never a request, for
   * the reason both of the above are — the page builds an entry for everybody
   * about on every paint, and a call that fetched would be lo asked about a whole
   * street on the strength of the reader walking down it.
   *
   * Idle until the reader has opened one of them, and no clock on it: a profile
   * is a read that files nothing, so unlike the letter above there is nothing to
   * be careful of in asking (see main.ts).
   */
  profile(username: string): Feed<LoPersonPage>;
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
  /**
   * Which group this row was dealt to, where it was dealt by one (see stack.ts).
   * It is what a box can be drawn round and what a tap can open; the rows the
   * standing page builds by hand have none, and that page has nothing to open.
   */
  group?: string;
}

/**
 * One entry of a list, which is what a page turns into when the reader steps
 * into it. A summary line on a page is one row of a `<dl>`; this is one of lo's
 * cards' rows, and it is bigger because there is now a screen for it to be big
 * on.
 *
 * The four fields are the three screens an entry appears on, in order: `head`
 * and `line` are the two lines the list gives it, `head` is again the heading of
 * the screen that reads it, and `body` is what that screen has under the
 * heading. Nothing is invented at either end — what the list shows cut is what
 * the reading shows whole.
 */
export interface Item {
  /**
   * Which of the page's groups this came out of — `posts`, `messages`, `news`.
   * It is the key the words are looked up under (every one of them is
   * `<group>.title` in the dictionary, which is what the heading says) and it is
   * what the last part of the path is made from, though not always letter for
   * letter: the letters are `msg` in a path and `messages` in a heading, because
   * the corner is the narrowest line on the screen (see chrome.ts).
   */
  group: string;
  /**
   * What this entry is, across a refresh. The list is rebuilt on every paint and
   * a post deleted on somebody's phone shortens it under the reader, so where
   * they are is kept as this rather than as a position in a list that moved.
   */
  key: string;
  /** Who said it and when — the entry's first line, and the reading's heading. */
  head: string;
  /** The right end of that heading while it is being read: usually the hour of it. */
  meta?: string;
  /** What it says, in the one line the list has for it. */
  line: string;
  /** The whole of what it says, which is what the reader stepped in for. */
  body: string;
  /**
   * What the footer says while this entry is being read whole, in place of the
   * place the reader is standing in. Set by the one kind of entry that can be
   * answered from up here — a letter, which says so — because the gesture that
   * answers it is a gesture no other screen in the app has, and a screen with a
   * verb nobody could guess at owes the reader the sentence (see pages/nearby.ts).
   */
  context?: string;
  /**
   * Where the rest of this entry lives, for the one kind that does not carry its
   * own words: a newswire row is a headline and a link, and the story behind it
   * is a read of its own that nobody pays for until the row is opened.
   *
   * Its presence is what tells the app there is something to fetch — the entry
   * is readable either way, because `body` always has the headline in it (see
   * pages/feed.ts), and this is what turns that into the story.
   */
  link?: string;
}

/**
 * One entry of one page's list, named rather than numbered — which is how the
 * reader's place survives a list rebuilt under them (see pages/list.ts).
 */
export interface ItemRef {
  group: string;
  key: string;
}

export type Block =
  | { kind: "readings"; rows: ReadingRow[] }
  | { kind: "note"; text: string }
  /**
   * A list of entries, of which three are on screen at a time. Which one the
   * reader is on is not held here: it is the screen number the layout is asked
   * for, the same way a page too long for one screenful is asked for its second
   * — one list is one page with as many screenfuls as it has entries.
   */
  | { kind: "items"; items: Item[] }
  /** One thing, read: broken to the width of the body and paged if it runs over. */
  | { kind: "prose"; text: string };

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
   * What this page is called in the path in the corner of the footer — `nearby`,
   * `info`, and nothing at all for the standing page, which is the root of the
   * app rather than a place inside it (see chrome.ts).
   */
  segment: string;
  /**
   * Whether this page is worth drawing where the reader is standing. All three
   * answer true: with only three of them, a page that took itself off the
   * sequence would move the other two under a reader who had learned where they
   * were. What a country cannot feed is a line left off a page, not a page.
   */
  offered(context: PageContext): boolean;
  render(context: PageContext): PageView;
  /**
   * Everything this page is a summary of, one entry at a time, in the order the
   * wheel walks them — which is the order the summary lists its groups in, so a
   * reader who steps into a page finds it laid out the way they just read it.
   *
   * A page without this is a page with nothing behind it: the standing page is
   * five instruments and a count, and there is nothing under any of those to
   * open. A tap on it does nothing, and that is the honest answer rather than an
   * empty list.
   */
  items?(context: PageContext): Item[];
}
