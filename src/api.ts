import type { Coordinates, LocalResult, LoUser } from "./types";

const API_BASE = "https://lo.gcc3.com";

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
  user: LoUser;
}

export class LoApi {
  private token = "";
  readonly language: "en" | "ja" | "zh";

  constructor() {
    const language = navigator.language.toLowerCase();
    this.language = language.startsWith("ja") ? "ja" : language.startsWith("zh") ? "zh" : "en";
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

  session() {
    return this.request<{ user: LoUser }>("/api/session");
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
