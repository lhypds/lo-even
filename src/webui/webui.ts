import { isLanguage, type Language } from "../i18n";
import type { Coordinates, LoUser } from "../types";
import { trackVisualViewport } from "../utils/viewport";
import { createLogin, type LoginScreen } from "./login";
import "./styles.css";

const SITE_URL = "https://lo.gcc3.com";
// The same address as an origin, which is the form a message arrives labelled
// with and the only thing that says a message came from the site rather than
// from whatever else can reach this window.
const SITE_ORIGIN = new URL(SITE_URL).origin;

export interface WebUIActions {
  // The first step of the sign-in, which asks lo about the name rather than
  // signing anybody in (see login.ts).
  onCheckUsername(username: string): Promise<{ hasPassword: boolean }>;
  onLogin(username: string, password: string): Promise<void>;
  // The same press on a name nobody is using, which the reader has said to open.
  onCreate(username: string, password: string): Promise<void>;
  onLogout(): Promise<void>;
  onRefresh(): void;
  onLanguage(language: Language): void;
  // Where the site has just read that it is, which is where this side is too.
  // `at` is when the sensor answered rather than when the line arrived, so a fix
  // that spent a moment crossing the frame is still the age it actually is.
  onFix(coords: Coordinates, at: number): void;
  // One answer the site has had from lo, which is an answer this side was going
  // to ask for. `feed` is the name the store holds it under, and the two beside
  // it are the question it answers: the ground it is about, where it is about
  // any, and the language it was asked in.
  onFeed(feed: string, coords: Coordinates | null, language: string, data: unknown): void;
}

export interface WebUI {
  setUser(user: LoUser | null): void;
  setKey(key: string): void;
  showLogin(error?: unknown): void;
  hideLogin(): void;
  setLoginBusy(busy: boolean): void;
  /**
   * One line of this package's own, over the top of lo's site. Empty takes it
   * away.
   *
   * It exists for the one fault this app cannot report where it happens: a launch
   * whose glasses would not take a page. Everything else that goes wrong is said
   * on the display, because the display is the app; when the display is what is
   * missing there is one screen left, and it is this one (see main.ts).
   */
  setNotice(message: string): void;
}

/**
 * A position off the frame, taken apart — the fix the site has read, or the
 * ground one of its answers is about. A latitude and a longitude are the whole of
 * what is required; the other three are a reading or nothing, which is the
 * bargain every fix in this app is read under — a device that cannot claim an
 * altitude says so by not claiming one (see main.ts). Anything here that is not a
 * finite number is nothing, whatever the site meant by it.
 */
function readCoords(value: unknown): Coordinates | null {
  const number = (from: unknown): number | null =>
    typeof from === "number" && Number.isFinite(from) ? from : null;
  if (typeof value !== "object" || value === null) return null;
  const fix = value as Record<string, unknown>;
  const latitude = number(fix.latitude);
  const longitude = number(fix.longitude);
  if (latitude === null || longitude === null) return null;
  return {
    latitude,
    longitude,
    accuracy: number(fix.accuracy) ?? undefined,
    altitude: number(fix.altitude),
    speed: number(fix.speed),
  };
}

/**
 * That, and the site's own stamp on it: when its sensor answered, rather than
 * when the line landed here — the freshness test at the far end is about the age
 * of the reading and not the age of the message. A line carrying no usable stamp
 * is taken as having been read on arrival, which is the oldest a message that has
 * just crossed a frame could honestly be.
 */
function readFix(value: unknown): { coords: Coordinates; at: number } | null {
  const coords = readCoords(value);
  if (!coords) return null;
  const at = (value as { at?: unknown }).at;
  return { coords, at: typeof at === "number" && Number.isFinite(at) ? at : Date.now() };
}

// The phone view is the website itself. Nothing on this side draws lo any more,
// and nothing on this side knows what the glasses are showing either: the cards
// and where the reader has got to among them belong to the display (see
// glassesui/glasses.ts), which is why this no longer takes a render call.
//
// What the outer frame still has to do is get a credential, because a WebView on
// an Even Hub origin can never be handed lo's cookie. The screen in login.ts asks
// for the password once and trades it for two: a bearer token, which stays out
// here and authenticates every read that feeds the glasses, and the account's
// link key, which `?k=` carries into the frame below, where lo signs itself in
// the way any followed link does.
//
// Once, being the point of it. The token is written down and every launch after
// this one comes back on it, minting a fresh key for the frame on the way past
// (see main.ts) — so the screen in login.ts is what a first launch and a signed-
// out one see, and nothing else does.
export function createWebUI(actions: WebUIActions, language: Language = "en"): WebUI {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) throw new Error("#app element not found");

  // Before the frame is written, so its first layout is already the right size.
  trackVisualViewport();

  // The frame starts blank on purpose. Pointed at the site before a key exists,
  // it would draw lo's own login screen behind the one login.ts puts up — the
  // same screen twice, only one of which the glasses can hear about.
  // The notice is written after the frame and before the sign-in screen, which is
  // the order the three of them stand in: lo's site at the bottom, this package's
  // one line over it, and the screen that asks for a password over both.
  root.innerHTML = `
    <iframe
      class="frame"
      data-frame
      title="lo"
      allow="geolocation; microphone"
      hidden
    ></iframe>
    <p class="notice" data-notice role="status" hidden></p>
  `;

  const frame = root.querySelector<HTMLIFrameElement>("[data-frame]")!;
  const notice = root.querySelector<HTMLParagraphElement>("[data-notice]")!;

  // After the frame, so it stands over it in the document as well as in the
  // stacking order.
  const login: LoginScreen = createLogin(
    root,
    {
      onCheckUsername: (username) => actions.onCheckUsername(username),
      onSubmit: (username, password) => actions.onLogin(username, password),
      onCreate: (username, password) => actions.onCreate(username, password),
      onLanguage: (next) => actions.onLanguage(next),
    },
    language,
  );

  for (const eventName of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(eventName, (event) => event.preventDefault(), { passive: false });
  }

  // What the site has to say back to the frame it is in. The first two are the
  // same shape of problem: the phone view is lo's own website, the reader acts on
  // it there, and this side would never hear about it. Two origins, two tokens,
  // and no cookie between them.
  //
  // `logout` — the sign-out button in the frame is lo's own, so a reader who
  // presses it signs out of the frame alone. The session out here is a second
  // one, minted at the same sign-in against the same account. Left to itself this
  // frame would go on feeding the glasses from a signed-out phone, and would
  // still be holding a written-down token to come back on at the next launch.
  //
  // `setlang` — the switcher in the corner of the frame is lo's own too, and the
  // words on the display are drawn from a list on this side (see
  // i18n/translations.ts) against feeds asked for in a language this side keeps.
  // A reader who picks ZH on the phone means the glasses as well; without this
  // they would get a site in one language and a display in another.
  //
  // `fix` — not a problem of any kind, but work already done. The site reads the
  // phone's position twice a minute to draw its own dashboard, and this side was
  // reading it again on a beat of its own to feed the glasses: one pocket, one
  // GPS, two apps waking it, and the second of them told what the first had just
  // been told. What lands here is that reading, and the read this side would have
  // made is dropped for as long as they keep arriving (see main.ts).
  //
  // `feed` — the same thing one layer up. Two clients of one server on one phone
  // ask it most of the same questions: the place, the sky, what is on, where to
  // eat, what is on the ground here, who else is standing on it. Every answer the
  // site lands it posts up (see `shared` in lo/src/api.js), and the store keeps
  // it under the same key the request would have carried — so the request is
  // simply never made (see services/feeds.ts). What the site does not send is
  // anything addressed to the reader in person, which is why the inbox is still
  // this side's own read.
  //
  // So lo posts a line for each (see lo/src/utils/host.js) and this is where they
  // land. Three things have to be true before any of them is acted on: it came
  // from lo's origin, it came from the frame this file put there rather than from
  // any other window holding a handle on this one, and it is one of the notices
  // this frame listens for. A message port is a door, and it is worth being this
  // dull about who is allowed through it.
  window.addEventListener("message", (event) => {
    if (event.origin !== SITE_ORIGIN || event.source !== frame.contentWindow) return;
    const message = event.data as {
      source?: unknown;
      type?: unknown;
      language?: unknown;
      fix?: unknown;
      feed?: unknown;
      lang?: unknown;
      coords?: unknown;
      data?: unknown;
    } | null;
    if (message?.source !== "lo") return;

    if (message.type === "logout") {
      void actions.onLogout();
      return;
    }

    if (message.type === "fix") {
      const fix = readFix(message.fix);
      if (fix) actions.onFix(fix.coords, fix.at);
      return;
    }

    if (message.type === "feed") {
      // Passed on as the site said it, rather than checked against this side's
      // three: lo reads in six, and the language belongs to the question rather
      // than to this app. An answer looked up in French is no answer to one asked
      // in English and the store will not take it — but what is in force and who
      // is about are answers in no language at all, and those it takes from a
      // site being read in any of the six (see services/feeds.ts).
      if (typeof message.feed !== "string" || typeof message.lang !== "string") return;
      actions.onFeed(message.feed, readCoords(message.coords), message.lang, message.data);
      return;
    }

    if (message.type === "setlang" && isLanguage(message.language)) {
      const next = message.language;
      // Both halves of this side, because both were following the old one: the
      // glasses, which is the whole point of the notice, and the sign-in screen
      // standing behind this frame, which is what the reader would be looking at
      // in the stale language the next time they signed out.
      actions.onLanguage(next);
      login.setLanguage(next);
    }
  });

  return {
    setUser() {},
    setKey(key) {
      // Two things this compare is careful about. It reads the attribute we last
      // set rather than wherever the site has navigated since, because lo strips
      // `?k=` out of its own address bar the moment it has spent it and writing
      // the same src back over that would be a sign-out dressed as a refresh.
      // And it goes to about:blank on the way out rather than dropping the src,
      // because signing out has to actually navigate the site away — otherwise
      // the session it is still holding carries on behind a hidden element.
      const next = key ? `${SITE_URL}/?k=${encodeURIComponent(key)}` : "about:blank";
      if (frame.getAttribute("src") !== next) frame.setAttribute("src", next);
      frame.hidden = !key;
    },
    showLogin(error) {
      login.show(error);
    },
    hideLogin() {
      login.hide();
    },
    setLoginBusy(busy) {
      login.setBusy(busy);
    },
    setNotice(message) {
      notice.textContent = message;
      notice.hidden = !message;
    },
  };
}
