import {
  AppLocationAccuracy,
  EventSourceType,
  OsEventTypeList,
  waitForEvenAppBridge,
  type AppLocation,
} from "@evenrealities/even_hub_sdk";
import { LoApi } from "./api";
import { conditionPcm, transcribe } from "./audio";
import { createBrowserDisplay, createGlassesDisplay, type GlassesDisplay } from "./glasses";
import type { Coordinates, LocalResult, LoCard, LoUser } from "./types";
import { createWebUI, type WebUI } from "./webui";

const SAMPLE_RATE = 16_000;
const MIN_RECORDING_MS = 250;
const MAX_RECORDING_MS = 60_000;
const SINGLE_TAP_DELAY_MS = 650;
const SCROLL_COOLDOWN_MS = 380;
// How long the link key is left standing after a sign-in. Long enough for the
// WebView to have traded it for a session of its own on a slow phone tether,
// short enough that a password equivalent is not left sitting in that frame's
// URL for the rest of the session.
const LINK_KEY_TTL_MS = 60_000;

interface FeedState {
  local: LocalResult | null;
  nearby: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  trends: Array<Record<string, unknown>>;
  posts: Array<Record<string, unknown>>;
  people: Array<Record<string, unknown>>;
}

const feeds: FeedState = {
  local: null,
  nearby: [],
  events: [],
  trends: [],
  posts: [],
  people: [],
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compactLine(item: Record<string, unknown>, primary = "title"): string {
  const title = asText(item[primary]) || asText(item.body) || asText(item.name) || asText(item.place);
  const source = asText(item.source) || asText(item.username);
  return [title, source ? `— ${source}` : ""].filter(Boolean).join(" ");
}

function weatherName(code: number | null): string {
  if (code == null) return "Weather unavailable";
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorms";
}

function placeName(local: LocalResult | null): string {
  const place = local?.place;
  return [place?.locality, place?.name, place?.region].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(" · ") || "Your location";
}

function listLines(items: Array<Record<string, unknown>>, empty: string, limit = 4): string[] {
  const lines = items.map((item) => compactLine(item)).filter(Boolean).slice(0, limit);
  return lines.length ? lines : [empty];
}

function buildCards(api: LoApi, coords: Coordinates | null): LoCard[] {
  if (!coords || !feeds.local) return [];
  const local = feeds.local;
  const weather = local.weather;
  const current = weather?.current;
  const today = weather?.today;
  const units = weather?.units;
  const locale = api.language === "zh" ? "zh-CN" : api.language === "ja" ? "ja-JP" : "en-US";
  const timeZone = weather?.timezone?.id;
  const now = new Date();
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const date = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
  const accuracy = coords.accuracy != null ? `phone GPS · ±${Math.round(coords.accuracy)} m` : "phone GPS";

  const cards: LoCard[] = [
    {
      id: "now",
      label: "Now",
      title: placeName(local),
      hero: time,
      lines: [date, `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`],
      meta: accuracy,
    },
    {
      id: "weather",
      label: "Weather",
      title: weatherName(asNumber(current?.weatherCode)),
      hero: current?.temperature != null ? `${Math.round(current.temperature)}${units?.temperature ?? "°C"}` : "—",
      lines: [
        current?.apparent != null ? `Feels like ${Math.round(current.apparent)}${units?.temperature ?? "°C"}` : "",
        current?.humidity != null ? `Humidity ${Math.round(current.humidity)}%` : "",
        today?.tempMax != null && today?.tempMin != null
          ? `Today ${Math.round(today.tempMax)}° / ${Math.round(today.tempMin)}°`
          : "",
      ].filter(Boolean),
      meta: placeName(local),
    },
    {
      id: "people",
      label: "People",
      title: `${feeds.people.length} nearby`,
      lines: listLines(feeds.people, "Nobody nearby has shared a recent position.", 4),
      meta: "Positions are shared only while lo is open",
    },
    {
      id: "posts",
      label: "Posts",
      title: `${feeds.posts.length} around here`,
      lines: listLines(feeds.posts, "No posts nearby yet. Hold to leave the first one.", 4),
      meta: "Within 50 km · newest first",
    },
  ];

  const available = new Set(local.components ?? []);
  if (available.has("nearby")) {
    cards.push({
      id: "nearby",
      label: "Nearby",
      title: "What is happening",
      lines: listLines(feeds.nearby, "No local stories found.", 4),
      meta: placeName(local),
    });
  }
  if (available.has("events")) {
    cards.push({
      id: "events",
      label: "Events",
      title: "What is on",
      lines: listLines(feeds.events, "No upcoming events found.", 4),
      meta: placeName(local),
    });
  }
  if (available.has("trends")) {
    cards.push({
      id: "trends",
      label: "Trends",
      title: "What people are searching",
      lines: feeds.trends.length
        ? feeds.trends.slice(0, 5).map((item, index) => `${index + 1}. ${asText(item.name) || compactLine(item)}`)
        : ["No regional trends available."],
      meta: local.place?.region || local.place?.country || placeName(local),
    });
  }
  return cards;
}

function browserLocation(): Promise<Coordinates | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  });
}

async function main() {
  const bridge = await waitForEvenAppBridge();
  const api = new LoApi();
  let display: GlassesDisplay;
  try {
    display = await createGlassesDisplay(bridge);
  } catch (error) {
    console.info("Even display unavailable; using browser preview", error);
    display = createBrowserDisplay();
  }

  let ui!: WebUI;
  let user: LoUser | null = null;
  let coords: Coordinates | null = null;
  let cards: LoCard[] = [];
  let activeIndex = 0;
  let status = "connecting";
  let statusTimer = 0;
  let refreshTicket = 0;
  let lastScrollAt = 0;

  let burnTimer = 0;
  let recording = false;
  let recordingStartedAt = 0;
  let recordingTimer = 0;
  let audioChunks: Uint8Array[] = [];
  let audioBytes = 0;
  let pendingTapTimer = 0;

  function render() {
    cards = buildCards(api, coords);
    if (cards.length === 0) activeIndex = 0;
    else activeIndex = Math.min(activeIndex, cards.length - 1);
    ui.render(cards, activeIndex, status);
    display.render(cards, activeIndex, status === "ready" ? "" : status);
  }

  function setStatus(next: string, durationMs = 0) {
    window.clearTimeout(statusTimer);
    status = next;
    render();
    if (durationMs > 0) {
      statusTimer = window.setTimeout(() => setStatus("ready"), durationMs);
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

  async function refresh() {
    if (!user) {
      setStatus("sign in on phone");
      ui.showLogin();
      return;
    }
    const ticket = ++refreshTicket;
    setStatus("reading phone location");
    const nextCoords = await phoneLocation();
    if (ticket !== refreshTicket) return;
    if (!nextCoords) {
      setStatus("location unavailable");
      return;
    }
    coords = nextCoords;
    setStatus("loading nearby components");

    let dashboard;
    try {
      dashboard = await api.dashboard(coords);
    } catch (error) {
      console.error(error);
      setStatus("lo.gcc3.com unavailable");
      return;
    }
    if (ticket !== refreshTicket) return;
    feeds.local = dashboard.local;
    feeds.nearby = dashboard.nearby ?? [];
    feeds.events = dashboard.events ?? [];
    feeds.trends = dashboard.trends ?? [];
    feeds.posts = dashboard.posts ?? [];
    feeds.people = dashboard.people ?? [];
    setStatus("ready");
  }

  // The key has done its whole job the moment the WebView has traded it for a
  // session, so it is withdrawn rather than left standing. Withdrawing it signs
  // nobody out: the two sessions it opened — the frame's cookie and this frame's
  // bearer token — outlive the key that opened them.
  async function burnLinkKey() {
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

  async function login(username: string, password: string) {
    ui.setLoginBusy(true);
    try {
      const session = await api.login(username, password);
      user = session.user;
      // The password is spent here and goes no further, and neither does the key
      // it bought: nothing from this sign-in is written down. The key opens the
      // WebView, the token feeds the glasses, and both die with this launch.
      ui.setUser(user);
      ui.setKey(session.key);
      ui.hideLogin();
      window.clearTimeout(burnTimer);
      burnTimer = window.setTimeout(() => void burnLinkKey(), LINK_KEY_TTL_MS);
      await refresh();
    } catch (error) {
      // The error itself rather than a sentence about it: the screen asking is
      // lo's own, and it says what the server said in lo's own words — which
      // takes the code, not just the message (see webui showLogin).
      ui.showLogin(error);
      setStatus("sign in failed");
    } finally {
      ui.setLoginBusy(false);
    }
  }

  async function logout() {
    cancelRecording();
    // Before the session goes rather than after: withdrawing the key is spent on
    // the very token /api/logout is about to invalidate. If the minute has
    // already elapsed there is nothing left to withdraw.
    if (burnTimer) await burnLinkKey();
    await api.logout().catch(() => {});
    api.setToken("");
    ui.setKey("");
    user = null;
    coords = null;
    feeds.local = null;
    feeds.nearby = [];
    feeds.events = [];
    feeds.trends = [];
    feeds.posts = [];
    feeds.people = [];
    ui.setUser(null);
    setStatus("sign in on phone");
    ui.showLogin();
  }

  function select(index: number) {
    if (cards.length === 0) return;
    activeIndex = (index + cards.length) % cards.length;
    render();
  }

  async function recordLocation() {
    if (!user) {
      ui.showLogin();
      setStatus("sign in on phone");
      return;
    }
    setStatus("saving this place");
    const fix = await phoneLocation(true);
    if (!fix) {
      setStatus("location unavailable", 2200);
      return;
    }
    coords = fix;
    try {
      await api.createMark(fix);
      setStatus("✓ place saved", 2200);
    } catch (error) {
      console.error(error);
      setStatus("could not save place", 2200);
    }
  }

  async function startRecording() {
    window.clearTimeout(pendingTapTimer);
    pendingTapTimer = 0;
    if (recording || !user) {
      if (!user) {
        ui.showLogin();
        setStatus("sign in on phone");
      }
      return;
    }
    recording = true;
    recordingStartedAt = Date.now();
    audioChunks = [];
    audioBytes = 0;
    setStatus("● recording · release to post");
    const opened = await bridge.audioControl(true);
    if (!recording) {
      void bridge.audioControl(false);
      return;
    }
    if (!opened) {
      recording = false;
      setStatus("microphone unavailable", 2200);
      return;
    }
    recordingTimer = window.setTimeout(() => void finishRecording(), MAX_RECORDING_MS);
  }

  function cancelRecording() {
    if (!recording) return;
    recording = false;
    window.clearTimeout(recordingTimer);
    audioChunks = [];
    audioBytes = 0;
    void bridge.audioControl(false);
  }

  async function finishRecording() {
    if (!recording) return;
    recording = false;
    window.clearTimeout(recordingTimer);
    void bridge.audioControl(false);
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
      setStatus("ready");
      return;
    }

    const fixPromise = phoneLocation(true);
    setStatus("transcribing");
    try {
      const text = await transcribe(conditionPcm(raw), SAMPLE_RATE, api.language);
      if (!text) {
        setStatus("no speech heard", 2200);
        return;
      }
      setStatus("posting your message");
      const fix = (await fixPromise) ?? coords;
      if (!fix) {
        setStatus("location unavailable", 2200);
        return;
      }
      coords = fix;
      const result = await api.createPost(fix, text);
      feeds.posts = [result.post, ...feeds.posts.filter((post) => post.id !== result.post.id)];
      const preview = text.length > 34 ? `${text.slice(0, 33)}…` : text;
      setStatus(`✓ posted “${preview}”`, 3000);
    } catch (error) {
      console.error(error);
      setStatus("could not post message", 2500);
    }
  }

  ui = createWebUI(
    {
      onLogin: login,
      onLogout: logout,
      onRefresh: () => void refresh(),
      onSelect: select,
      // A language chosen on the sign-in screen is the language the glasses are
      // fed in too — the dashboard is asked for it by name, and the clock and the
      // date are formatted against it. Nothing is loaded yet when this is pressed,
      // so there is nothing to re-ask for: the first dashboard already goes out in
      // whichever language was last pressed.
      onLanguage: (language) => api.setLanguage(language),
    },
    // The same language the dashboard is asked for, so the sign-in screen and the
    // site behind it are reading from one list.
    api.language,
  );
  ui.setUser(null);
  render();

  // Every cold start asks for the password, because nothing from the last one
  // was written down. It has to work this way now that the key is withdrawn a
  // minute after each sign-in: no endpoint mints a key from a token, so a stored
  // token could bring the glasses back but never the WebView, and an app that is
  // half signed in is worse than one that asks.
  setStatus("sign in on phone");
  ui.showLogin();

  bridge.onEvenHubEvent((event) => {
    const eventType = event.textEvent?.eventType ?? event.listEvent?.eventType ?? event.sysEvent?.eventType;

    if (eventType === OsEventTypeList.SCROLL_TOP_EVENT || eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      const now = Date.now();
      if (now - lastScrollAt < SCROLL_COOLDOWN_MS) return;
      lastScrollAt = now;
      select(activeIndex + (eventType === OsEventTypeList.SCROLL_TOP_EVENT ? -1 : 1));
      return;
    }

    if (eventType === OsEventTypeList.LONG_PRESS_EVENT) {
      window.clearTimeout(pendingTapTimer);
      pendingTapTimer = 0;
      void startRecording();
      return;
    }

    if (eventType === OsEventTypeList.LONG_PRESS_RELEASE_EVENT) {
      if (recording) void finishRecording();
      return;
    }

    const eventSource = event.sysEvent?.eventSource;
    if (eventType == null && eventSource != null && eventSource !== EventSourceType.TOUCH_EVENT_FORM_DUMMY_NULL) {
      window.clearTimeout(pendingTapTimer);
      pendingTapTimer = window.setTimeout(() => {
        pendingTapTimer = 0;
        void recordLocation();
      }, SINGLE_TAP_DELAY_MS);
      return;
    }

    if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      window.clearTimeout(pendingTapTimer);
      pendingTapTimer = 0;
      void bridge.shutDownPageContainer(1);
      return;
    }

    if (eventType === OsEventTypeList.SYSTEM_EXIT_EVENT || eventType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
      cancelRecording();
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

  window.setInterval(() => {
    if (cards.length > 0 && !recording) render();
  }, 30_000);
}

main().catch((error) => {
  console.error(error);
  const root = document.querySelector<HTMLDivElement>("#app");
  if (root) root.innerHTML = `<div class="boot">lo could not start. Reopen it from Even App.</div>`;
});
