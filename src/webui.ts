import type { LoCard, LoUser } from "./types";
import { trackVisualViewport } from "./viewport";
import "./styles.css";

const SITE_URL = "https://lo.gcc3.com";

export interface WebUIActions {
  onLogin(username: string, password: string): Promise<void>;
  onLogout(): Promise<void>;
  onRefresh(): void;
  onSelect(index: number): void;
}

export interface WebUI {
  setUser(user: LoUser | null): void;
  setKey(key: string): void;
  showLogin(error?: string): void;
  hideLogin(): void;
  setLoginBusy(busy: boolean): void;
  render(cards: LoCard[], activeIndex: number, status: string): void;
}

// The phone view is the website itself. Nothing on this side draws lo any more;
// the outer frame exists only to hold the Even bridge and feed the glasses, so
// the two WebUI calls that used to paint the phone are now no-ops.
//
// What the outer frame still has to do is get a credential, because a WebView on
// an Even Hub origin can never be handed lo's cookie. The modal below asks for
// the password once and trades it for the account's link key, and that one key
// then serves both sides: `?k=` carries it into the WebView, where lo signs
// itself in the way any followed link does, and the same key buys the outer
// frame its own bearer token so the dashboard API can go on feeding the glasses.
export function createWebUI(actions: WebUIActions): WebUI {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) throw new Error("#app element not found");

  // Before the frame is written, so its first layout is already the right size.
  trackVisualViewport();

  // The frame starts blank on purpose. Pointed at the site before a key exists,
  // it would draw lo's own login screen behind the modal — two sign-in forms on
  // one screen, only one of which the glasses can hear about.
  root.innerHTML = `
    <iframe
      class="frame"
      data-frame
      title="lo"
      allow="geolocation; microphone"
      hidden
    ></iframe>

    <div class="modal" data-login-modal role="dialog" aria-modal="true" aria-labelledby="login-title">
      <form class="login" data-login-form>
        <p class="login__brand">lo for Even</p>
        <h2 id="login-title">Sign in on your phone</h2>
        <p class="login__copy">Use the same account as lo.gcc3.com. Your session stays on this device.</p>
        <label>
          <span>Username</span>
          <input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="32" />
        </label>
        <label>
          <span>Password</span>
          <input name="password" type="password" autocomplete="current-password" required maxlength="64" />
        </label>
        <p class="login__error" data-login-error></p>
        <button class="primary-button" data-login-submit type="submit">Continue</button>
      </form>
    </div>
  `;

  const frame = root.querySelector<HTMLIFrameElement>("[data-frame]")!;
  const modal = root.querySelector<HTMLDivElement>("[data-login-modal]")!;
  const form = root.querySelector<HTMLFormElement>("[data-login-form]")!;
  const loginError = root.querySelector<HTMLParagraphElement>("[data-login-error]")!;
  const loginSubmit = root.querySelector<HTMLButtonElement>("[data-login-submit]")!;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const username = String(data.get("username") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!username || !password) return;
    loginError.textContent = "";
    await actions.onLogin(username, password);
  });

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
    showLogin(error = "") {
      loginError.textContent = error;
      modal.classList.add("modal--open");
      window.setTimeout(() => {
        const username = form.elements.namedItem("username");
        if (username instanceof HTMLElement) username.focus();
      }, 0);
    },
    hideLogin() {
      modal.classList.remove("modal--open");
      loginError.textContent = "";
      form.reset();
    },
    setLoginBusy(busy) {
      loginSubmit.disabled = busy;
      loginSubmit.textContent = busy ? "Signing in…" : "Continue";
    },
    render() {},
  };
}
