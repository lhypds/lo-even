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
