// The shapes lo's server actually answers with. Written out rather than left as
// `Record<string, unknown>` because the cards read these fields by name, and a
// column that silently renders `undefined` is worse than one that will not
// compile — see lo/server/index.js and lo/server/geo.js for the other end of
// each of them.

/** The language lo is read in. One list, shared by the sign-in screen and the glasses. */
export type Language = "en" | "ja" | "zh";

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  /** Only a GPS good enough to claim it answers this; most fixes have no altitude. */
  altitude?: number | null;
  /** Metres a second over the ground, and null unless the device is actually tracking. */
  speed?: number | null;
}

export interface LoUser {
  id: number;
  username: string;
}

/* ------------------------------------------------------------------ place -- */

export interface LoPlace {
  name?: string;
  locality?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  subdivisionCode?: string;
}

/* ---------------------------------------------------------------- weather -- */

export interface LoWeatherDay {
  date?: string;
  weatherCode?: number | null;
  tempMax?: number | null;
  tempMin?: number | null;
  sunrise?: string | null;
  sunset?: string | null;
}

export interface LoWeather {
  timezone?: { id?: string; abbreviation?: string; offsetSeconds?: number };
  /** The height of the ground the forecast was made for — the compass card's fallback. */
  elevation?: number | null;
  current?: {
    time?: string | null;
    temperature?: number | null;
    apparent?: number | null;
    humidity?: number | null;
    weatherCode?: number | null;
    windSpeed?: number | null;
    isDay?: boolean;
  };
  today?: LoWeatherDay | null;
  upcoming?: LoWeatherDay[];
  units?: { temperature?: string; wind?: string };
}

/** What `GET /api/local` answers: where this is, its weather, and what it can feed. */
export interface LoLocal {
  place: LoPlace | null;
  weather: LoWeather | null;
  /** Which of the regional cards this country has an answer for (see lo/server/countries.js). */
  components: string[];
  failed?: string[];
}

/* ------------------------------------------------------------------ feeds -- */

export interface LoFeedItem {
  kind?: string;
  title: string;
  url: string;
  source?: string;
  time?: string | null;
  distance?: number | null;
}

export interface LoFeedResult {
  place?: { name?: string } | null;
  items: LoFeedItem[];
}

/**
 * The words behind one of those headlines, which lo reads off the publisher's
 * page for us. Until this existed a newswire row was a link and nothing else —
 * the glasses could say what had happened and not what was said about it, and
 * the rest was on the phone.
 *
 * `paragraphs` is the story broken the way the publisher broke it, and it stays
 * an array all the way to the screen: everything that measures text in this app
 * collapses whitespace, so a block of prose with blank lines in it arrives as
 * one run of words (see metrics.ts, and prosePanels in layout.ts).
 */
export interface LoArticle {
  id: string;
  /** The publisher's own address, resolved from the feed's opaque one. */
  url: string;
  title: string | null;
  source: string | null;
  published: string | null;
  paragraphs: string[];
  /** The publisher says outright that this is not free to read. */
  paywalled: boolean;
  /** Only the opening came back — a paywall, or a page that would not give more. */
  partial: boolean;
}

export interface LoTrend {
  name: string;
  count?: number | null;
  headline?: string;
  source?: string;
  url?: string;
}

export interface LoTrendsResult {
  /** The subregion Google answered for, or the country it fell back to. */
  name?: string;
  geo?: string;
  items: LoTrend[];
}

/* --------------------------------------------------------------- warnings -- */

export interface LoWarningItem {
  name: string;
  severity: "emergency" | "urgent" | "warning" | "advisory";
  areas?: number | null;
  areaNames?: string[];
  from?: string | null;
  to?: string | null;
}

export interface LoWarningsResult {
  /** Japan only. Elsewhere the card takes itself off rather than claim an all clear. */
  covered: boolean;
  scope?: "municipality" | "region";
  area?: string;
  prefecture?: string;
  issuedAt?: string | null;
  url?: string;
  areaCount?: number;
  items: LoWarningItem[];
}

/* ----------------------------------------------------------- posts, people -- */

export interface LoPost {
  id: number;
  time: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  body: string;
  image?: string | null;
  place?: string | null;
  username: string;
  comments: number;
}

export interface LoPerson {
  username: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  time: string;
}

/* --------------------------------------------------------------- profiles -- */

/**
 * One more way of reaching somebody, past the five lo asks everybody for: the
 * platform it is on and the handle they keep there. lo stores these as a
 * document rather than as a table — written whole, read whole, in the order
 * their owner put them in — so this is read defensively at both ends (see the
 * `links` column in lo/server/db.js).
 */
export interface LoProfileLink {
  kind: string;
  value: string;
}

/**
 * Who somebody is, which is the one question a position cannot answer. A post
 * says where somebody was standing and a fix says they are still out there;
 * neither of them says who they are, and this is what does (see
 * lo/src/components/UserProfile).
 *
 * Every field but the name is optional and most profiles have most of them
 * empty, which is why nothing here is stood in for: a bio nobody wrote is a line
 * the screen leaves out rather than one it fills in on their behalf.
 */
export interface LoProfile {
  username: string;
  /** When the account was opened. lo has stopped drawing it; it answers with it all the same. */
  createdAt?: string | null;
  /** The address of the picture, not the name it is filed under. Nothing draws it up here. */
  avatar?: string | null;
  bio?: string | null;
  email?: string | null;
  website?: string | null;
  /** The LINE ID, which lo's column calls `line_id` and its answer calls this. */
  line?: string | null;
  whatsapp?: string | null;
  wechat?: string | null;
  links?: LoProfileLink[];
}

/**
 * How many read this account, how many it reads, and whether the reader asking
 * is one of the first. One answer rather than three, because they change
 * together and a page that fetched them apart could draw two of them disagreeing.
 */
export interface LoFollows {
  followers: number;
  following: number;
  isFollowing: boolean;
}

/**
 * What `GET /api/users/:username` answers, which is lo's whole profile page in
 * one read: who they are, the two figures, and the last of what they have left
 * on the ground. The glasses want it in one round trip for the same reason they
 * want the dashboard in one.
 */
export interface LoPersonPage {
  user: LoProfile;
  /** Null where lo could not work them out, which the screen reads as a row to leave off. */
  follows: LoFollows | null;
  posts: LoPost[];
}

/* --------------------------------------------------------------- messages -- */

/**
 * One correspondence, as the inbox lists it: who it is with, the last thing said
 * in it, and how much of it has not been read. `mine` is whose line that last one
 * was, which is the difference between a message waiting for an answer and one
 * that is the answer.
 */
export interface LoThread {
  username: string;
  body: string;
  time: string;
  mine: boolean;
  unread: number;
}

/**
 * One line of one exchange, as `GET /api/messages/:username` answers it — which
 * is the request that also marks the exchange read (see lo/server/index.js).
 *
 * The glasses ask for it to say they have read it and take the fresh count off
 * the answer; the lines themselves are the phone's to draw, and the screen up
 * here still shows the last of them rather than the correspondence. The shape is
 * written out all the same, because a return type that named only the field this
 * client happens to use would be a lie about what lo said.
 */
export interface LoMessage {
  id: number;
  body: string;
  time: string;
  /** Which side of the exchange said it. */
  mine: boolean;
  /** Whether the far side has had it in front of them. */
  read: boolean;
}

/* -------------------------------------------------------------- dashboard -- */

/**
 * Everything a screen standing at one spot opens with, in one answer — the read
 * lo added for exactly this client (`POST /api/dashboard`). The regional feeds
 * arrive as bare item lists rather than the `{ place, items }` the one-at-a-time
 * endpoints wrap them in, because a dashboard has no room to name the region each
 * of them answered for.
 */
export interface LoDashboard {
  local: LoLocal;
  nearby: LoFeedItem[];
  events: LoFeedItem[];
  trends: LoTrend[];
  posts: LoPost[];
  people: LoPerson[];
}
