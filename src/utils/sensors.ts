// The instruments in the handset itself — a port of lo/src/utils/sensors.js, cut
// down to the two readings the glasses actually show.
//
// The phone's instruments and not the glasses'. The bridge does expose the
// glasses' IMU (`imuControl`, and IMU_DATA_REPORT events carrying a bare x/y/z)
// but a triple with no documented axis convention is not a bearing, and a
// compass that is confidently wrong is worse than none. The handset is strapped
// to the same person and its magnetometer is a known quantity.
//
// One store rather than a reading per caller: the browser hands these out sixty
// times a second, iOS asks permission before handing out any of them at all, and
// the whole card wants one consistent set of numbers.

export type SensorStatus = "idle" | "asking" | "listening" | "on" | "denied" | "unsupported";

export interface SensorState {
  status: SensorStatus;
  /** Degrees clockwise from north, where the top of the phone is pointing. */
  heading: number | null;
  headingAccuracy: number | null;
  /** Degrees a second, about all three axes at once, smoothed. */
  turnRate: number | null;
}

// Nothing in the first two seconds means nothing is coming. A browser with no
// instruments behind these events does not refuse and does not fail — it simply
// never fires one, so silence is the only answer it gives and has to be read as
// one.
const SILENCE_MS = 2000;
// How long the turn rate takes to follow the phone being turned. The gyroscope's
// own noise is a few degrees a second and a different few every sample; a third
// of a second of them averaged is the hand rather than the instrument.
const TURN_TAU_MS = 300;
// The glasses repaint at most twice a second. Ten instrument samples a second is
// already comfortably above that and avoids doing the same trigonometry and
// store notification for every native 60 Hz event — twice, on browsers that
// report both orientation event names.
const SAMPLE_MS = 100;
// Under this the phone is being held rather than turned. A figure flickering
// between two and five while nothing is happening reads as an instrument that
// cannot make its mind up, which is the one thing a reading must never look like.
const TURN_STILL_DPS = 3;

let state: SensorState = { status: "idle", heading: null, headingAccuracy: null, turnRate: null };
const listeners = new Set<() => void>();

let attached = false;
let authorized = false;
let wanted = false;
let silenceTimer = 0;
let motionAt = 0;
let orientationAt = 0;
let smoothed: number | null = null;

function emit(next: Partial<SensorState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function subscribeSensors(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function sensorState(): SensorState {
  return state;
}

// alpha counts anticlockwise from north about the vertical axis, so a heading —
// clockwise, from the top of the screen — is its complement, turned again by
// however far the screen has been rotated inside the case.
function headingFromAlpha(alpha: number | null): number | null {
  if (!Number.isFinite(alpha)) return null;
  const angle = window.screen?.orientation?.angle;
  return (360 - (alpha as number) + (Number.isFinite(angle) ? (angle as number) : 0) + 360) % 360;
}

interface CompassEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

function onOrientation(event: DeviceOrientationEvent): void {
  const compass = event as CompassEvent;
  // Safari answers the compass question directly and its alpha is no use for it.
  // Everywhere else the heading is in alpha and only where the event calls itself
  // absolute: a relative alpha counts from wherever the phone happened to be
  // lying when the page opened, which is a number about nothing.
  const heading = Number.isFinite(compass.webkitCompassHeading)
    ? (compass.webkitCompassHeading as number)
    : event.absolute
      ? headingFromAlpha(event.alpha)
      : null;
  if (heading == null) return;
  const now = Date.now();
  if (now - orientationAt < SAMPLE_MS) return;
  orientationAt = now;

  window.clearTimeout(silenceTimer);
  silenceTimer = 0;
  emit({
    status: "on",
    heading,
    headingAccuracy: Number.isFinite(compass.webkitCompassAccuracy)
      ? (compass.webkitCompassAccuracy as number)
      : null,
  });
}

function onMotion(event: DeviceMotionEvent): void {
  const now = Date.now();
  if (now - motionAt < SAMPLE_MS) return;
  const rate = event.rotationRate;
  if (!rate) return;
  const magnitude = Math.hypot(rate.alpha ?? 0, rate.beta ?? 0, rate.gamma ?? 0);
  // A one-pole filter over however long actually elapsed, rather than over a
  // sample count: these events do not arrive on a steady beat and a fixed
  // coefficient would smooth by a different amount on every device.
  const elapsed = motionAt ? Math.min(1000, now - motionAt) : TURN_TAU_MS;
  motionAt = now;
  const alpha = 1 - Math.exp(-elapsed / TURN_TAU_MS);
  smoothed = smoothed == null ? magnitude : smoothed + alpha * (magnitude - smoothed);
  emit({ turnRate: smoothed < TURN_STILL_DPS ? 0 : smoothed });
}

function attach(): void {
  if (attached || !authorized || !wanted || document.hidden) return;
  attached = true;
  window.addEventListener("deviceorientationabsolute", onOrientation);
  window.addEventListener("deviceorientation", onOrientation);
  window.addEventListener("devicemotion", onMotion);
  emit({ status: "listening" });
  silenceTimer = window.setTimeout(() => {
    if (state.status === "listening") emit({ status: "unsupported" });
  }, SILENCE_MS);
}

function detach(): void {
  if (!attached) return;
  window.removeEventListener("deviceorientationabsolute", onOrientation);
  window.removeEventListener("deviceorientation", onOrientation);
  window.removeEventListener("devicemotion", onMotion);
  window.clearTimeout(silenceTimer);
  attached = false;
  silenceTimer = 0;
  motionAt = 0;
  orientationAt = 0;
  smoothed = null;
}

function sync(): void {
  if (wanted && authorized && !document.hidden) attach();
  else detach();
}

/** Listen only while the glasses page that displays these readings is visible. */
export function setSensorsActive(active: boolean): void {
  wanted = active;
  sync();
}

document.addEventListener("visibilitychange", sync);

/**
 * Turn the instruments on.
 *
 * iOS is the only place these come with a prompt, and it is a prompt that has to
 * be asked for from inside a press — Safari refuses the ask made anywhere else.
 * There is no button on the glasses to make that press with, and the outer frame
 * draws nothing once the reader is signed in, so this is called from the one
 * press this package does have: the Go button on the sign-in screen (see
 * main.ts). Somewhere else has to ask, or the compass card can never be more
 * than an explanation of why it is empty.
 */
export async function startSensors(): Promise<void> {
  if (authorized) {
    sync();
    return;
  }
  if (state.status === "asking") return;
  const requestPermission = (
    window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
  )?.requestPermission;

  if (typeof requestPermission !== "function") {
    authorized = true;
    sync();
    return;
  }

  emit({ status: "asking" });
  try {
    const answer = await requestPermission();
    if (answer !== "granted") {
      emit({ status: "denied" });
      return;
    }
    authorized = true;
    sync();
  } catch {
    // Asked from outside a gesture, or refused outright. Either way there is
    // nothing to show and the card says so.
    emit({ status: "denied" });
  }
}
