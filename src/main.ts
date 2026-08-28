import {
  AppLocationAccuracy,
  AudioInputSource,
  EventSourceType,
  OsEventTypeList,
  waitForEvenAppBridge,
  type AppLocation,
} from "@evenrealities/even_hub_sdk";
import { ApiError, LoApi } from "./services/api";
import { Feeds } from "./services/feeds";
import { conditionPcm, transcribe } from "./utils/audio";
import { sensorState, startSensors, subscribeSensors } from "./utils/sensors";
import { createBrowserDisplay, createGlassesDisplay, type GlassesDisplay } from "./glassesui/glasses";
import { PageRefused } from "./glassesui/paint";
import { composeView, type Draft } from "./glassesui/pages/compose";
import type { PageContext } from "./glassesui/pages/types";
import { localeFor } from "./glassesui/format";
import { translator } from "./glassesui/strings";
import type { Coordinates, LoUser } from "./types";
import { createWebUI, type WebUI } from "./webui/webui";

const SAMPLE_RATE = 16_000;
const MIN_RECORDING_MS = 250;
const MAX_RECORDING_MS = 60_000;
// How many times a hold asks for the microphone before it takes no for an answer.
//
// The open is a round trip to the phone and on to the glasses over the same link
// the page is drawn on, and a link that is busy answers `false` rather than
// waiting. One refusal used to be the whole answer, which is how a reader who had
// done nothing wrong came to be told the microphone was broken several times an
// hour. Three tries is the same shape the start-up page already uses against the
// same link for the same reason (see paint.ts).
const MIC_OPEN_TRIES = 3;
// Long enough for whatever was on the link to have landed, short enough that a
// reader holding the touchpad has not started talking yet. Two of these is the
// most a hold can spend before the microphone is either open or genuinely shut.
const MIC_OPEN_BACKOFF_MS = 150;
const SCROLL_COOLDOWN_MS = 380;
// How long a tap sits before it is taken as a tap. The host reports the first
// press of a double tap as a press of its own, so wherever a tap and a double
// tap mean different things the two gestures begin identically and the first of
// them cannot be acted on yet.
//
// That is now everywhere the reader can go rather than only the composer. A tap
// steps into what is under them and a double tap steps back out, and acting on
// the tap at once would make every step out a step in and then a step out of
// *that* — the reader would ask to leave the list and be left standing in it,
// one level down from where they meant to be. So the tap waits, and the double
// tap cancels it on its way past (see `armEnter`).
//
// The number is the one this app already learned, back when a tap wrote a mark
// and had to be told apart from the double tap that leaves — long enough for the
// second press to have come over BLE.
const DOUBLE_TAP_MS = 650;
// What the composer is called where the display has to name what is in front of
// the reader. It is not a page and it is not in the sequence (see glasses.ts).
const COMPOSE = "compose";
// What the letters are called where a group has to be named by it. Every entry
// nearby.ts builds out of the inbox is stamped with this (see pages/nearby.ts).
const LETTERS = "messages";
// And what the names on the street are called, which is the other group down
// here whose entries are addressed to a person rather than to a place: opening
// one is what fetches their profile, and a hold on one is a message to them.
const PEOPLE = "people";
// How long one letter has to stay in front of the reader before lo is told they
// have read it.
//
// It is a clock rather than a gesture, and that is the point. lo has never had a
// button for this on its own sheet — a conversation somebody has been shown is one
// they have seen, and a screen that asked them to press something afterwards would
// be asking them to file their own post — and a screen with three gestures on it
// could not have spared one for filing anyway.
//
// Three seconds because the wheel walks the letters a flick at a time, and the
// screen changes under it on every flick: arriving on a letter is not reading one.
// Long enough to be past everybody who was passing through, short enough to have
// happened well before a reader who stopped is done with it.
const READ_DWELL_MS = 3000;
// How long the link key is left standing after a sign-in. Long enough for the
// WebView to have traded it for a session of its own on a slow phone tether,
// short enough that a password equivalent is not left sitting in that frame's
// URL for the rest of the session.
const LINK_KEY_TTL_MS = 60_000;
// The beat lo's own dashboard keeps: a fresh fix, published, and everyone else's
// back in the same answer.
const PRESENCE_MS = 60_000;
// A bearing changes continuously and the screen cannot; twice a second is past
// the point where a reader could tell, and every frame past it is a BLE write
// bought for nothing.
const SENSOR_PAINT_MS = 500;

function browserLocation(): Promise<Coordinates | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          altitude: coords.altitude,
          speed: coords.speed,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  });
}

async function main() {
  const bridge = await waitForEvenAppBridge();
  const api = new LoApi();
  let t = translator(api.language);

  let display: GlassesDisplay;
  // Whether this launch has a touchpad and no screen, which is the one failure
  // this package cannot report on the screen. Two very different things end at
  // the same fallback below and only one of them is anybody's problem:
  //
  //   • An ordinary browser, where there is no native handler to call and the
  //     first call rejects before the glasses are ever asked anything. That is
  //     development — the phone view is lo's own site and draws itself — and the
  //     browser display exists precisely so this file can be written once.
  //   • A real Even App that would not make the start-up page. Everything else
  //     about the launch works: the session comes back, the feeds arrive, the
  //     touchpad reports every scroll and tap and hold. None of it lands
  //     anywhere. That is worth interrupting somebody about.
  let blind = false;
  try {
    display = await createGlassesDisplay(bridge, t("glasses.connecting"));
  } catch (error) {
    blind = error instanceof PageRefused;
    if (blind) console.error("nothing can reach the glasses", error);
    else console.info("Even display unavailable; using browser preview", error);
    display = createBrowserDisplay();
  }

  let ui!: WebUI;
  let user: LoUser | null = null;
  let coords: Coordinates | null = null;
  let fixAt: number | null = null;
  let status = "";
  let statusTimer = 0;
  let locating = false;

  let burnTimer = 0;
  let recording = false;
  let recordingStartedAt = 0;
  let recordingTimer = 0;
  let audioChunks: Uint8Array[] = [];
  let audioBytes = 0;
  let tapTimer = 0;
  let navTimer = 0;
  let lastScrollAt = 0;
  let sensorPaintAt = 0;
  // The three seconds that mark a letter read, and which letter they are being
  // counted on. The second of these is what keeps a repaint — the clock turning
  // over, a feed landing, the compass moving — from starting the count again on a
  // letter that has been on screen for two and a half seconds already.
  let dwellTimer = 0;
  let dwellOn = "";
  // Who the sentence now being recorded is an answer to, taken when the hold
  // began. Empty for a hold that was not begun on a letter, which is every hold
  // anywhere else in the app.
  let replyTo = "";

  // What a sentence goes through between being said and being saved: heard, then
  // waited on while it is turned into words, then standing as a draft until the
  // reader says which of the two things it is.
  //
  // `dictation` is which one of those is the live one. A tap can throw a sentence
  // away while the transcript is still coming back, and a transcript that landed
  // after that has to know it is answering a question nobody is asking any more —
  // the same ticket the feed store keeps, for the same reason (see feeds.ts).
  let dictation = 0;
  let transcribing = false;
  let draft: Draft | null = null;

  // Every feed answers back through here, so a card that was waiting redraws the
  // moment its answer lands rather than on the next beat of anything.
  const feeds = new Feeds(api, () => render());

  function buildContext(): PageContext {
    return {
      now: new Date(),
      language: api.language,
      locale: localeFor(api.language),
      t,
      coords,
      fixAt,
      place: feeds.place,
      weather: feeds.weather,
      components: feeds.components,
      posts: feeds.posts,
      people: feeds.people,
      news: feeds.news,
      events: feeds.events,
      trends: feeds.trends,
      warnings: feeds.warnings,
      messages: feeds.messages,
      unread: feeds.unread,
      heading: sensorState(),
      username: user?.username ?? null,
      article: (link) => feeds.article(link),
      thread: (username) => feeds.thread(username),
      profile: (username) => feeds.profile(username),
    };
  }

  // What is in front of the reader is what is worth paying for. Two reads work
  // that way, and none of them has anything to do with where anybody is standing:
  //
  //   • the inbox, which is not worth asking for until the page that shows it is
  //     up. `current` answers with the page rather than the path, which is what
  //     this wants — the letters are on the second page, in the list under it
  //     and on the screen under that, and all three of them are `nearby`.
  //   • the story behind a headline, which is not worth asking for until the
  //     reader has opened that one headline. lo reads none of a list until asked
  //     (see lo/server/articles.js), so this is the request that decides — and
  //     it is deliberately hung off `reading`, which is null at both the depths
  //     where the reader is still choosing.
  //   • who one of the names on the street is, which is worth asking for at
  //     exactly the same moment and for the same reason. It hangs off `opened`
  //     rather than `reading` because a person carries no link — there is nothing
  //     to fetch a profile *by* except the name — and `opened` is null at those
  //     same two depths, so a wheel walking a list of names asks lo about none of
  //     them.
  //
  // Called after every paint, every scroll and every step in or out; the feed
  // store decides whether any of them is actually a new question (see feeds.ts)
  // and does nothing when it is not.
  function ensureVisible(): void {
    // First, because this one is about a screen going away as much as about one
    // arriving, and a signed-out app has a clock to stop rather than nothing to do.
    watchLetter();
    if (!api.signedIn) return;
    if (display.current() === "nearby") feeds.inbox();
    const open = display.reading();
    if (open) {
      feeds.read(open.link, {
        title: open.title,
        kind: open.group === "events" ? "event" : "news",
      });
    }
    // And the profile behind an open name. No clock in front of it, where the
    // letter three lines up has three seconds: asking for an exchange is what
    // tells lo it has been read, and asking for a profile tells lo nothing.
    const person = display.opened();
    if (person?.group === PEOPLE) feeds.meet(person.key);
  }

  /**
   * The clock that marks a letter read, started when one is opened and stopped
   * when the reader moves off it. It is the only thing in this app that writes
   * without being asked to, and the whole of what keeps that honest is the
   * comparison below: the count belongs to a letter by name, so it survives every
   * repaint of the screen it is on and does not survive a flick to the next one.
   *
   * What counts as being on a letter is the reading screen and nothing above it.
   * A list of correspondents is a list the wheel walks; opening one is the reader
   * saying which, exactly as it is for a story (see feeds.read). And a composer
   * standing in front of the screen answers `null` here, so a reader dictating a
   * reply is not also being timed — the letter is behind the question they are
   * looking at.
   */
  function watchLetter(): void {
    const open = api.signedIn ? display.opened() : null;
    const letter = open?.group === LETTERS ? open.key : "";
    if (letter === dwellOn) return;
    window.clearTimeout(dwellTimer);
    dwellOn = letter;
    dwellTimer = letter
      ? window.setTimeout(() => {
          dwellTimer = 0;
          feeds.seen(letter);
        }, READ_DWELL_MS)
      : 0;
  }

  function render(): void {
    display.render(buildContext(), status);
    ensureVisible();
  }

  function setStatus(next: string, durationMs = 0): void {
    window.clearTimeout(statusTimer);
    status = next;
    render();
    if (durationMs > 0) {
      statusTimer = window.setTimeout(() => setStatus(""), durationMs);
    }
  }

  async function phoneLocation(highAccuracy = false): Promise<Coordinates | null> {
    try {
      const location: AppLocation | null = await bridge.getAppLocation({
        accuracy: highAccuracy ? AppLocationAccuracy.High : AppLocationAccuracy.Medium,
        timeoutMs: highAccuracy ? 8000 : 5000,
      });
      if (location) {
        return {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        };
      }
    } catch {
      // Ordinary browser preview has no native Even bridge.
    }
    const browser = await browserLocation();
    if (browser) return browser;
    if (import.meta.env.DEV) return { latitude: 35.681236, longitude: 139.767125, accuracy: 12 };
    return null;
  }

  /**
   * A fix, and the two reads that hang off one — which between them fill all three
   * pages, because the first of them is a count of the other two (see feeds.ts).
   */
  async function refresh(highAccuracy = false): Promise<void> {
    if (!api.signedIn) {
      setStatus(t("glasses.signIn"));
      ui.showLogin();
      return;
    }
    if (locating) return;
    locating = true;
    if (!coords) setStatus(t("glasses.locating"));
    try {
      const next = await phoneLocation(highAccuracy);
      if (!next) {
        if (!coords) setStatus(t("glasses.noFix"), 2500);
        return;
      }
      coords = next;
      fixAt = Date.now();
      setStatus("");
      await feeds.here(next, api.language);
      // A page already in view whose feed is keyed on a fix that has now moved
      // has to be re-asked; ensureVisible is the same gate the scroll uses.
      ensureVisible();
    } finally {
      locating = false;
    }
  }

  // The key has done its whole job the moment the WebView has traded it for a
  // session, so it is withdrawn rather than left standing. Withdrawing it signs
  // nobody out: the two sessions it opened — the frame's cookie and this frame's
  // bearer token — outlive the key that opened them.
  async function burnLinkKey(): Promise<void> {
    window.clearTimeout(burnTimer);
    burnTimer = 0;
    try {
      await api.revokeLinkKey();
    } catch (error) {
      // A key left standing is a smaller problem than anything worth
      // interrupting a working session for, and the next sign-in schedules
      // another withdrawal of the same key behind it.
      console.error("could not withdraw the link key", error);
    }
  }

  // What a key is spent on, from either of the two ways of coming by one — the
  // password, or the token the last launch left behind. The frame is entered on
  // it, the screen in front of the frame comes down, and the key's withdrawal
  // goes on the clock.
  function spendLinkKey(key: string): void {
    ui.setKey(key);
    ui.hideLogin();
    window.clearTimeout(burnTimer);
    burnTimer = window.setTimeout(() => void burnLinkKey(), LINK_KEY_TTL_MS);
  }

  /**
   * Coming back without being asked anything. The token is written down and the
   * key is not, so a launch that finds one asks lo a single question — whose
   * session is this, and a fresh key for the frame — and both sides come up
   * signed in on the answer (see api.ts).
   *
   * Every way this can fail ends in the password being asked for, because there
   * is no half of this worth keeping: a token that cannot buy a key would leave
   * the glasses reading a feed the phone view could not show.
   */
  async function resume(): Promise<boolean> {
    if (!api.signedIn) return false;
    setStatus(t("glasses.resuming"));
    // The one request, and nothing else, decides whether the password screen goes
    // up: everything after it is this launch getting on with itself, and a fix or
    // a feed that fails is not a session that failed.
    const session = await api.resume().catch((error: unknown) => {
      // Forgotten only where lo actually answered — a token it no longer knows,
      // or an account that has none of this. A launch that could not reach lo at
      // all has learned nothing about the session and keeps it written down for
      // the next one; this launch asks for the password either way, and a
      // sign-in overwrites whatever was being kept.
      api.setToken("", error instanceof ApiError);
      return null;
    });
    if (!session) return false;
    user = session.user;
    ui.setUser(user);
    spendLinkKey(session.key);
    await refresh();
    return true;
  }

  async function login(username: string, password: string): Promise<void> {
    ui.setLoginBusy(true);
    // The one press this package has, and iOS will only hand over the compass
    // from inside one. Not awaited: the sign-in is the thing the reader pressed
    // for, and a permission sheet is not worth holding it up (see sensors.ts).
    void startSensors();
    try {
      const session = await api.login(username, password);
      user = session.user;
      // The password is spent here and goes no further, and neither does the key
      // it bought: the key opens the WebView and is withdrawn a minute later, so
      // there is nothing of it left to keep. The token is the one thing written
      // down, and it is written down so that this is the last time this reader is
      // asked (see api.ts).
      ui.setUser(user);
      spendLinkKey(session.key);
      await refresh();
    } catch (error) {
      // The error itself rather than a sentence about it: the screen asking is
      // lo's own, and it says what the server said in lo's own words.
      ui.showLogin(error);
      setStatus(t("glasses.signIn"));
    } finally {
      ui.setLoginBusy(false);
    }
  }

  /**
   * Signing out, which is news from the frame rather than anything pressed out
   * here: the sign-out button belongs to lo's own account sheet, and what reaches
   * this side is the line lo posts on its way out (see webui.ts).
   *
   * The screen goes first and the errands after. By the time this runs the site
   * has already signed itself out and is drawing its own sign-in screen, and
   * every moment spent on a round trip before the frame is taken down is a moment
   * of that screen showing through — the one thing the reader is not meant to
   * see, there being no second screen as far as they know.
   */
  async function logout(): Promise<void> {
    discard();
    user = null;
    coords = null;
    fixAt = null;
    feeds.clear();
    ui.setKey("");
    ui.setUser(null);
    ui.showLogin();
    setStatus(t("glasses.signIn"));
    // Now the two things that need the token, before it is thrown away. The key
    // is withdrawn before the session goes rather than after, because the
    // withdrawal is spent on the very token /api/logout is about to invalidate;
    // if the minute has already elapsed there is nothing left to withdraw.
    if (burnTimer) await burnLinkKey();
    await api.logout().catch(() => {});
    // Which also takes it out of storage, so the next launch asks rather than
    // letting itself back into the account the reader has just left.
    api.setToken("");
  }

  /* ----------------------------------------------- what a hold turns into */

  /**
   * The screen that asks a dictation what it is, put up or taken down. Drawn again
   * on every turn of the wheel and not only on the way in, because the words on it
   * change with the answer: lo keeps 48 characters of what was said as the name of
   * a mark and 500 as the words of a post, and the preview shows what the answer
   * the wheel is on would actually save (see pages/compose.ts).
   *
   * The takeover goes up before the status line is cleared, so what the reader
   * sees is the question arriving rather than a flash of the page underneath it.
   */
  function showDraft(): void {
    display.takeover(draft ? { id: COMPOSE, view: composeView(draft, t) } : null);
    // The composer's footer carries its own instructions, so whatever was being
    // said about the last step goes when the question arrives. This paints, which
    // is why nothing that calls this has to.
    setStatus("");
  }

  /**
   * The wheel, while the composer has it: the other of the two answers.
   *
   * A reply has no other answer. The sentence was said into one letter and there
   * is nothing on that screen to choose between, so the wheel does nothing rather
   * than being given something to do — the alternative would be offering to turn a
   * letter meant for one person into a line left in the street, which is not a
   * mistake a flick of the wheel should be able to make.
   */
  function chooseOther(): void {
    if (!draft || draft.kind === "reply") return;
    draft = { ...draft, kind: draft.kind === "mark" ? "post" : "mark" };
    showDraft();
  }

  /**
   * A tap on the composer, taken as the answer once it is clear it was not the
   * first half of one. The wait is the whole of what this function is: a post
   * cannot be unsaid, and a reader who meant to throw the sentence away would
   * otherwise watch it go out on the first of their two taps.
   *
   * Whatever the wheel is on when the timer fires is what is saved, rather than
   * what it was on when the tap landed. The half second is short enough that
   * those are the same answer, and a reader still rolling has not finished
   * choosing.
   */
  function armKeep(): void {
    window.clearTimeout(tapTimer);
    tapTimer = window.setTimeout(() => {
      tapTimer = 0;
      void keep();
    }, DOUBLE_TAP_MS);
  }

  /* --------------------------------------------------- stepping in and out */

  /**
   * A tap on a screen with something under it, held for as long as it takes to
   * find out that it was not the first half of a double tap. Every step in goes
   * through here; the step out clears the timer as it passes, which is what makes
   * a double tap one gesture rather than a step in followed by a step out of it.
   */
  function armEnter(): void {
    window.clearTimeout(navTimer);
    navTimer = window.setTimeout(() => {
      navTimer = 0;
      display.enter();
      // The inbox is worth paying for while it is on screen, and stepping into
      // the letters is exactly that (see ensureVisible).
      ensureVisible();
    }, DOUBLE_TAP_MS);
  }

  /** A tap that has not been taken yet, dropped — because a second one arrived. */
  function disarmEnter(): void {
    window.clearTimeout(navTimer);
    navTimer = 0;
  }

  /**
   * Everything an unfinished sentence is holding, put back. Quiet, because this is
   * also what signing out and shutting down do and neither of those has anybody
   * left to tell.
   */
  function discard(): void {
    cancelRecording();
    disarmEnter();
    // The second tap of a drop arrives while the first one is still waiting to be
    // read as an answer. Clearing the timer here is what makes the drop win.
    window.clearTimeout(tapTimer);
    tapTimer = 0;
    // A transcript still on its way is now the answer to a question nobody is
    // asking. Bumping the ticket is what tells it so.
    dictation += 1;
    transcribing = false;
    // And whoever the sentence was going to. `finishRecording` takes its own copy
    // before it awaits anything, so clearing this cannot redirect a reply already
    // on its way to the screen — it is what stops the *next* hold inheriting the
    // last one's correspondent.
    replyTo = "";
    if (draft) {
      draft = null;
      display.takeover(null);
    }
  }

  /**
   * Everything in the air, dropped, and the reader told so. What reaches this is a
   * tap while a recording is running or a transcript is on its way, and the double
   * tap that answers the composer — a screen with no keyboard and no undo has to
   * keep one way out of every state it can put a reader in.
   *
   * Which gesture that is depends on what the reader would lose. Before there is a
   * draft there is nothing standing that a stray tap could destroy, so the way out
   * is the single tap and it is taken at once. Once the question is up the sentence
   * is worth something, and the way out becomes the deliberate gesture rather than
   * the easy one.
   */
  function cancel(): void {
    const something = recording || transcribing || draft !== null;
    discard();
    if (something) setStatus(t("compose.dropped"), 1600);
  }

  /** The answer, and the one round trip it turns into. */
  async function keep(): Promise<void> {
    if (!draft) return;
    const current = draft;
    draft = null;
    display.takeover(null);

    // A letter, which is the one thing this app writes that is addressed to
    // somebody rather than left at a place. It carries no fix — where the reader
    // was standing when they answered is nobody's business — so there is nothing
    // here about the ground and nothing on any page here to put right afterwards
    // except the inbox's own idea of who spoke last.
    if (current.kind === "reply") {
      setStatus(t("reply.sending"));
      try {
        await api.reply(current.to, current.text);
        setStatus(t("reply.sent"), 2500);
        // The exchange the reader is about to be put back on now ends with what
        // they just said, and the inbox's row for it does too. Both are re-asked
        // rather than left to the next beat: a reader who answered a letter and
        // did not find the answer in it would have every reason to think it never
        // went (see feeds.ts, which does the same for a post).
        feeds.replied(current.to);
      } catch (error) {
        console.error(error);
        setStatus(t("reply.failed"), 2500);
      }
      return;
    }

    const { text, coords: spot, kind } = current;
    const shared = kind === "post";
    setStatus(t(shared ? "post.saving" : "mark.saving"));
    try {
      if (shared) await api.createPost(spot, text);
      else await api.createMark(spot, text);
      // The words alone. There used to be a ✓ in front of them, and this face has
      // no such character — it drew nothing and left four pixels of air where the
      // tick was supposed to be (see the note under the table in metrics.ts).
      setStatus(t(shared ? "post.saved" : "mark.saved"), 2500);
      // What is on the ground here has just changed, and the page that lists it is
      // one flick away: a reader who scrolled to it and did not find what they had
      // just said would have every reason to think it was never written. A mark
      // needs none of this — no page here lists them, because they are nobody's
      // but the reader's and the phone is where they are read.
      if (shared && coords) void feeds.wrote(coords, api.language);
    } catch (error) {
      console.error(error);
      setStatus(t(shared ? "post.failed" : "glasses.markFailed"), 2500);
    }
  }

  /**
   * One microphone command at a time, in the order they were asked for.
   *
   * Every one of these is a round trip to the host and on to the glasses, and what
   * the host does with two of them in flight at once is not documented anywhere —
   * so an open sent while a close is still out there is an open with every reason
   * to come back `false`. Nothing used to hold them apart: the three closes below
   * are all fire-and-forget, and a
   * reader who released the touchpad and held it again straight away — which is
   * how you say a sentence over, and the commonest thing to do with a transcript
   * you did not like — was racing their own release.
   *
   * The catch is the other half of the job. `audioControl` rejects outright where
   * there is no native handler to call, and `startRecording` is reached from an
   * event handler with nothing behind it to catch anything: a throw there would
   * leave `recording` standing with no timer armed and no way back, and every hold
   * after it would return at the guard without so much as a line on the screen. A
   * host that will not take the call is the same answer as glasses that said no.
   */
  let audioGate: Promise<unknown> = Promise.resolve();

  function audio(open: boolean): Promise<boolean> {
    const next = audioGate.then(async () => {
      try {
        // Named rather than left to the default, which is this anyway. The one
        // documented cause of a glasses microphone answering `false` is being
        // asked for before the start-up page exists, and being explicit about
        // which microphone this is keeps the call and that diagnosis in the same
        // language (see the SDK's troubleshooting table).
        return await bridge.audioControl(open, AudioInputSource.Glasses);
      } catch (error) {
        console.error("the microphone would not answer", error);
        return false;
      }
    });
    audioGate = next.catch(() => undefined);
    return next;
  }

  /**
   * The microphone, asked for until it opens or until the reader has gone.
   *
   * A hold is a gesture that has already been committed to by the time this runs,
   * so a single `false` is not worth reporting as a failure — it is worth asking
   * again. Between tries the recording is re-checked rather than assumed: a hold
   * released while this was waiting is a reader who has stopped talking, and there
   * is nobody left to open the microphone for.
   */
  async function openMic(): Promise<boolean> {
    for (let attempt = 0; attempt < MIC_OPEN_TRIES; attempt += 1) {
      if (attempt) {
        await new Promise((resolve) => window.setTimeout(resolve, MIC_OPEN_BACKOFF_MS));
        if (!recording) return false;
      }
      if (await audio(true)) return true;
    }
    return false;
  }

  /**
   * The microphone, opened. `answering` is the correspondent this sentence is a
   * reply to, where the hold began on one letter read whole, and empty everywhere
   * else — which is what decides, an entire dictation later, which of the two
   * questions the reader is asked (see finishRecording).
   *
   * It is settled here rather than when the recording ends because the wheel still
   * works while the microphone is open: a reader who says something into a letter
   * and then rolls on to the next one meant the first, and asking again at the far
   * end would send it to whoever they had drifted onto.
   */
  async function startRecording(answering = ""): Promise<void> {
    if (recording || !api.signedIn) {
      if (!api.signedIn) {
        ui.showLogin();
        setStatus(t("glasses.signIn"));
      }
      return;
    }
    // A second hold before the first sentence has come back replaces it rather
    // than racing it. Bumping the ticket is what tells the transcript still on its
    // way that nobody is waiting for it — without this, it would land on top of
    // the recording that has already started and put up a question about the
    // wrong words. It also clears the last hold's correspondent, which is why the
    // new one is written down after it rather than before.
    if (transcribing) discard();
    replyTo = answering;
    recording = true;
    recordingStartedAt = Date.now();
    audioChunks = [];
    audioBytes = 0;
    // The microphone first and the screen second, which is the other way round
    // from how this used to read. Both are messages to the same host over the same
    // link, and `setStatus` paints on the way through — so asking for the screen
    // first put the one call that matters behind a page write, and a reader was
    // shown "● Recording" and then, half a second later, told by the very same
    // line that the microphone had not opened. What had failed was an open queued
    // behind the repaint of the line saying so.
    //
    // It also makes the dot mean what it says. It arrives when the microphone is
    // open rather than when the hold was noticed, which is the moment a reader can
    // usefully start talking.
    const opened = await openMic();
    if (!recording) {
      void audio(false);
      return;
    }
    if (!opened) {
      recording = false;
      // The microphone, and not anything the sentence was going to be. This used
      // to say "could not mark this spot", which was already answering for a
      // reader who had not been asked yet and became plainly wrong once a hold on
      // a letter started meaning "reply": nothing has been marked, posted or sent
      // here, because nothing has been said. A failure names the step that failed.
      setStatus(t("glasses.noMic"), 2200);
      return;
    }
    // Stamped here rather than up at the top, because what the length of a
    // recording has to mean below is how long the microphone was actually open —
    // which is what the byte count it is checked against measures too. The tries
    // above can take a moment, and counting them as speech would let a hold that
    // spent most of itself waiting for the microphone pass a test it should not.
    recordingStartedAt = Date.now();
    setStatus(`● ${t("glasses.recording")}`);
    recordingTimer = window.setTimeout(() => void finishRecording(), MAX_RECORDING_MS);
  }

  function cancelRecording(): void {
    if (!recording) return;
    recording = false;
    window.clearTimeout(recordingTimer);
    audioChunks = [];
    audioBytes = 0;
    void audio(false);
  }

  async function finishRecording(): Promise<void> {
    if (!recording) return;
    recording = false;
    window.clearTimeout(recordingTimer);
    void audio(false);
    const elapsed = Date.now() - recordingStartedAt;
    const raw = new Uint8Array(audioBytes);
    let offset = 0;
    for (const chunk of audioChunks) {
      raw.set(chunk, offset);
      offset += chunk.byteLength;
    }
    audioChunks = [];
    audioBytes = 0;
    if (elapsed < MIN_RECORDING_MS || raw.byteLength < (SAMPLE_RATE * 2 * MIN_RECORDING_MS) / 1000) {
      setStatus("");
      return;
    }

    // Who this is an answer to, if it is one. Read now, before anything is
    // awaited, for the same reason the ticket below exists: a second hold can
    // arrive while this transcript is still coming back, and it writes its own
    // correspondent over this one.
    const answering = replyTo;
    // Taken now rather than when the reader answers: the fix belongs to the spot
    // they were standing on when they said it, not to wherever they had drifted to
    // while deciding what it was. A reply is filed under a person and carries no
    // fix at all, so the GPS is not woken for one — the high-accuracy read is the
    // most expensive thing a hold does and a letter has no use for the answer.
    const fixPromise = answering ? null : phoneLocation(true);
    const ticket = ++dictation;
    transcribing = true;
    setStatus(t("glasses.transcribing"));
    try {
      const text = await transcribe(conditionPcm(raw), SAMPLE_RATE, api.language);
      // Thrown away with a tap while this was coming back. Nothing it has to say
      // is wanted, including its failures.
      if (ticket !== dictation) return;
      if (!text) {
        setStatus(t("glasses.noSpeech"), 2200);
        return;
      }
      // An answer to the letter that was open when the hold began. Shown back
      // before it goes rather than sent on the release: these are words a
      // transcriber heard rather than words the reader typed, and they are about
      // to arrive in somebody else's inbox with the reader's name on them. Every
      // other write up here is a note about a place; this is the one that is a
      // letter to a person, and there is no unsending one.
      if (answering) {
        draft = { kind: "reply", text, to: answering };
        showDraft();
        return;
      }
      const fix = (await fixPromise) ?? coords;
      if (ticket !== dictation) return;
      if (!fix) {
        setStatus(t("glasses.noFix"), 2200);
        return;
      }
      coords = fix;
      fixAt = Date.now();
      // Not saved — asked about. A hold used to be one verb: record, and file this
      // spot under what was said. There turn out to be two things a sentence said
      // out here can be, and only the reader knows which, so it stands on the
      // screen until they say (see pages/compose.ts).
      //
      // It opens on the mark, and that is not a coin toss. A mark is the answer
      // that can still be taken back by nobody having seen it; a wheel that
      // started on the public one would make "everybody nearby reads this" the
      // thing that happens when a reader taps the touchpad once without looking.
      draft = { text, coords: fix, kind: "mark" };
      showDraft();
    } catch (error) {
      console.error(error);
      // The transcriber, and again not the verb. What threw is the one step every
      // dictation goes through before anybody knows what it is going to be — a
      // speech service that could not be reached, or would not answer — so the
      // reader is told that rather than told a mark failed. It is the same
      // sentence whichever of the three a hold was going to turn into, because at
      // this point it had not turned into any of them (see `glasses.noMic`).
      if (ticket === dictation) setStatus(t("glasses.transcribeFailed"), 2500);
    } finally {
      if (ticket === dictation) transcribing = false;
    }
  }

  ui = createWebUI(
    {
      onLogin: login,
      onLogout: logout,
      onRefresh: () => void refresh(true),
      // A language chosen on the sign-in screen — or in the site behind it, which
      // says so through the frame (see webui.ts) — is the language the glasses are
      // fed in too: every feed is keyed on it, so changing it makes every card a
      // new question and the next paint re-asks whichever one is in view.
      //
      // Which is why a choice that changes nothing is dropped here rather than
      // there. The site announces every pick, including a pick of the language it
      // is already in, on purpose: the two sides keep this under separate origins
      // and can start out disagreeing, so re-picking is how a reader puts them
      // back together. Acted on blind, that would also throw away every feed this
      // app is holding to ask the same questions over again.
      onLanguage: (language) => {
        if (language === api.language) return;
        api.setLanguage(language);
        t = translator(language);
        feeds.forget();
        if (coords) void feeds.here(coords, language);
        render();
        // The one line on the phone this side owns rather than lo, so it follows
        // the language the same way every line on the display does.
        if (blind) ui.setNotice(t("glasses.noScreen"));
      },
    },
    // The same language the feeds are asked for, so the sign-in screen and the
    // site behind it are reading from one list.
    api.language,
  );
  ui.setUser(null);
  // Said on the phone, because it is the one thing wrong with this launch that the
  // glasses cannot be told: they are what is not working. It is a sentence about
  // the glasses all the same, which is why it comes out of their own dictionary
  // (see glassesui/strings.ts) rather than the phone screen's.
  //
  // A line rather than a stop. Everything the phone half does still works — it is
  // lo's own site and it never needed the glasses — so what this launch has is one
  // broken half and a reader who would otherwise put it down to the glasses being
  // broken. The rest of the app carries on: the feeds are still read, and every
  // gesture is still handled, so a pair of glasses that comes back mid-session
  // finds an app that has been keeping up with where its reader is.
  if (blind) ui.setNotice(t("glasses.noScreen"));

  // A cold start asks lo before it asks the reader. Every launch used to ask for
  // the password, because the key is withdrawn a minute after each sign-in and
  // nothing on the server would mint another from a token — so a stored session
  // could bring the glasses back but never the WebView, and an app half signed in
  // is worse than one that asks. `POST /api/me/link` is what closed that gap, and
  // a session that comes back brings both sides of the app with it.
  //
  // Not awaited: the gestures and the beat below are this launch's, whether or
  // not there is a session to come back on, and a package that ignores the
  // touchpad until the network has answered is a package that looks broken to a
  // reader whose phone is on a slow tether.
  void resume().then((resumed) => {
    if (resumed) return;
    setStatus(t("glasses.signIn"));
    ui.showLogin();
  });

  bridge.onEvenHubEvent((event) => {
    const eventType = event.textEvent?.eventType ?? event.listEvent?.eventType ?? event.sysEvent?.eventType;

    if (eventType === OsEventTypeList.SCROLL_TOP_EVENT || eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      const now = Date.now();
      if (now - lastScrollAt < SCROLL_COOLDOWN_MS) return;
      lastScrollAt = now;
      // A tap still waiting to be read is a reader who has changed their mind:
      // they are choosing again rather than opening what they were on.
      disarmEnter();
      // The wheel belongs to whatever has the screen. While a draft is standing
      // there are two answers and no pages, so it chooses between them — either
      // direction, because two things have no order to walk in.
      if (draft) {
        chooseOther();
        return;
      }
      // One line of screenfuls, walked a step at a time: a page with more rows
      // than fit contributes several steps, so scrolling reads down a long list
      // and then carries on to the next page (see glasses.ts).
      display.scroll(eventType === OsEventTypeList.SCROLL_TOP_EVENT ? -1 : 1);
      ensureVisible();
      return;
    }

    if (eventType === OsEventTypeList.LONG_PRESS_EVENT) {
      // The hold opens the microphone, and that is the whole of what it does —
      // including on the screen that is already asking about a sentence. A reader
      // who holds while a draft is standing is reaching for the gesture that
      // records, and what they almost always mean by it is that the words on the
      // screen are not the ones they meant to say. A transcriber mishears, and
      // this one has no keyboard behind it to correct with.
      //
      // So it says it again, over the top. The alternative the reader has is two
      // taps to throw it away and then a hold, which is the same thing done in two
      // gestures and with a moment in between where the sentence is gone and the
      // microphone is not open yet.
      //
      // The old sentence goes first, and `discard` is what takes it: it drops the
      // draft, takes the composer down and — the part that matters here — clears
      // the tap that may already be sitting in the timer waiting to send it. A
      // hold that arrived half a second after a tap would otherwise send the very
      // sentence it was replacing.
      //
      // A reply says it again to the same person. The composer has the display, so
      // there is no open letter to read the address off any more; the draft is
      // carrying it, which is what makes it the thing to ask.
      if (draft) {
        const again = draft.kind === "reply" ? draft.to : "";
        discard();
        void startRecording(again);
        return;
      }
      // And a step in that has not been taken yet is dropped rather than left to
      // land in the middle of the recording it interrupted.
      disarmEnter();
      // What the sentence is going to be is settled here, by where the reader was
      // standing when they started talking rather than by anything in the words.
      // On one letter read whole it is an answer to that letter, and on one person
      // read whole it is a message to them — the same gesture, the same composer
      // and the same endpoint, because saying something to somebody who has not
      // written yet is not a different act from answering somebody who has.
      // Anywhere else in the app it is about the ground under them and the composer
      // asks which of the two things it is (see pages/compose.ts).
      //
      // Only on the letter or the person itself, and not on the list of either:
      // the list is what the wheel walks, and a hold there would be a message
      // addressed to whoever the reader happened to have rolled onto.
      const open = display.opened();
      const addressed = open?.group === LETTERS || open?.group === PEOPLE;
      void startRecording(addressed ? open.key : "");
      return;
    }

    if (eventType === OsEventTypeList.LONG_PRESS_RELEASE_EVENT) {
      if (recording) void finishRecording();
      return;
    }

    const eventSource = event.sysEvent?.eventSource;
    if (eventType == null && eventSource != null && eventSource !== EventSourceType.TOUCH_EVENT_FORM_DUMMY_NULL) {
      // The tap answers the composer, where it is the gesture that saves.
      if (draft) {
        armKeep();
        return;
      }
      // With a sentence in the air it is the way out, and it is taken at once:
      // both the tap and the double tap end with nothing saved, so the first
      // press of either costs the reader nothing they were keeping — and a way
      // out that hesitated would be a way out that felt broken.
      if (recording || transcribing) {
        cancel();
        return;
      }
      // Otherwise it is the way *in*, and it waits: the double tap that steps
      // back out begins with a press exactly like this one.
      armEnter();
      return;
    }

    if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      // While the question is up the double tap belongs to it rather than to
      // anything else. It arrives on top of the press that opened it, which is
      // still sitting in the timer waiting to be read as the answer; dropping
      // the draft takes that press with it (see discard).
      if (draft) {
        cancel();
        return;
      }
      // The press that began this double tap is still waiting to be read as a
      // step in. It is not one: this is the reader coming back out, and taking
      // the first press would have carried them one level further in first.
      disarmEnter();
      // Out of the entry, or out of the list. At the top there is nowhere left
      // to come back from, and the gesture is what it has always been there —
      // the standard Even exit.
      if (display.back()) {
        ensureVisible();
        return;
      }
      void bridge.shutDownPageContainer(1);
      return;
    }

    if (eventType === OsEventTypeList.SYSTEM_EXIT_EVENT || eventType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
      discard();
      // A letter half read when the app was closed is a letter half read. The
      // clock is stopped rather than left to say otherwise on the way out.
      window.clearTimeout(dwellTimer);
      dwellOn = "";
      void display.shutdown();
      return;
    }

    const pcm = event.audioEvent?.audioPcm;
    if (recording && pcm && pcm.byteLength > 0) {
      const copy = pcm.slice();
      audioChunks.push(copy);
      audioBytes += copy.byteLength;
    }
  });

  // The bearing, and only while it is on screen. These events arrive sixty times
  // a second, and the line they feed is one line of the standing page.
  subscribeSensors(() => {
    if (display.current() !== "here" || recording) return;
    const now = Date.now();
    if (now - sensorPaintAt < SENSOR_PAINT_MS) return;
    sensorPaintAt = now;
    render();
  });

  // On the minute, because the clock shows minutes: aligned to the wall clock
  // rather than to launch, so the face turns over when the minute does.
  function scheduleMinute(): void {
    window.setTimeout(
      () => {
        if (!recording) render();
        scheduleMinute();
      },
      60_000 - (Date.now() % 60_000) + 50,
    );
  }
  scheduleMinute();

  // lo's own beat: a fresh fix, published, everyone else's back with it, and what
  // has been left on the ground here since the last one.
  window.setInterval(() => {
    // Not while there is a sentence in the air. A reader holding the touchpad, or
    // reading back what they just said, is not a reader who needs the street
    // re-read underneath them — and the draft is filed at the fix it was spoken
    // at, so moving that fix now could only make the saving wrong.
    if (!api.signedIn || recording || transcribing || draft) return;
    void refresh();
    if (coords) void feeds.beat(coords, api.language);
  }, PRESENCE_MS);
}

main().catch((error) => {
  console.error(error);
  const root = document.querySelector<HTMLDivElement>("#app");
  if (root) root.innerHTML = `<div class="boot">lo could not start. Reopen it from Even App.</div>`;
});
