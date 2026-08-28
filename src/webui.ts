import type { LoCard, LoUser } from "./types";
import "./styles.css";

export interface WebUIActions {
  onLogin(username: string, password: string): Promise<void>;
  onLogout(): Promise<void>;
  onRefresh(): void;
  onSelect(index: number): void;
}

export interface WebUI {
  setUser(user: LoUser | null): void;
  showLogin(error?: string): void;
  hideLogin(): void;
  setLoginBusy(busy: boolean): void;
  render(cards: LoCard[], activeIndex: number, status: string): void;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cardHtml(card: LoCard, index: number, activeIndex: number): string {
  return `
    <button class="component ${index === activeIndex ? "component--active" : ""}" data-card-index="${index}" type="button">
      <span class="component__top">
        <span class="component__label">${escapeHtml(card.label)}</span>
        <span class="component__index">${String(index + 1).padStart(2, "0")}</span>
      </span>
      <span class="component__title">${escapeHtml(card.title)}</span>
      ${card.hero ? `<span class="component__hero">${escapeHtml(card.hero)}</span>` : ""}
      <span class="component__lines">
        ${card.lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
      </span>
      ${card.meta ? `<span class="component__meta">${escapeHtml(card.meta)}</span>` : ""}
    </button>`;
}

export function createWebUI(actions: WebUIActions): WebUI {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) throw new Error("#app element not found");

  root.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div class="wordmark" aria-label="lo">lo<span class="wordmark__dot"></span></div>
        <div class="topbar__actions">
          <button class="bar-button" data-refresh type="button">Refresh</button>
          <button class="bar-button" data-account type="button">Sign in</button>
        </div>
      </header>

      <section class="stage" aria-live="polite">
        <div class="stage__head">
          <div>
            <p class="stage__eyebrow">EVEN G2 / LIVE</p>
            <h1>Here, now.</h1>
          </div>
          <span class="status" data-status>connecting</span>
        </div>
        <p class="stage__intro">Scroll on the glasses to move through the same components shown here.</p>
        <div class="component-stack" data-components></div>
      </section>

      <footer class="gesture-bar">
        <span><b>tap</b> save place</span>
        <span><b>hold</b> speak &amp; post</span>
      </footer>
    </main>

    <div class="modal modal--open" data-login-modal role="dialog" aria-modal="true" aria-labelledby="login-title">
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

  const components = root.querySelector<HTMLDivElement>("[data-components]")!;
  const status = root.querySelector<HTMLSpanElement>("[data-status]")!;
  const account = root.querySelector<HTMLButtonElement>("[data-account]")!;
  const modal = root.querySelector<HTMLDivElement>("[data-login-modal]")!;
  const form = root.querySelector<HTMLFormElement>("[data-login-form]")!;
  const loginError = root.querySelector<HTMLParagraphElement>("[data-login-error]")!;
  const loginSubmit = root.querySelector<HTMLButtonElement>("[data-login-submit]")!;
  let currentUser: LoUser | null = null;

  root.querySelector("[data-refresh]")!.addEventListener("click", actions.onRefresh);
  account.addEventListener("click", () => {
    if (currentUser) void actions.onLogout();
    else modal.classList.add("modal--open");
  });
  components.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-card-index]");
    if (target) actions.onSelect(Number(target.dataset.cardIndex));
  });
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
    setUser(user) {
      currentUser = user;
      account.textContent = user ? `@${user.username} · out` : "Sign in";
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
    render(cards, activeIndex, message) {
      status.textContent = message || "ready";
      status.classList.toggle("status--active", Boolean(message && message !== "ready"));
      components.innerHTML = cards.length
        ? cards.map((card, index) => cardHtml(card, index, activeIndex)).join("")
        : `<div class="empty-state"><span>Waiting for your phone</span><p>Sign in and allow location to build your view.</p></div>`;
      const selected = components.querySelector<HTMLElement>(".component--active");
      selected?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
  };
}
