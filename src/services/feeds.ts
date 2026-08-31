// What has been asked for, what came back, and what is not worth asking twice.
//
// The website has one of these per card: each of lo's cards holds its own result,
// its own error and its own "still loading", and re-asks when the fix has moved
// far enough to be a different question. This is that, gathered into one object
// because up here the pages are pure functions and cannot hold anything
// themselves.
//
// **Three reads, and what decides each of them.**
//
//   • `POST /api/dashboard` on every new fix — the place, its weather, which
//     regional feeds the country has, those feeds, the posts within reach and who
//     else is about, in one round trip. lo added that read for a client that
//     cannot afford seven, and the glasses are that client: the first page is a
//     summary of all of it, so there is no such thing here as a feed nobody has
//     scrolled to yet. It files our fix on the way past, the way the position
//     trade does.
//   • `GET /api/warnings` on every new fix as well, because it is not in that
//     answer and it is a line of the opening page. A warning nobody scrolled far
//     enough to see is a warning that was not issued.
//   • `GET /api/cafe` and `GET /api/food` on a new fix too, and for the same
//     reason: lo added the dashboard read before either of those cards existed,
//     so the two of them are the other thing about the ground that has to be
//     asked for on its own. They are started rather than waited on — Overpass
//     queues its callers and has twenty seconds to answer — and keyed the
//     coarsest of anything here, because tomorrow's list of restaurants is
//     today's and what changes it is the reader walking (see `readVenues`).
//   • `GET /api/messages` while the reader is actually on the page that shows
//     them, and at most once a minute — see the key below.
//   • `GET /api/messages/:username` once the reader has been sitting on one
//     letter for three seconds, because asking for an exchange is what marks it
//     read and there is no other way to say so (see `seen`). It is the one read
//     here that is really a write, and the only one a clock starts.
//   • `GET /api/users/:username` once the reader has opened one of the names on
//     the street: who they are, the two follow figures and the last of what they
//     have left on the ground, which is lo's whole profile page in one answer.
//     Made on the way in rather than on a clock, because unlike the letter above
//     it files nothing — and made for that one name rather than for everybody
//     about, because a street the reader is walking past is four profiles a
//     minute nobody asked for.
//   • `GET /api/posts/:postId/comments` once the reader has stopped on one post
//     for three seconds: what was said back about it, which is the other half of
//     what a passer-by finds on the ground. It is behind the same clock as the
//     exchange above and for the same reason — asking for a column is what tells lo
//     it has been read — and it has one saving neither of them has: a post on the
//     street arrives with the number of remarks on it, so a post nobody has
//     answered is a read this never makes (see `discuss`).
//
// And two on the minute beat, neither of which asks lo to look anything up
// elsewhere: `PUT /api/position`, which files where we are and takes back
// everyone else's and the unread count, and `GET /api/posts`, because what is
// written on the ground here is the one thing on these pages that changes while
// the reader stands still.
//
// **And most of them are not made at all.** The site in the frame is a second
// client of the same server on the same phone, and it asks it nearly all of the
// same questions to draw its own dashboard: the place, the sky, the newswire,
// what is on, the trends, where to eat, where the coffee is, what is worth
// reading nearby, what is in force, what is on the ground here and who else is
// standing on it. Every answer it lands it posts up over the frame (see `shared`
// in lo/src/api.js), and `offer` below files it under the very key the read that
// would have fetched it carries — so `fill` finds the question answered and the
// request is simply never made. What the site does not send, because it is
// addressed to the reader rather than to the ground, is the inbox and everything
// behind it: those stay this file's own reads.
//
// It is an offer and never an instruction. A feed this build has no slot for, an
// answer about ground too far off, one looked up in a language the glasses are
// not being read in, or a site whose reader has simply not put that panel on
// their dashboard — every one of those falls through to the read below, made
// exactly as it always was.
//
// **How coarse a question is.** A fix jitters by metres while a hand is still,
// and re-asking on every jitter would be the same question over and over — so
// each feed is keyed as coarsely as its answer actually is, in place *and* in
// time. The roundings are lo's own: three decimals (~110 m) for the dashboard and
// the posts, which are about the street, and two (~1.1 km) for the warnings,
// which Yahoo answers per municipality. The stretches of time are below.

import type {
  Coordinates,
  Language,
  LoArticle,
  LoComment,
  LoDashboard,
  LoFeedItem,
  LoLocal,
  LoMessage,
  LoPerson,
  LoPersonPage,
  LoPost,
  LoThread,
  LoTrend,
  LoVenue,
  LoWarningsResult,
  LoWikiPlace,
  NavPoint,
} from "../types";
import type { Feed } from "../glassesui/pages/types";
import type { LoApi } from "./api";
import { fetchRoads } from "./roads";
import { fetchRoute } from "./route";

type Status = Feed<unknown>["status"];

interface Slot<T> {
  status: Status;
  data: T | null;
  /** The question this answer was to. A different key is a different question. */
  key: string;
  /** Which request is the live one, so a slow answer cannot overwrite a fast newer one. */
  ticket: number;
}

function slot<T>(): Slot<T> {
  return { status: "idle", data: null, key: "", ticket: 0 };
}

function view<T>(from: Slot<T>): Feed<T> {
  return { status: from.status, data: from.data };
}

/** One part of the dashboard's answer, wearing the whole answer's status. */
function part<K extends keyof LoDashboard>(from: Slot<LoDashboard>, key: K): Feed<LoDashboard[K]> {
  return { status: from.status, data: from.data ? from.data[key] : null };
}

function round(coords: Coordinates, places: number): string {
  return `${coords.latitude.toFixed(places)},${coords.longitude.toFixed(places)}`;
}

const EARTH_RADIUS_M = 6_371_000;
const VENUE_MOVED_M = 100;

function distanceMeters(from: Coordinates, to: Coordinates): number {
  const radians = Math.PI / 180;
  const lat1 = from.latitude * radians;
  const lat2 = to.latitude * radians;
  const deltaLat = (to.latitude - from.latitude) * radians;
  const deltaLon = (to.longitude - from.longitude) * radians;
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// How long an answer stands before the same question is worth asking again.
//
// A key that is only a place is a question that is never asked twice while the
// reader stands still, which is right for a fix that jitters by metres and wrong
// for everything else: a post deleted on the phone, a warning lifted, a
// temperature that has moved on. So every key carries the stretch of time it
// belongs to as well, and each is as long as its answer actually keeps.
//
// The posts are the shortest because they are the only thing here a person
// changes by hand, and the cheapest — one database read, where the dashboard is
// four upstream lookups behind it.
const POSTS_MS = 60_000;
const INBOX_MS = 60_000;
const WARNINGS_MS = 5 * 60_000;
const DASHBOARD_MS = 10 * 60_000;

// How many stories are kept at once. Not a stretch of time like the rest of
// this: a published story is the same story tomorrow, so what bounds this is the
// reader's afternoon rather than the answer going stale. Twenty is the length of
// lo's own newswire — a whole page's worth read end to end, which nobody does.
const ARTICLES_KEPT = 20;

// And how many exchanges. Fewer, because there are fewer to have: lo draws at
// most fifty correspondents in an inbox and an afternoon on the glasses opens a
// handful of them. Same bound for the same reason as the stories — this store
// grows with what the reader has done rather than with where they are standing.
const THREADS_KEPT = 10;

// And how many profiles. The same bound as the exchanges and for the same
// reason: this store grows with which of the names on the street the reader has
// stopped on, and a street rarely has ten.
const PROFILES_KEPT = 10;

// How long one of them stands before it is worth asking again. Longer than
// anything about the ground: a bio changes about never and the two figures about
// as often, and what does move underneath is the handful of recent posts. Five
// minutes in front of one profile is a long way past what this screen is for.
const PROFILE_MS = 5 * 60_000;

// And how many columns of remarks. The same bound as the exchanges and the
// profiles, for the third time and the same reason: this store grows with which
// of the posts on a street the reader has opened rather than with the street.
const COMMENTS_KEPT = 10;

// A column under a post is re-asked on the same beat as the inbox and the posts
// themselves, because it changes for the same reason all three of those do: a
// person somewhere else typing. It is also the beat a reader's own remark comes
// back on, where they left one and the key below has been dropped.
const COMMENTS_MS = 60_000;

// And how many routes. The same bound as the profiles, the exchanges and the
// columns, for the fourth time and the same reason: this store grows with which
// doors the reader has opened rather than with where they are standing.
const ROUTES_KEPT = 10;

// A route is re-asked when its origin has moved this many rounding steps —
// which is to say when the reader has walked about a street's width. There is
// no stretch of time on it: streets do not move, the destination does not
// either, and the live dot on the map is drawn from the fix rather than from
// this answer, so a route asked a hundred metres ago still shows the walk.
const ROUTE_ORIGIN_DECIMALS = 3;

/** The stretch of time an answer belongs to, which is the rest of every key. */
function within(every: number): string {
  return String(Math.floor(Date.now() / every));
}

/**
 * The slot for one thing the reader has opened, made where this is the first
 * time they have opened it.
 *
 * There are three of these stores now — the stories, the exchanges and the
 * profiles — and all three are bounded for the same reason: they grow with what
 * the reader has done rather than with where they are standing, so an afternoon
 * spent walking and reading would otherwise keep the whole afternoon alive. The
 * oldest goes, which on a Map is its first key.
 */
function keyed<T>(store: Map<string, Slot<T>>, key: string, kept: number): Slot<T> {
  const found = store.get(key);
  if (found) return found;
  if (store.size >= kept) {
    const oldest = store.keys().next();
    if (!oldest.done) store.delete(oldest.value);
  }
  const made = slot<T>();
  store.set(key, made);
  return made;
}

export class Feeds {
  private readonly api: LoApi;
  private readonly changed: () => void;

  private dashSlot = slot<LoDashboard>();
  // The four things the dashboard read is the only source of here, each with a
  // slot of its own — filled by nothing this file asks for, and only ever by an
  // answer the site in the frame has already had (see `offer`). Each stands in
  // front of the dashboard's copy the way the posts and the people below do, and
  // between them they are what decides whether that read is worth making at all
  // (see `dashGiven`).
  private localSlot = slot<LoLocal>();
  private newsSlot = slot<LoFeedItem[]>();
  private eventsSlot = slot<LoFeedItem[]>();
  private trendsSlot = slot<LoTrend[]>();
  // The question those four are being kept against: the dashboard key of the fix
  // this store is working on. A given part is taken only while it answers this
  // one, and stands only until it does not — which is the whole of what keeps a
  // free answer from outranking a fresher bought one (see `standDown`).
  private dashAsking = "";
  private postsSlot = slot<LoPost[]>();
  private warningsSlot = slot<LoWarningsResult>();
  private inboxSlot = slot<LoThread[]>();
  private peopleSlot = slot<LoPerson[]>();
  // Somewhere to eat and somewhere for a coffee, which are two slots rather than
  // one for the reason lo answers them at two addresses: they are two questions,
  // asked at different hours, and a reader looking for one of them is not looking
  // for the other.
  private cafeSlot = slot<LoVenue[]>();
  private foodSlot = slot<LoVenue[]>();
  // Nearby Wikipedia articles, a third read of the same ground and on the same
  // coarse key as the two above — an article does not move and its lead
  // paragraph does not change by the hour, so what makes it a new question is
  // the reader having walked somewhere rather than time passing (see
  // `readVenues`, which now starts this alongside the other two).
  private wikiSlot = slot<LoWikiPlace[]>();
  // Café, food and Wikipedia share one exact movement anchor. A rounded grid can
  // flip after a metre when somebody is standing beside its boundary, while a
  // time bucket re-asks even if they have not moved at all. Neither describes
  // these lists; more than 100 metres from the last requested fix does.
  private venueAnchor: Coordinates | null = null;
  private venueLanguage: Language | null = null;
  // One per exchange the reader has opened, keyed by the correspondent — the same
  // shape as the stories above and for the same reason: there is no telling in
  // advance which of a list they will open, and each of them is worth keeping once
  // it has been paid for. The one round trip behind these is also what tells lo
  // the letter has been read (see `seen`).
  private threadSlots = new Map<string, Slot<LoMessage[]>>();
  // One per person the reader has stopped on, keyed by their name. The same
  // shape again, and the same reason a third time: there is no telling in advance
  // which of the names on a street they will open, and lo must not be asked about
  // the ones they do not.
  private profileSlots = new Map<string, Slot<LoPersonPage>>();
  // One per post the reader has opened, keyed by its id as a string — which is
  // how the entry on the list is keyed, so the two never have to be converted
  // into one another anywhere but here (see pages/nearby.ts).
  private commentSlots = new Map<string, Slot<LoComment[]>>();
  // One per story the reader has opened, keyed by the link that opened it.
  // A Map rather than a field because there is no telling in advance which of a
  // list they will read, and insertion order is what makes the cap above a
  // sensible one to enforce.
  private articleSlots = new Map<string, Slot<LoArticle>>();
  // One per venue the reader has opened, keyed by the venue's id — the streets
  // between them and that one door, off a public router rather than off lo (see
  // services/route.ts). The same shape as the four stores above and bounded for
  // their common reason.
  private routeSlots = new Map<string, Slot<NavPoint[]>>();
  // And the streets around that walk, for the same map to draw the route over —
  // off public vector tiles rather than off the router, because the two answer
  // different questions of different upstreams and either can arrive without
  // the other (see services/roads.ts). Same key, same bound, same reason.
  private roadSlots = new Map<string, Slot<NavPoint[][]>>();
  private unreadCount = 0;

  constructor(api: LoApi, changed: () => void) {
    this.api = api;
    this.changed = changed;
  }

  /**
   * The place, the sky and what this country can feed, from whichever of the two
   * has them: the site's own answer where it has handed one over, and the
   * dashboard's copy otherwise. The same preference the posts and the people are
   * read under, and it is written once here because three getters share it.
   */
  private localData(): LoLocal | null {
    return this.localSlot.status === "idle" ? this.dashSlot.data?.local ?? null : this.localSlot.data;
  }

  get place() {
    return this.localData()?.place ?? null;
  }
  get weather() {
    return this.localData()?.weather ?? null;
  }
  /** Which regional feeds the country the reader is standing in has. */
  get components(): string[] {
    return this.localData()?.components ?? [];
  }

  /**
   * What is on the ground here. The dashboard answers this too, but the minute
   * beat keeps a fresher list than the fix does — so the beat's wins wherever it
   * has landed, and the dashboard's stands in until it has.
   */
  get posts(): Feed<LoPost[]> {
    return this.postsSlot.status === "idle" ? part(this.dashSlot, "posts") : view(this.postsSlot);
  }
  get news(): Feed<LoFeedItem[]> {
    return this.newsSlot.status === "idle" ? part(this.dashSlot, "nearby") : view(this.newsSlot);
  }
  get events(): Feed<LoFeedItem[]> {
    return this.eventsSlot.status === "idle" ? part(this.dashSlot, "events") : view(this.eventsSlot);
  }
  get trends(): Feed<LoTrend[]> {
    return this.trendsSlot.status === "idle" ? part(this.dashSlot, "trends") : view(this.trendsSlot);
  }

  /**
   * The two that are not part of the dashboard's answer and are about the ground
   * all the same: `POST /api/dashboard` was built before these two cards existed
   * and does not carry them, so they are reads of their own on the coarsest key
   * in this file (see `readVenues`).
   */
  get cafe(): Feed<LoVenue[]> {
    return view(this.cafeSlot);
  }
  get food(): Feed<LoVenue[]> {
    return view(this.foodSlot);
  }
  get wikipedia(): Feed<LoWikiPlace[]> {
    return view(this.wikiSlot);
  }

  /**
   * Who else is out. The dashboard answers this too, but the minute beat keeps a
   * fresher list than the fix does — so the traded one wins wherever it has
   * landed, and the dashboard's stands in until it has.
   */
  get people(): Feed<LoPerson[]> {
    return this.peopleSlot.status === "idle" ? part(this.dashSlot, "people") : view(this.peopleSlot);
  }

  get warnings(): Feed<LoWarningsResult> {
    return view(this.warningsSlot);
  }
  get messages(): Feed<LoThread[]> {
    return view(this.inboxSlot);
  }

  /**
   * The words behind one headline, if they have been asked for. A pure read: it
   * never starts anything, so the page that builds a list may call it for every
   * row it draws without any of them turning into a request.
   *
   * A slot that does not exist yet and one that is idle are the same answer,
   * which is what lets the reading screen say "still coming" without having to
   * know which of the two it is looking at.
   */
  article(link: string): Feed<LoArticle> {
    const found = this.articleSlots.get(link);
    return found ? view(found) : { status: "idle", data: null };
  }

  /**
   * The reader has actually opened one. The only read in this file that is not
   * about where anybody is standing, and the only one keyed by a thing rather
   * than by a place and a stretch of time — a story that has been published does
   * not change, so once it is here it is never asked for again.
   *
   * Called from the paint, like the inbox, and for the same reason: the entry in
   * front of the reader is the one worth paying for. A list of twenty headlines
   * is nineteen stories nobody will open, and lo reads none of them until asked
   * (see lo/server/articles.js) — so this is the request that decides.
   */
  read(link: string, hints: { title?: string; source?: string; kind?: string }): void {
    // Bounded, because this store grows with what the reader has done rather than
    // with where they are standing: an afternoon spent walking and reading the
    // wire would otherwise keep every story of the day alive (see `keyed`).
    const target = keyed(this.articleSlots, link, ARTICLES_KEPT);
    void this.fill(target, link, () => this.api.article(link, hints));
  }
  /** How much is waiting to be read, which rides in on the presence trade. */
  get unread(): number {
    return this.unreadCount;
  }

  /**
   * Everything is a stale answer to a question about somewhere else now. Not
   * cleared, though — the old reading stays on screen until the new one lands,
   * because a page that empties itself on every step of a walk is a page nobody
   * can read while walking. The keys are what actually change, and they are what
   * makes the next read re-ask.
   */
  forget(): void {
    const all: Slot<unknown>[] = [
      this.dashSlot,
      this.localSlot,
      this.newsSlot,
      this.eventsSlot,
      this.trendsSlot,
      this.postsSlot,
      this.warningsSlot,
      this.inboxSlot,
      this.cafeSlot,
      this.foodSlot,
      this.wikiSlot,
    ];
    // The four given ones included. An answer the site looked up in the language
    // this reader has just left is exactly the stale answer this is about, and a
    // key left standing would let it go on saving a read it has no business
    // saving; `standDown` takes it off the page on the next fix.
    for (const each of all) {
      each.key = "";
    }
  }

  /* ------------------------------------------------------------- the keys -- */

  // Each written once, because two things compute them now: the reads below, and
  // the answers that arrive from the frame already made (see `offer`). A given
  // answer only saves a request if it is filed under exactly the key that request
  // would have carried, so these two must not be able to drift apart.

  private dashKey(coords: Coordinates, language: string): string {
    return `${round(coords, 3)}:${language}:${within(DASHBOARD_MS)}`;
  }
  private postsKey(coords: Coordinates, language: string): string {
    return `${round(coords, 3)}:${language}:${within(POSTS_MS)}`;
  }
  private warningsKey(coords: Coordinates): string {
    return `${round(coords, 2)}:${within(WARNINGS_MS)}`;
  }
  private peopleKey(): string {
    return within(POSTS_MS);
  }

  /**
   * The key the three venue reads stand on, for an answer about `coords` — or
   * null where that ground is too far from this store's anchor to be an answer to
   * the same question.
   *
   * The anchor does not move to meet it. Café, food and Wikipedia share one key,
   * and shifting it because one of the three arrived would change the question
   * the other two have already been answered for — two reads spent to save one.
   * Nor is one adopted before this store has stood anywhere: a launch asks within
   * the second, and an answer that arrives ahead of that is one saving missed
   * rather than a reason to let a message decide where we are standing.
   */
  private venueKeyFor(coords: Coordinates, language: string): string | null {
    const anchor = this.venueAnchor;
    if (!anchor || this.venueLanguage !== language) return null;
    if (distanceMeters(anchor, coords) > VENUE_MOVED_M) return null;
    return `${anchor.latitude},${anchor.longitude}:${language}`;
  }

  /* ------------------------------------------------ answers already in hand -- */

  /**
   * One answer the site in the frame has just had from lo, put where the read
   * this store would have made was going to put it.
   *
   * The two of them are clients of one server on one phone and they ask it most
   * of the same questions, so the site landing an answer is this store's question
   * answered as well — the whole of what makes it one is that it goes in under
   * the key the request carries. `fill` then finds the question answered and does
   * nothing, which is the request saved. Anything this build has no slot for, or
   * that is about ground too far off, or that was looked up in a language the
   * glasses are not being read in, falls through and is asked for as it always
   * was: what arrives here is an offer, never an instruction.
   *
   * The language does most of that work by itself, because it is part of every
   * key that has one. The two that have none — what is in force, and who else is
   * about — are answers in no language at all, so a site being read in French
   * still saves the glasses both of those.
   */
  offer(feed: string, coords: Coordinates | null, language: string, data: unknown): void {
    if (!data || typeof data !== "object") return;
    const rows = <T>(): T[] => {
      const list = (data as { items?: unknown }).items;
      return Array.isArray(list) ? (list as T[]) : [];
    };
    switch (feed) {
      case "local":
        if (coords) this.givePart(this.localSlot, this.dashKey(coords, language), data as LoLocal);
        break;
      case "nearby":
        if (coords) this.givePart(this.newsSlot, this.dashKey(coords, language), rows<LoFeedItem>());
        break;
      case "events":
        if (coords) this.givePart(this.eventsSlot, this.dashKey(coords, language), rows<LoFeedItem>());
        break;
      case "trends":
        if (coords) this.givePart(this.trendsSlot, this.dashKey(coords, language), rows<LoTrend>());
        break;
      case "posts": {
        const posts = (data as { posts?: unknown }).posts;
        if (coords && Array.isArray(posts)) {
          this.give(this.postsSlot, this.postsKey(coords, language), posts as LoPost[]);
        }
        break;
      }
      case "people": {
        // The one that carries something besides its own list: how much is
        // waiting to be read rides in on the presence trade at both ends of the
        // frame, which is why the badge in the corner keeps itself current
        // without a read of its own (see `unread`).
        const answer = data as { people?: unknown; unread?: unknown };
        if (typeof answer.unread === "number") this.unreadCount = answer.unread;
        if (Array.isArray(answer.people)) {
          this.give(this.peopleSlot, this.peopleKey(), answer.people as LoPerson[]);
        }
        break;
      }
      case "warnings":
        if (coords) this.give(this.warningsSlot, this.warningsKey(coords), data as LoWarningsResult);
        break;
      case "cafe":
        if (coords) this.give(this.cafeSlot, this.venueKeyFor(coords, language), rows<LoVenue>());
        break;
      case "food":
        if (coords) this.give(this.foodSlot, this.venueKeyFor(coords, language), rows<LoVenue>());
        break;
      case "wikipedia":
        if (coords) this.give(this.wikiSlot, this.venueKeyFor(coords, language), rows<LoWikiPlace>());
        break;
      default:
        // A feed this build has no slot for. The site and this package are
        // shipped apart and one of the two is always the newer of them.
        break;
    }
  }

  /**
   * One of the four the dashboard would otherwise answer, taken only while it is
   * an answer to the question this store is actually asking.
   *
   * These four are the only slots read through a preference — the given copy in
   * front of the dashboard's — so they are the only ones where a stale answer
   * could outrank a fresher one instead of merely being replaced by it. A launch
   * before the first fix has no question yet and takes none of them; the first
   * beat is a second away.
   */
  private givePart<T>(target: Slot<T>, key: string, data: T): void {
    if (key !== this.dashAsking) return;
    this.give(target, key, data);
  }

  /**
   * An answer that cost nothing, put in the slot the asking would have filled.
   *
   * The ticket is bumped as though this were a read of our own, because it may be
   * racing one: a request already in flight for this slot must not land on top of
   * an answer that arrived while it was out. A null key is an answer that turned
   * out not to fit the question this store is asking, and is dropped.
   */
  private give<T>(target: Slot<T>, key: string | null, data: T): void {
    if (key === null) return;
    target.ticket += 1;
    target.key = key;
    target.status = "ready";
    target.data = data;
    this.changed();
  }

  private async fill<T>(
    target: Slot<T>,
    key: string,
    load: () => Promise<T>,
    // The people slot is refreshed on a timer rather than by a moved fix, and a
    // timer that flipped it back to "loading" every minute would flicker the
    // waiting state under a list that is already on screen.
    quiet = false,
  ): Promise<void> {
    if (target.key === key && (target.status === "loading" || target.status === "ready")) return;
    const ticket = ++target.ticket;
    target.key = key;
    if (!quiet || target.status === "idle") target.status = "loading";
    this.changed();
    try {
      const data = await load();
      if (ticket !== target.ticket) return;
      target.status = "ready";
      target.data = data;
    } catch (error) {
      if (ticket !== target.ticket) return;
      target.status = "failed";
      console.error("lo could not answer", error);
    }
    this.changed();
  }

  /**
   * The two reads a new fix is worth, and the two it starts without waiting for.
   * Called on every one; the keys decide whether any of them is actually a new
   * question.
   */
  async here(coords: Coordinates, language: Language): Promise<void> {
    // Somewhere to eat and somewhere for a coffee, started here and deliberately
    // not waited on. Overpass is a public instance that queues its callers and is
    // given twenty seconds to answer (see lo/server/geo.js), and what waits on the
    // promise below is the fix's own errand — telling the page in view to re-ask
    // (see `refresh` in main.ts). A cold square would hold that up for the better
    // part of half a minute in exchange for two lines at the foot of one page.
    // Both answer through `changed` like everything else here, so the lines
    // appear underneath a page the reader is already reading.
    this.readVenues(coords, language);
    const dash = this.dashKey(coords, language);
    this.dashAsking = dash;
    this.standDown();
    await Promise.all([
      // Not made at all where the site has already handed over everything this
      // read is the only source of (see `dashGiven`).
      this.dashGiven(dash) ? Promise.resolve() : this.fill(this.dashSlot, dash, () => this.api.dashboard(coords)),
      // Not asked for outside Japan, where Yahoo has nothing to say and the
      // answer would be an all clear nobody checked.
      this.fill(this.warningsSlot, this.warningsKey(coords), () => this.api.warnings(coords)),
    ]);
  }

  /**
   * Whether the dashboard has anything left to answer.
   *
   * It carries six things and four of them come from nowhere else here: the
   * place, the newswire, what is on and what is trending. The other two — the
   * posts and the people — are re-read on the minute beat, which keeps a fresher
   * copy than a fix does and is already preferred over this one, so a dashboard
   * not asked for costs them nothing. On a launch the beat follows within the
   * same turn (see `runBeat` in main.ts).
   *
   * Which makes this true rarely rather than never, and that is the site's doing
   * rather than a shortcoming here: lo's own dashboard opens as a block of
   * squares, and the newswire, what is on and the trends are panels the reader
   * adds to it (see `CARDS` in lo/src/utils/cards.js). A phone showing none of
   * them hands over the place alone, and this read is made exactly as it was —
   * one round trip that answers four questions still beats three that answer
   * three.
   *
   * It also files our fix on the way past, and skipping it loses nothing there
   * either: what the site handed over is what it got back from the same trade,
   * made against the same account a moment earlier.
   */
  private dashGiven(key: string): boolean {
    return this.givenParts().every((each) => each.status === "ready" && each.key === key);
  }

  /** The four the site can answer for this read, and nothing else fills. */
  private givenParts(): Slot<unknown>[] {
    return [this.localSlot, this.newsSlot, this.eventsSlot, this.trendsSlot];
  }

  /**
   * Given parts that turn out to be answers to some other question, dropped.
   *
   * The site re-reads the place on a coarser step than this store asks about it —
   * about a kilometre against a hundred metres (see `coordKey` in
   * lo/src/utils/location.js) — so a reader walking a long street can leave a
   * given answer standing in front of a dashboard that has since been asked about
   * the ground actually under them. Standing in front of it is the point of these
   * slots, but not there: preferring that one would be preferring the older of
   * two answers because it happened to be free.
   *
   * So a part stands down as the question moves on, and the dashboard's own copy
   * shows through until the site has caught up and offered another.
   */
  private standDown(): void {
    for (const each of this.givenParts()) {
      if (each.status === "idle" || each.key === this.dashAsking) continue;
      each.status = "idle";
      each.data = null;
      each.key = "";
    }
  }

  /**
   * The minute beat: file where we are, take back everyone else's position and
   * the unread count, and re-read what is on the ground. Two reads, neither of
   * which touches anything upstream of lo.
   */
  async beat(coords: Coordinates, language: Language): Promise<void> {
    await Promise.all([
      this.fill(
        this.peopleSlot,
        this.peopleKey(),
        async () => {
          const answer = await this.api.publishPosition(coords);
          this.unreadCount = answer.unread ?? 0;
          return answer.people;
        },
        true,
      ),
      this.readPosts(coords, language),
    ]);
  }

  /**
   * The reader has just left a post on the ground here. The minute this happened
   * in has an answer already and that answer is now wrong by exactly one post —
   * the reader's own — so the key is dropped and the read made again rather than
   * left to come right on the next beat. It is the one moment these pages know
   * they are stale without being told by a clock.
   *
   * Only the posts: nothing else on any page changed, and re-asking the dashboard
   * would spend four upstream lookups on a fact this client already has.
   */
  wrote(coords: Coordinates, language: Language): Promise<void> {
    this.postsSlot.key = "";
    return this.readPosts(coords, language);
  }

  /**
   * Where to eat, where to sit down with a coffee, and what is worth reading
   * nearby. One key for all three, because they are one question about the
   * ground asked three ways. Their shared anchor moves only after the reader has
   * moved more than 100 metres; standing still has no time-based refresh.
   *
   * Quietly, for the reason the posts and the people are: this is re-asked when
   * the reader has walked a square's width, and a slot flipping back to "looking
   * for somewhere for coffee" would replace a readable list with a word about
   * itself under somebody who is reading it. The first read of all still says so
   * — an idle slot has nothing to replace.
   */
  private readVenues(coords: Coordinates, language: Language): void {
    const moved = this.venueAnchor ? distanceMeters(this.venueAnchor, coords) : Infinity;
    if (!this.venueAnchor || this.venueLanguage !== language || moved > VENUE_MOVED_M) {
      this.venueAnchor = { ...coords };
      this.venueLanguage = language;
    }
    const anchor = this.venueAnchor;
    const key = `${anchor.latitude},${anchor.longitude}:${language}`;
    void this.fill(this.cafeSlot, key, () => this.api.cafes(anchor).then((answer) => answer.items), true);
    void this.fill(this.foodSlot, key, () => this.api.food(anchor).then((answer) => answer.items), true);
    void this.fill(this.wikiSlot, key, () => this.api.wikipedia(anchor).then((answer) => answer.items), true);
  }

  /** What is on the ground here, asked for as coarsely as the answer keeps. */
  private readPosts(coords: Coordinates, language: Language): Promise<void> {
    return this.fill(
      this.postsSlot,
      this.postsKey(coords, language),
      () => this.api.posts(coords).then((answer) => answer.posts),
      true,
    );
  }

  /**
   * The reader is looking at the page that shows the inbox. Keyed on the minute
   * rather than on where we are standing, because who has written has nothing to
   * do with the street — and because this is called on every paint of that page.
   */
  inbox(): void {
    void this.fill(
      this.inboxSlot,
      String(Math.floor(Date.now() / INBOX_MS)),
      async () => {
        const answer = await this.api.messages();
        this.unreadCount = answer.unread ?? this.unreadCount;
        return answer.conversations;
      },
      true,
    );
  }

  /**
   * One whole exchange, if it has been asked for. A pure read, like `article`
   * above: the page behind a letter calls it while drawing and must not be able to
   * start anything by doing so — more sharply here than there, because the request
   * that would start is the one that tells lo the letter has been read.
   */
  thread(username: string): Feed<LoMessage[]> {
    const found = this.threadSlots.get(username);
    return found ? view(found) : { status: "idle", data: null };
  }

  /**
   * This letter has been in front of the reader long enough to count as read, and
   * lo is told so. The request that tells it is the one that fetches the exchange
   * — lo has no other and wants none, because a conversation somebody has been
   * shown is one they have seen (see api.ts) — so one round trip both says the
   * letter was read and brings back what the screen behind it draws.
   *
   * Keyed on the minute as well as the name, so a letter left open across one is
   * asked again and picks up whatever arrived in it. Everything commoner than that
   * — every repaint of the clock, every feed landing underneath — finds the key
   * unchanged and costs nothing.
   */
  seen(username: string): void {
    // Bounded, like the stories, and for the same reason: this store grows with
    // what the reader has opened rather than with where they are standing, and an
    // exchange is two hundred lines at its longest (see `keyed`).
    const target = keyed(this.threadSlots, username, THREADS_KEPT);
    void this.fill(
      target,
      `${username}:${within(INBOX_MS)}`,
      async () => {
        const answer = await this.api.conversation(username);
        this.unreadCount = answer.unread ?? this.unreadCount;
        // The inbox is now wrong by one dot — it was read before this letter was,
        // and it is what draws the disc beside this correspondent's name on both
        // screens that list them. Dropped rather than patched, so the next paint
        // asks lo instead of this client deciding what lo would have said. It is
        // the same move `wrote` makes for a post, for the same reason.
        this.inboxSlot.key = "";
        return answer.messages;
      },
      // Quietly: the screen already has the last line of this exchange on it and
      // is showing it, so a slot flipping to "loading" would be this errand
      // replacing something readable with a word about itself.
      true,
    );
  }

  /**
   * The reader has just answered one. Two things are now a version behind: the
   * inbox, whose last line for that correspondent is the reader's own now, and the
   * exchange itself, which is the screen they are looking at. Both keys go, so the
   * next paint asks again — exactly as the posts are re-asked after one is left on
   * the ground, and for the same reason. A reader who said something into a letter
   * and did not then see it in the letter would have every reason to think it was
   * never sent.
   */
  replied(username: string): void {
    this.inboxSlot.key = "";
    const thread = this.threadSlots.get(username);
    if (thread) thread.key = "";
    // And asked again now rather than left to the three seconds the reader would
    // have to sit through on the way back to the letter. It marks the exchange
    // read a second time on the way past, which it already was — a reader who
    // answered a letter has plainly read it.
    this.seen(username);
  }

  /**
   * Who one of the names on the street is, if it has been asked for. A pure read,
   * like `article` and `thread` above and for the first of their two reasons: the
   * page behind a name is rebuilt on every paint, and it must be able to ask this
   * of whoever the reader has open without the drawing itself being the request.
   */
  profile(username: string): Feed<LoPersonPage> {
    const found = this.profileSlots.get(username);
    return found ? view(found) : { status: "idle", data: null };
  }

  /**
   * The reader has stopped on one of the dots. A name off the presence trade is
   * an hour and a distance and nothing else; this is the read that says who it
   * belongs to, and it is made only once they have opened that one name — a page
   * that asked for everybody about would be lo answering four profiles a minute
   * for a street the reader is walking past.
   *
   * Unlike the exchange above, it is a read and only a read: lo files nothing
   * when a profile is fetched, so there is no clock in front of this one. The
   * request goes the moment the screen is open.
   */
  meet(username: string): void {
    void this.fill(
      keyed(this.profileSlots, username, PROFILES_KEPT),
      `${username}:${within(PROFILE_MS)}`,
      () => this.api.profile(username),
    );
  }

  /**
   * What was said back about one post, if it has been asked for. A pure read,
   * like `article`, `thread` and `profile` above and for their common reason: the
   * page behind a post is rebuilt on every paint, and drawing a list of them must
   * not be the thing that asks lo about any of them.
   */
  comments(postId: string): Feed<LoComment[]> {
    const found = this.commentSlots.get(postId);
    return found ? view(found) : { status: "idle", data: null };
  }

  /**
   * The reader has opened one post — either one on the street, or one of the
   * columns waiting in the inbox. What was said back about it is the other half of
   * what somebody coming past finds on the ground, and it is one read rather than
   * part of the answer that listed the post: lo answers a column per post, and a
   * street with twenty posts on it is twenty reads nobody asked for.
   *
   * **A post on the street with nothing under it costs nothing.** The count rides
   * in on the post itself, which is the one thing that separates this from the
   * three reads above: they have to ask before they know whether there is anything
   * to have, and this has already been told. So the commonest post on lo — one
   * nobody has answered — is opened without lo being asked anything at all, and the
   * screen behind it says "hold to reply" straight away rather than waiting on an
   * answer that would come back empty.
   *
   * A post the street has never heard of is one the *inbox* is asking about, and
   * the inbox lists no column that is empty — a thread with no lines in it is not a
   * thread yet (see `INVOLVED_POSTS` in lo/server/db.js). So the guard is written
   * as "this post, and lo said nothing is under it" rather than as "a post I can
   * find": not finding it is not the same as knowing there is nothing there.
   */
  discuss(postId: string): void {
    const post = (this.posts.data ?? []).find((each) => String(each.id) === postId);
    if (post && post.comments === 0) return;
    this.readColumn(postId);
  }

  /**
   * The reader has just said something under one. Two things are a version behind
   * — the column, which is the screen they are looking at, and the post's own count
   * of it, which is what decides whether that column is ever asked for at all.
   *
   * The first is re-asked here and the second by the posts being re-read, which is
   * the caller's errand because it is the one that knows where we are standing
   * (see `wrote`, which a post of one's own makes for the same reason). Both matter
   * on the same walk: a remark under a post nobody had answered yet leaves a count
   * of nought behind it, and a screen that went on saying nought would be a screen
   * saying the remark was never made.
   *
   * The key goes first, which is what makes this a re-ask rather than a no-op: the
   * minute the remark was made in has an answer already and that answer is now
   * wrong by exactly one line. It goes round the count rather than through it, for
   * the same reason — a post that had none is carrying a nought this very column is
   * about to disprove, and `discuss` would take that nought at its word.
   */
  commented(postId: string): void {
    const standing = this.commentSlots.get(postId);
    if (standing) standing.key = "";
    this.readColumn(postId);
  }

  /**
   * The one read behind both of those, so that the question and the re-asking of
   * it are the same question — and the one place the fact that this read is also a
   * write is accounted for.
   *
   * **Asking for a column is what marks it read**, exactly as asking for an
   * exchange is (see `seen`), so the same two things follow it. The recounted
   * figure comes off the answer, already counted down by this reading, so the badge
   * in the corner goes out as the words arrive rather than on the inbox's next
   * beat. And the inbox's own key is dropped, because the disc beside this row is
   * now wrong by one and the next paint should ask lo rather than have this client
   * decide what lo would have said.
   *
   * Quietly: the post's own words are already on the screen and are what the reader
   * stepped in for, so neither the minute beat nor a remark of their own may flip
   * the column back to a word about itself underneath them.
   */
  private readColumn(postId: string): void {
    void this.fill(
      keyed(this.commentSlots, postId, COMMENTS_KEPT),
      `${postId}:${within(COMMENTS_MS)}`,
      async () => {
        const answer = await this.api.comments(Number(postId));
        this.unreadCount = answer.unread ?? this.unreadCount;
        this.inboxSlot.key = "";
        return answer.comments;
      },
      true,
    );
  }

  /**
   * The streets between the reader and one venue, if they have been asked for.
   * A pure read, like `article`, `thread`, `profile` and `comments` above and
   * for their common reason: the driver builds the map on every paint of a
   * venue's screen, and drawing it must not be the thing that asks a router
   * anything (see glasses.ts).
   */
  route(venueId: string): Feed<NavPoint[]> {
    const found = this.routeSlots.get(venueId);
    return found ? view(found) : { status: "idle", data: null };
  }

  /** And the streets around it — the same pure read for the map's other layer. */
  roads(venueId: string): Feed<NavPoint[][]> {
    const found = this.roadSlots.get(venueId);
    return found ? view(found) : { status: "idle", data: null };
  }

  /**
   * The reader has opened one venue, and the map beside its words wants the way
   * there and the streets around it. The two reads in this app that go past lo —
   * a public pedestrian router and public vector tiles, both keyless and open to
   * this origin (see services/route.ts and services/roads.ts) — and both started
   * here, once per door and street's-width of origin, rather than by the map
   * being drawn: a paint happens twice a minute and a walk survives both
   * answers. Two slots rather than one because either can land, or fail,
   * without the other, and the map draws whatever it has.
   *
   * Quietly, because the map is already showing something — a dashed straight
   * line to the door on dark ground — and honest about it: the dash is the
   * crow's answer and the dark is no answer, and each layer replaces its own
   * when it lands. Where an upstream cannot answer at all its layer simply
   * stays what it was, which is why nothing here reports anything.
   */
  navigate(venue: LoVenue, from: Coordinates): void {
    const key = `${venue.id}:${round(from, ROUTE_ORIGIN_DECIMALS)}`;
    const spot = { latitude: venue.latitude, longitude: venue.longitude };
    void this.fill(keyed(this.routeSlots, venue.id, ROUTES_KEPT), key, () => fetchRoute(from, spot), true);
    void this.fill(keyed(this.roadSlots, venue.id, ROUTES_KEPT), key, () => fetchRoads(from, spot), true);
  }

  /** Signed out: nothing here belongs to whoever signs in next. */
  clear(): void {
    this.dashSlot = slot();
    this.localSlot = slot();
    this.newsSlot = slot();
    this.eventsSlot = slot();
    this.trendsSlot = slot();
    this.postsSlot = slot();
    this.warningsSlot = slot();
    this.inboxSlot = slot();
    this.peopleSlot = slot();
    this.cafeSlot = slot();
    this.foodSlot = slot();
    this.wikiSlot = slot();
    this.venueAnchor = null;
    this.venueLanguage = null;
    this.dashAsking = "";
    this.threadSlots.clear();
    this.profileSlots.clear();
    this.commentSlots.clear();
    this.articleSlots.clear();
    this.routeSlots.clear();
    this.roadSlots.clear();
    this.unreadCount = 0;
    this.changed();
  }
}
