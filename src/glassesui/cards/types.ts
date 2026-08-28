// What a card is, and the only three shapes it is allowed to come back in.
//
// A card here does exactly what a card does on the website: it reads what is in
// hand and says what it has to say. What it does *not* do is decide where any of
// that lands — no card knows the screen is 576 wide, how many rows fit, or which
// page of itself is being looked at. It hands back a block, the layout turns the
// block into containers, and pagination is the layout's arithmetic (see
// layout.ts). That split is why a list card is a dozen lines here rather than a
// hundred: `posts` says "these items, in this order", and everything about
// making them fit is somebody else's problem.
//
// The three block shapes are lo's own three, read off its stylesheet rather than
// invented: a face (the clock, the weather, the compass — a reading, a word for
// it, and figures under it), a list (everything with rows), and a note (the
// sentence a card puts up when it has nothing, or when the answer never came).

import type {
  Coordinates,
  Language,
  LoFeedResult,
  LoPerson,
  LoPlace,
  LoPost,
  LoTrendsResult,
  LoWarningsResult,
  LoWeather,
} from "../../types";
import type { Translate } from "../strings";

/**
 * Where one feed has got to. Four states rather than a nullable, because lo is
 * careful about exactly this and the glasses have to be as careful: "no posts
 * around here" and "the posts have not arrived yet" are different claims, and a
 * card that prints the first while meaning the second is lying about the street.
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

/** Everything a card is allowed to read. Assembled once per paint (see main.ts). */
export interface CardContext {
  now: Date;
  language: Language;
  locale: string;
  t: Translate;
  coords: Coordinates | null;
  /** When that fix was taken, so a card can say how old it is rather than imply it is now. */
  fixAt: number | null;
  place: LoPlace | null;
  weather: LoWeather | null;
  /** Which regional cards this country can feed — the server's half of the answer. */
  components: string[];
  posts: Feed<LoPost[]>;
  people: Feed<LoPerson[]>;
  nearby: Feed<LoFeedResult>;
  events: Feed<LoFeedResult>;
  trends: Feed<LoTrendsResult>;
  warnings: Feed<LoWarningsResult>;
  heading: HeadingReading;
  /** The signed-in account, so the people card can put you at the top of its list. */
  username: string | null;
}

/** One label-and-value line, which is lo's `<dl>` row. */
export interface FaceRow {
  label: string;
  value: string;
}

/**
 * One row of a list: something small on the left, the thing itself in the middle,
 * something small hard against the right. The three land in three containers of
 * their own, which is what lets the middle be bright and the ends quiet.
 */
export interface ListRow {
  lead?: string;
  title: string;
  trail?: string;
}

export type Block =
  | { kind: "face"; hero: string; caption?: string; rows: FaceRow[] }
  | { kind: "rows"; rows: FaceRow[] }
  | { kind: "list"; rows: ListRow[] }
  | { kind: "note"; text: string };

/** What one card looks like right now — its heading, and one block under it. */
export interface CardView {
  title: string;
  /** The right end of the heading: a count, a place, a range. */
  meta?: string;
  block: Block;
  /**
   * What the footer says while this card is up. The place you are standing in
   * unless the card has something better, which is lo's HereStrip moved to the
   * bottom of the screen — stated once so no card has to repeat it.
   */
  context?: string;
}

export interface CardDefinition {
  /** The server's own word for this feed, so both halves of the question share a vocabulary. */
  id: string;
  /** The card's own heading, by i18n key — never a second name invented for a menu. */
  label: string;
  /**
   * Whether this card is worth drawing where the reader is standing. lo's own
   * cards answer true everywhere; the regional ones ask the components list,
   * because an empty Trends card reads as "nobody here is searching for
   * anything" rather than as "Google does not cover this country".
   */
  offered(context: CardContext): boolean;
  render(context: CardContext): CardView;
}
