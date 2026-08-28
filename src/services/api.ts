import type {
  Coordinates,
  Language,
  LoFeedResult,
  LoLocal,
  LoPerson,
  LoPost,
  LoTrendsResult,
  LoUser,
  LoWarningsResult,
} from "../types";

const API_BASE = "https://lo.gcc3.com";

// Re-exported because the sign-in screen and the language switcher in its corner
// have always imported it from here, and the list itself now lives with the rest
// of lo's shapes (see types.ts).
export type { Language } from "../types";

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

/**
 * lo's API, as the glasses use it.
 *
 * There is no endpoint here that the website does not also call. `POST
 * /api/dashboard` — the one read added for this package, which collapsed seven
 * questions into one round trip — is gone from this side: the glasses now ask
 * for what the card in front of the reader actually needs, when they need it
 * (see feeds.ts). The endpoint is still on the server and still answers; nothing
 * over there had to change.
 *
 * What that trade buys is worth stating. The dashboard read fetched the news,
 * the events and the trends for every launch whether or not anyone scrolled far
 * enough to see them — three upstream lookups per fix, on a phone tether, for
 * cards that are four flicks away. Asking per card costs an extra round trip the
 * first time one is looked at and nothing at all for the ones that never are.
 */
export class LoApi {
  private token = "";
  // Which language everything the glasses are fed comes back in, and the one the
  // sign-in screen is read in. Not readonly: the switcher in that screen's corner
  // is the same control lo has in its own.
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

  get signedIn(): boolean {
    return Boolean(this.token);
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

  // Every location endpoint answers in the language the glasses are read in, so
  // the place name in the footer matches the words above it.
  private geo({ latitude, longitude }: Coordinates): string {
    return `lat=${latitude}&lon=${longitude}&lang=${this.language}`;
  }

  /* ------------------------------------------------------------ the session */

  async login(username: string, password: string): Promise<Session> {
    const session = await this.request<Session>("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    this.setToken(session.token);
    return session;
  }

  // Withdrawing the link key, once the WebView has finished spending it. It takes
  // the key out of the account altogether; neither session the key opened is
  // touched, so this signs nobody out of anything.
  revokeLinkKey() {
    return this.request<void>("/api/me/link", { method: "DELETE" });
  }

  logout() {
    return this.request<void>("/api/logout", { method: "POST" });
  }

  /* -------------------------------------------------------------- the place */

  /**
   * Where this is, its weather, and which of the regional cards this country can
   * feed. One read rather than three, because it is one answer: the components
   * list is derived from the place, and the clock cannot draw its zone without
   * the weather. Every card on the opening screens is fed from this.
   */
  local(coords: Coordinates) {
    return this.request<LoLocal>(`/api/local?${this.geo(coords)}`);
  }

  /* --------------------------------------------------------- the wider place */

  nearby(coords: Coordinates) {
    return this.request<LoFeedResult>(`/api/nearby?${this.geo(coords)}`);
  }

  events(coords: Coordinates) {
    return this.request<LoFeedResult>(`/api/events?${this.geo(coords)}`);
  }

  trends(coords: Coordinates) {
    return this.request<LoTrendsResult>(`/api/trends?${this.geo(coords)}`);
  }

  // The one reading that does not take the interface language: Yahoo answers in
  // Japanese, and the words the card can translate it translates itself.
  warnings({ latitude, longitude }: Coordinates) {
    return this.request<LoWarningsResult>(`/api/warnings?lat=${latitude}&lon=${longitude}`);
  }

  /* --------------------------------------------------------- people and posts */

  /**
   * Telling the server where we are and asking who else is out, which is one
   * question a minute apart rather than two — the same trade the website makes.
   * The unread figure rides along because the same read already knows it.
   */
  publishPosition({ latitude, longitude, accuracy }: Coordinates) {
    return this.request<{ people: LoPerson[]; unread: number }>("/api/position", {
      method: "PUT",
      body: JSON.stringify({ latitude, longitude, accuracy }),
    });
  }

  posts(coords: Coordinates) {
    return this.request<{ posts: LoPost[] }>(`/api/posts?${this.geo(coords)}`);
  }

  /* ------------------------------------------------------------ the two verbs */

  createMark(coords: Coordinates) {
    return this.request<{ mark: Record<string, unknown> }>(`/api/marks?lang=${this.language}`, {
      method: "POST",
      body: JSON.stringify({ ...coords, time: new Date().toISOString() }),
    });
  }

  createPost(coords: Coordinates, body: string) {
    return this.request<{ post: LoPost }>(`/api/posts?lang=${this.language}`, {
      method: "POST",
      body: JSON.stringify({ ...coords, body, time: new Date().toISOString() }),
    });
  }
}
