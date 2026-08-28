import {
  AppLocationAccuracy,
  EventSourceType,
  OsEventTypeList,
  waitForEvenAppBridge,
  type AppLocation,
} from "@evenrealities/even_hub_sdk";
import { LoApi } from "./services/api";
import { Feeds } from "./services/feeds";
import { conditionPcm, transcribe } from "./utils/audio";
import { sensorState, startSensors, subscribeSensors } from "./utils/sensors";
import { createBrowserDisplay, createGlassesDisplay, type GlassesDisplay } from "./glassesui/glasses";
import type { CardContext } from "./glassesui/cards/types";
import { localeFor } from "./glassesui/format";
import { translator } from "./glassesui/strings";
import type { Coordinates, LoUser } from "./types";
import { createWebUI, type WebUI } from "./webui/webui";

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
  try {
    display = await createGlassesDisplay(bridge, t("glasses.connecting"));
  } catch (error) {
    console.info("Even display unavailable; using browser preview", error);
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
  let pendingTapTimer = 0;
  let lastScrollAt = 0;
  let sensorPaintAt = 0;

  // Every feed answers back through here, so a card that was waiting redraws the
  // moment its answer lands rather than on the next beat of anything.
  const feeds = new Feeds(api, () => render());

  function buildContext(): CardContext {
    return {
      now: new Date(),
      language: api.language,
      locale: localeFor(api.language),
      t,
      coords,
      fixAt,
      place: feeds.local.data?.place ?? null,
      weather: feeds.local.data?.weather ?? null,
      components: feeds.components,
      posts: feeds.posts,
      people: feeds.people,
      nearby: feeds.nearby,
      events: feeds.events,
      trends: feeds.trends,
      warnings: feeds.warnings,
      heading: sensorState(),
      username: user?.username ?? null,
    };
  }

  // The card in front of the reader is the one worth paying for. Called after
  // every paint and every scroll; the feed store decides whether that is
  // actually a new question (see feeds.ts) and does nothing when it is not.
  function ensureVisible(): void {
    const cardId = display.current();
    if (cardId && coords && api.signedIn) feeds.ensure(cardId, coords, api.language);
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
   * A fix, and the three reads that hang off one. Everything else waits until the
   * reader scrolls to it.
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
      // A card already in view whose feed is keyed on a fix that has now moved
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
      // lo's own, and it says what the server said in lo's own words.
      ui.showLogin(error);
      setStatus(t("glasses.signIn"));
    } finally {
      ui.setLoginBusy(false);
    }
  }

  async function logout(): Promise<void> {
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
    fixAt = null;
    feeds.clear();
    ui.setUser(null);
    setStatus(t("glasses.signIn"));
    ui.showLogin();
  }

  async function recordLocation(): Promise<void> {
    if (!api.signedIn) {
      ui.showLogin();
      setStatus(t("glasses.signIn"));
      return;
    }
    setStatus(t("mark.saving"));
    const fix = await phoneLocation(true);
    if (!fix) {
      setStatus(t("glasses.noFix"), 2200);
      return;
    }
    coords = fix;
    fixAt = Date.now();
    try {
      await api.createMark(fix);
      setStatus(`✓ ${t("mark.saved")}`, 2200);
    } catch (error) {
      console.error(error);
      setStatus(t("glasses.markFailed"), 2200);
    }
  }

  async function startRecording(): Promise<void> {
    window.clearTimeout(pendingTapTimer);
    pendingTapTimer = 0;
    if (recording || !api.signedIn) {
      if (!api.signedIn) {
        ui.showLogin();
        setStatus(t("glasses.signIn"));
      }
      return;
    }
    recording = true;
    recordingStartedAt = Date.now();
    audioChunks = [];
    audioBytes = 0;
    setStatus(`● ${t("glasses.recording")}`);
    const opened = await bridge.audioControl(true);
    if (!recording) {
      void bridge.audioControl(false);
      return;
    }
    if (!opened) {
      recording = false;
      setStatus(t("glasses.postFailed"), 2200);
      return;
    }
    recordingTimer = window.setTimeout(() => void finishRecording(), MAX_RECORDING_MS);
  }

  function cancelRecording(): void {
    if (!recording) return;
    recording = false;
    window.clearTimeout(recordingTimer);
    audioChunks = [];
    audioBytes = 0;
    void bridge.audioControl(false);
  }

  async function finishRecording(): Promise<void> {
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
      setStatus("");
      return;
    }

    const fixPromise = phoneLocation(true);
    setStatus(t("glasses.transcribing"));
    try {
      const text = await transcribe(conditionPcm(raw), SAMPLE_RATE, api.language);
      if (!text) {
        setStatus(t("glasses.noSpeech"), 2200);
        return;
      }
      setStatus(t("post.posting"));
      const fix = (await fixPromise) ?? coords;
      if (!fix) {
        setStatus(t("glasses.noFix"), 2200);
        return;
      }
      coords = fix;
      fixAt = Date.now();
      const result = await api.createPost(fix, text);
      // Straight onto the list rather than through a refetch: the writer is
      // looking at the spot they just posted about.
      feeds.addPost(result.post);
      setStatus(`✓ ${t("post.posted")}`, 3000);
    } catch (error) {
      console.error(error);
      setStatus(t("glasses.postFailed"), 2500);
    }
  }

  ui = createWebUI(
    {
      onLogin: login,
      onLogout: logout,
      onRefresh: () => void refresh(true),
      // A language chosen on the sign-in screen is the language the glasses are
      // fed in too: every feed is keyed on it, so changing it makes every card a
      // new question and the next paint re-asks whichever one is in view.
      onLanguage: (language) => {
        api.setLanguage(language);
        t = translator(language);
        feeds.forget();
        if (coords) void feeds.here(coords, language);
        render();
      },
    },
    // The same language the feeds are asked for, so the sign-in screen and the
    // site behind it are reading from one list.
    api.language,
  );
  ui.setUser(null);

  // Every cold start asks for the password, because nothing from the last one was
  // written down. It has to work this way now that the key is withdrawn a minute
  // after each sign-in: no endpoint mints a key from a token, so a stored token
  // could bring the glasses back but never the WebView, and an app that is half
  // signed in is worse than one that asks.
  setStatus(t("glasses.signIn"));
  ui.showLogin();

  bridge.onEvenHubEvent((event) => {
    const eventType = event.textEvent?.eventType ?? event.listEvent?.eventType ?? event.sysEvent?.eventType;

    if (eventType === OsEventTypeList.SCROLL_TOP_EVENT || eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      const now = Date.now();
      if (now - lastScrollAt < SCROLL_COOLDOWN_MS) return;
      lastScrollAt = now;
      // One line of screenfuls, walked a step at a time: a card with more rows
      // than fit contributes several steps, so scrolling reads down a long list
      // and then carries on to the next card (see glasses.ts).
      display.scroll(eventType === OsEventTypeList.SCROLL_TOP_EVENT ? -1 : 1);
      ensureVisible();
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

  // The bearing, and only while it is the thing being looked at. These events
  // arrive sixty times a second and the compass is one card of ten.
  subscribeSensors(() => {
    if (display.current() !== "direction" || recording) return;
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

  // lo's own beat: a fresh fix, published, and everyone else's back with it.
  window.setInterval(() => {
    if (!api.signedIn || recording) return;
    void refresh();
    if (coords) void feeds.presence(coords);
  }, PRESENCE_MS);
}

main().catch((error) => {
  console.error(error);
  const root = document.querySelector<HTMLDivElement>("#app");
  if (root) root.innerHTML = `<div class="boot">lo could not start. Reopen it from Even App.</div>`;
});
