// What has been asked for, what came back, and what is not worth asking yet.
//
// The website has one of these per card: each of lo's regional cards holds its
// own result, its own error and its own "still loading", and re-asks when the
// fix has moved far enough to be a different question. This is that, gathered
// into one object because up here the cards are pure functions and cannot hold
// anything themselves.
//
// **Eager and lazy.** Three reads go out the moment there is a fix, because the
// first screens cannot draw without them: the place and its weather (which also
// says which cards this country can feed), the posts around here, and our own
// position — which is traded for everyone else's, so presence costs nothing
// extra. Everything else is fetched the first time the reader actually scrolls
// to it. The news, the events and the trends are three upstream lookups apiece
// on a phone tether, and a reader who never turns past the weather should not be
// paying for them.
//
// **How coarse a question is.** A fix jitters by metres while a hand is still,
// and re-asking on every jitter would be the same question over and over. Each
// feed is keyed as coarsely as its answer actually is, and the roundings are
// lo's own: one decimal (~11 km) for the three that are city-wide questions, two
// (~1.1 km) for the warnings, which Yahoo answers per municipality, three
// (~110 m) for the place and the posts, which are about the street.

import type {
  Coordinates,
  Language,
  LoFeedResult,
  LoLocal,
  LoPerson,
  LoPost,
  LoTrendsResult,
  LoWarningsResult,
} from "../types";
import type { Feed } from "../glassesui/cards/types";
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

function round(coords: Coordinates, places: number): string {
  return `${coords.latitude.toFixed(places)},${coords.longitude.toFixed(places)}`;
}

/** Which feed each card is waiting on. Cards not named here need no read of their own. */
const LAZY: Record<string, "nearby" | "events" | "trends" | "warnings"> = {
  nearby: "nearby",
  events: "events",
  trends: "trends",
  warnings: "warnings",
};

export class Feeds {
  private readonly api: LoApi;
  private readonly changed: () => void;

  private localSlot = slot<LoLocal>();
  private postsSlot = slot<LoPost[]>();
  private peopleSlot = slot<LoPerson[]>();
  private nearbySlot = slot<LoFeedResult>();
  private eventsSlot = slot<LoFeedResult>();
  private trendsSlot = slot<LoTrendsResult>();
  private warningsSlot = slot<LoWarningsResult>();

  constructor(api: LoApi, changed: () => void) {
    this.api = api;
    this.changed = changed;
  }

  get local(): Feed<LoLocal> {
    return view(this.localSlot);
  }
  get posts(): Feed<LoPost[]> {
    return view(this.postsSlot);
  }
  get people(): Feed<LoPerson[]> {
    return view(this.peopleSlot);
  }
  get nearby(): Feed<LoFeedResult> {
    return view(this.nearbySlot);
  }
  get events(): Feed<LoFeedResult> {
    return view(this.eventsSlot);
  }
  get trends(): Feed<LoTrendsResult> {
    return view(this.trendsSlot);
  }
  get warnings(): Feed<LoWarningsResult> {
    return view(this.warningsSlot);
  }

  /** Which regional cards the country the reader is standing in can feed. */
  get components(): string[] {
    return this.localSlot.data?.components ?? [];
  }

  /**
   * Everything is a stale answer to a question about somewhere else now. Not
   * cleared, though — the old reading stays on screen until the new one lands,
   * because a card that empties itself on every step of a walk is a card nobody
   * can read while walking. The keys are what actually change, and they are what
   * makes the next `ensure` re-ask.
   */
  forget(): void {
    for (const each of [
      this.localSlot,
      this.postsSlot,
      this.nearbySlot,
      this.eventsSlot,
      this.trendsSlot,
      this.warningsSlot,
    ]) {
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
   * The three reads the opening screens cannot draw without. Called on every new
   * fix; the keys below decide whether any of them is actually a new question.
   */
  async here(coords: Coordinates, language: Language): Promise<void> {
    const street = `${round(coords, 3)}:${language}`;
    await Promise.all([
      this.fill(this.localSlot, street, () => this.api.local(coords)),
      this.fill(this.postsSlot, street, () => this.api.posts(coords).then((answer) => answer.posts)),
      // Not keyed on where we are: publishing a fix is worth doing wherever it
      // was taken, and the answer — who else is out — is about the last minute
      // rather than about the metre. Keyed on nothing, so only the timer
      // re-asks it.
      this.fill(this.peopleSlot, "live", () => this.api.publishPosition(coords).then((a) => a.people), true),
    ]);
  }

  /** Just the presence trade, which the minute loop makes on its own. */
  async presence(coords: Coordinates): Promise<void> {
    this.peopleSlot.key = "";
    await this.fill(this.peopleSlot, "live", () => this.api.publishPosition(coords).then((a) => a.people), true);
  }

  /**
   * The reader has scrolled to this card. If it is one of the four that pay for
   * themselves, this is where that gets paid — once, and not again until the fix
   * has moved far enough to make it a different question.
   */
  ensure(cardId: string, coords: Coordinates, language: Language): void {
    const feed = LAZY[cardId];
    if (!feed) return;
    switch (feed) {
      case "nearby":
        void this.fill(this.nearbySlot, `${round(coords, 1)}:${language}`, () => this.api.nearby(coords));
        return;
      case "events":
        void this.fill(this.eventsSlot, `${round(coords, 1)}:${language}`, () => this.api.events(coords));
        return;
      case "trends":
        void this.fill(this.trendsSlot, `${round(coords, 1)}:${language}`, () => this.api.trends(coords));
        return;
      case "warnings":
        // Alone among these it does not take the language: Yahoo answers in
        // Japanese either way, and the card puts the reader's words back on.
        void this.fill(this.warningsSlot, round(coords, 2), () => this.api.warnings(coords));
    }
  }

  /** A post just written, straight onto the list rather than through a refetch. */
  addPost(post: LoPost): void {
    const posts = this.postsSlot.data ?? [];
    this.postsSlot.data = [post, ...posts.filter((each) => each.id !== post.id)];
    this.postsSlot.status = "ready";
    this.changed();
  }

  /** Signed out: nothing here belongs to whoever signs in next. */
  clear(): void {
    this.localSlot = slot();
    this.postsSlot = slot();
    this.peopleSlot = slot();
    this.nearbySlot = slot();
    this.eventsSlot = slot();
    this.trendsSlot = slot();
    this.warningsSlot = slot();
    this.changed();
  }
}
