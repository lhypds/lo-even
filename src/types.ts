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

/* ----------------------------------------------------------------- venues -- */

/**
 * Somewhere to eat, or somewhere for a coffee: one row of `GET /api/food` or
 * `GET /api/cafe`, which are the same answer asked about two sets of amenities
 * (see lookupVenues in lo/server/geo.js).
 *
 * They are the two feeds on these pages that stop at no border. Everything else
 * regional is a Google edition or a Japanese institution and has a country list
 * behind it; these come off OpenStreetMap, which is thin in places and present
 * everywhere — so unlike the newswire and the trends there is nothing to ask
 * `components` about before drawing them.
 *
 * `distance` is the one field here that is not OSM's own. lo caches the list
 * around the middle of a ~1 km square and then measures every row from the fix
 * that actually asked, because distance is the thing the rounding would visibly
 * get wrong: a café forty metres away shown as six hundred is not a rounding
 * error to somebody standing outside it.
 */
export interface LoVenue {
  /** `node/123`, `way/456` — OSM numbers its three kinds from one apiece. */
  id: string;
  name: string;
  /** The amenity itself: restaurant, fast_food, food_court, cafe. */
  category?: string | null;
  /** The mappers' own word for the kitchen, which nothing translates. */
  cuisine?: string | null;
  latitude: number;
  longitude: number;
  /** Metres from the fix that asked, nearest first. */
  distance: number;
}

/**
 * What either of those two addresses answers with. `radius` is how far lo
 * actually looked — it widens the ring where a walk turns up nothing — and it is
 * the server's to say rather than the client's to assume.
 */
export interface LoVenuesResult {
  place?: { name?: string } | null;
  radius: number;
  items: LoVenue[];
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

/**
 * One thing said back about a post — lo's own column under a post, in the shape
 * lo answers it in (see `COMMENT_COLUMNS` in lo/server/db.js).
 *
 * There is no `mine` on it, where a line of an exchange has one. lo does not
 * need to say: a comment is read in a column of names under something everybody
 * can see, where a message is read in a sheet with two sides to it. Up here the
 * side matters again — every message this app draws is a name, a colon and the
 * sentence, and the reader's own side says `You` — so it is worked out from the
 * name against the signed-in account rather than taken off the answer.
 */
export interface LoComment {
  id: number;
  body: string;
  time: string;
  username: string;
  avatar?: string | null;
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
 * What every row of the inbox carries whichever kind it is: the last thing said
 * in it, when, and how much of it has not been read. `mine` is whose line that
 * last one was, which is the difference between something waiting for an answer
 * and something that is the answer.
 */
interface LoThreadRow {
  body: string;
  time: string;
  mine: boolean;
  unread: number;
  /**
   * Who said that last line. On a letter it is the correspondent — the exchange
   * has two people in it and this is which of them spoke; on a column it is
   * whoever came past most recently, which is nobody the row is *about*.
   */
  username: string;
}

/**
 * One correspondence, as the inbox lists it: who it is with, and the row above.
 */
export interface LoPersonThread extends LoThreadRow {
  kind?: "person";
}

/**
 * One column of remarks, as the same inbox lists it — the other half of lo's own
 * answer, and the reason `kind` exists at all.
 *
 * A row here is a *post* rather than a person, because that is what the exchange
 * is filed under: a column has as many voices in it as came past, and the one
 * thing all of them are talking about is the post. It is in the reader's inbox
 * because the post is theirs or because they have written under it (see
 * `INVOLVED_POSTS` in lo/server/db.js).
 *
 * `post` is the post's own words and `place` where it was left, which between
 * them are what there is to call it — a photo with no words is named by its
 * ground, exactly as it is everywhere else in this app (see postSays).
 */
export interface LoPostThread extends LoThreadRow {
  kind: "post";
  postId: number;
  post: string;
  place?: string | null;
  image?: string | null;
}

/**
 * One row of the inbox, which is two tables and one list: a word addressed to
 * you and a word left under something you wrote are the same thing to whoever is
 * reading them — somebody said something, and here is where to answer.
 *
 * What tells them apart is `kind`, and what that decides is where a press goes:
 * a person opens the exchange, a post opens its comment column. It is optional on
 * the person half and not on the other, so a row that arrives without one at all
 * is read as the letter this list used to be made entirely of.
 */
export type LoThread = LoPersonThread | LoPostThread;

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
