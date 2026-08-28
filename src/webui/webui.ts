import type { Language } from "../services/api";
import type { LoUser } from "../types";
import { trackVisualViewport } from "../utils/viewport";
import { createLogin, type LoginScreen } from "./login";
import "./styles.css";

const SITE_URL = "https://lo.gcc3.com";

export interface WebUIActions {
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
}

// The phone view is the website itself. Nothing on this side draws lo any more,
// and nothing on this side knows what the glasses are showing either: the cards
// and where the reader has got to among them belong to the display (see
// glassesui/glasses.ts), which is why this no longer takes a render call.
//
// What the outer frame still has to do is get a credential, because a WebView on
// an Even Hub origin can never be handed lo's cookie. The screen in login.ts asks
// for the password once and trades it for the account's link key, and that one key
// then serves both sides: `?k=` carries it into the frame below, where lo signs
// itself in the way any followed link does, and the same key buys this frame its
// own bearer token so the reads that feed the glasses can be authenticated.
export function createWebUI(actions: WebUIActions, language: Language = "en"): WebUI {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) throw new Error("#app element not found");

  // Before the frame is written, so its first layout is already the right size.
  trackVisualViewport();

  // The frame starts blank on purpose. Pointed at the site before a key exists,
  // it would draw lo's own login screen behind the one login.ts puts up — the
  // same screen twice, only one of which the glasses can hear about.
  root.innerHTML = `
    <iframe
      class="frame"
      data-frame
      title="lo"
      allow="geolocation; microphone"
      hidden
    ></iframe>
  `;

  const frame = root.querySelector<HTMLIFrameElement>("[data-frame]")!;

  // After the frame, so it stands over it in the document as well as in the
  // stacking order.
  const login: LoginScreen = createLogin(
    root,
    {
      onSubmit: (username, password) => actions.onLogin(username, password),
      onLanguage: (next) => actions.onLanguage(next),
    },
    language,
  );

  for (const eventName of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(eventName, (event) => event.preventDefault(), { passive: false });
  }

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
  };
}
