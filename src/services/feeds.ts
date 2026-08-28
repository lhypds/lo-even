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
//   • `GET /api/messages` while the reader is actually on the page that shows
//     them, and at most once a minute — see the key below.
//
// And two on the minute beat, neither of which asks lo to look anything up
// elsewhere: `PUT /api/position`, which files where we are and takes back
// everyone else's and the unread count, and `GET /api/posts`, because what is
// written on the ground here is the one thing on these pages that changes while
// the reader stands still.
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
  LoDashboard,
  LoFeedItem,
  LoPerson,
  LoPost,
  LoThread,
  LoTrend,
  LoWarningsResult,
} from "../types";
import type { Feed } from "../glassesui/pages/types";
import type { LoApi } from "./api";

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

/** The stretch of time an answer belongs to, which is the rest of every key. */
function within(every: number): string {
  return String(Math.floor(Date.now() / every));
}

export class Feeds {
  private readonly api: LoApi;
  private readonly changed: () => void;

  private dashSlot = slot<LoDashboard>();
  private postsSlot = slot<LoPost[]>();
  private warningsSlot = slot<LoWarningsResult>();
  private inboxSlot = slot<LoThread[]>();
  private peopleSlot = slot<LoPerson[]>();
  // One per story the reader has opened, keyed by the link that opened it.
  // A Map rather than a field because there is no telling in advance which of a
  // list they will read, and insertion order is what makes the cap above a
  // sensible one to enforce.
  private articleSlots = new Map<string, Slot<LoArticle>>();
  private unreadCount = 0;

  constructor(api: LoApi, changed: () => void) {
    this.api = api;
    this.changed = changed;
  }

  get place() {
    return this.dashSlot.data?.local?.place ?? null;
  }
  get weather() {
    return this.dashSlot.data?.local?.weather ?? null;
  }
  /** Which regional feeds the country the reader is standing in has. */
  get components(): string[] {
    return this.dashSlot.data?.local?.components ?? [];
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
    return part(this.dashSlot, "nearby");
  }
  get events(): Feed<LoFeedItem[]> {
    return part(this.dashSlot, "events");
  }
  get trends(): Feed<LoTrend[]> {
    return part(this.dashSlot, "trends");
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
    let target = this.articleSlots.get(link);
    if (!target) {
      // Bounded, because this is the one store that grows with what the reader
      // has done rather than with where they are standing: an afternoon spent
      // walking and reading the wire would otherwise keep every story of the day
      // alive. The oldest goes, which on a Map is its first key.
      if (this.articleSlots.size >= ARTICLES_KEPT) {
        const oldest = this.articleSlots.keys().next();
        if (!oldest.done) this.articleSlots.delete(oldest.value);
      }
      target = slot<LoArticle>();
      this.articleSlots.set(link, target);
    }
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
    for (const each of [this.dashSlot, this.postsSlot, this.warningsSlot, this.inboxSlot]) {
      each.key = "";
    }
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
   * The two reads a new fix is worth. Called on every one; the keys decide
   * whether either of them is actually a new question.
   */
  async here(coords: Coordinates, language: Language): Promise<void> {
    await Promise.all([
      this.fill(
        this.dashSlot,
        `${round(coords, 3)}:${language}:${within(DASHBOARD_MS)}`,
        () => this.api.dashboard(coords),
      ),
      // Not asked for outside Japan, where Yahoo has nothing to say and the
      // answer would be an all clear nobody checked.
      this.fill(
        this.warningsSlot,
        `${round(coords, 2)}:${within(WARNINGS_MS)}`,
        () => this.api.warnings(coords),
      ),
    ]);
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
        within(POSTS_MS),
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

  /** What is on the ground here, asked for as coarsely as the answer keeps. */
  private readPosts(coords: Coordinates, language: Language): Promise<void> {
    return this.fill(
      this.postsSlot,
      `${round(coords, 3)}:${language}:${within(POSTS_MS)}`,
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

  /** Signed out: nothing here belongs to whoever signs in next. */
  clear(): void {
    this.dashSlot = slot();
    this.postsSlot = slot();
    this.warningsSlot = slot();
    this.inboxSlot = slot();
    this.peopleSlot = slot();
    this.articleSlots.clear();
    this.unreadCount = 0;
    this.changed();
  }
}
