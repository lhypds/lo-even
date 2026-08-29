import type { Language } from "../services/api";
import type { LoUser } from "../types";
import { trackVisualViewport } from "../utils/viewport";
import { createLogin, type LoginScreen } from "./login";
import "./styles.css";

const SITE_URL = "https://lo.gcc3.com";
// The same address as an origin, which is the form a message arrives labelled
// with and the only thing that says a message came from the site rather than
// from whatever else can reach this window.
const SITE_ORIGIN = new URL(SITE_URL).origin;

// The languages this package has words for, which is the same three lo has. A
// `setlang` naming anything else is a message from a newer site than this build,
// and the display has nothing to draw it in — so it is dropped rather than
// followed into a screen of missing strings.
const LANGUAGES = new Set<string>(["en", "ja", "zh"]);

export interface WebUIActions {
  // The first step of the sign-in, which asks lo about the name rather than
  // signing anybody in (see login.ts).
  onCheckUsername(username: string): Promise<void>;
  onLogin(username: string, password: string): Promise<void>;
  onLogout(): Promise<void>;
  onRefresh(): void;
  onLanguage(language: Language): void;
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
      onLanguage: (next) => actions.onLanguage(next),
    },
    language,
  );

  for (const eventName of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(eventName, (event) => event.preventDefault(), { passive: false });
  }

  // What the site has to say back to the frame it is in. Both notices are the
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
  // glassesui/strings.ts) against feeds asked for in a language this side keeps.
  // A reader who picks ZH on the phone means the glasses as well; without this
  // they would get a site in one language and a display in another.
  //
  // So lo posts a line for each (see lo/src/utils/host.js) and this is where they
  // land. Three things have to be true before either is acted on: it came from
  // lo's origin, it came from the frame this file put there rather than from any
  // other window holding a handle on this one, and it is one of the two notices
  // this frame listens for. A message port is a door, and it is worth being this
  // dull about who is allowed through it.
  window.addEventListener("message", (event) => {
    if (event.origin !== SITE_ORIGIN || event.source !== frame.contentWindow) return;
    const message = event.data as { source?: unknown; type?: unknown; language?: unknown } | null;
    if (message?.source !== "lo") return;

    if (message.type === "logout") {
      void actions.onLogout();
      return;
    }

    if (message.type === "setlang" && typeof message.language === "string" && LANGUAGES.has(message.language)) {
      const next = message.language as Language;
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
