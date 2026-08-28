import type { Coordinates, LocalResult, LoUser } from "../types";

const API_BASE = "https://lo.gcc3.com";

export type Language = "en" | "ja" | "zh";

// The key lo keeps its own choice under (see lo/src/i18n/index.js), and the same
// order of preference behind it: what was chosen last, else the phone's own
// language where lo has words for it. It is the one thing this frame writes down.
// A language is not a credential, and a reader who has said ZH once and is asked
// again at the next launch has been shown a bug rather than a preference.
const LANGUAGE_KEY = "lang";

function savedLanguage(): Language | null {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    return saved === "en" || saved === "ja" || saved === "zh" ? saved : null;
  } catch {
    // A WebView with storage denied still has a language; it just cannot keep it.
    return null;
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface Session {
  token: string;
  // The account's link key, which is how the WebView frame is entered: `?k=`.
  // It is never stored, and it is withdrawn a minute after this sign-in, once
  // the frame has traded it for a session of its own.
  key: string;
  user: LoUser;
}

export class LoApi {
  private token = "";
  // Which language everything the glasses are fed comes back in, and the one the
  // sign-in screen is read in. Not readonly: the switcher in that screen's corner
  // is the same control lo has in its own, and a language chosen there is the
  // language the dashboard should arrive in.
  language: Language;

  constructor() {
    const browser = navigator.language.toLowerCase();
    this.language =
      savedLanguage() ?? (browser.startsWith("ja") ? "ja" : browser.startsWith("zh") ? "zh" : "en");
  }

  setLanguage(language: Language) {
    this.language = language;
    try {
      localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // Kept for this launch either way.
    }
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
    if (options.body && typeof options.body === "string") headers.set("Content-Type", "application/json");

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (response.status === 204) return undefined as T;
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new ApiError(
        typeof data.error === "string" ? data.error : `Request failed (${response.status})`,
        response.status,
        typeof data.code === "string" ? data.code : undefined,
      );
    }
    return data as T;
  }

  async login(username: string, password: string): Promise<Session> {
    const session = await this.request<Session>("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    this.setToken(session.token);
    return session;
  }

  // Withdrawing the link key, once the WebView has finished spending it. It
  // takes the key out of the account altogether; neither session the key opened
  // is touched, so this signs nobody out of anything.
  revokeLinkKey() {
    return this.request<void>("/api/me/link", { method: "DELETE" });
  }

  logout() {
    return this.request<void>("/api/logout", { method: "POST" });
  }

  dashboard(coords: Coordinates) {
    return this.request<{
      local: LocalResult;
      nearby?: Array<Record<string, unknown>>;
      events?: Array<Record<string, unknown>>;
      trends?: Array<Record<string, unknown>>;
      posts?: Array<Record<string, unknown>>;
      people?: Array<Record<string, unknown>>;
    }>(`/api/dashboard?lang=${this.language}`, {
      method: "POST",
      body: JSON.stringify(coords),
    });
  }

  createMark(coords: Coordinates) {
    return this.request<{ mark: Record<string, unknown> }>(`/api/marks?lang=${this.language}`, {
      method: "POST",
      body: JSON.stringify({ ...coords, time: new Date().toISOString() }),
    });
  }

  createPost(coords: Coordinates, body: string) {
    return this.request<{ post: Record<string, unknown> }>(`/api/posts?lang=${this.language}`, {
      method: "POST",
      body: JSON.stringify({ ...coords, body, time: new Date().toISOString() }),
    });
  }

}
