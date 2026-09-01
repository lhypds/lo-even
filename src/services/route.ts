// The way to walk somewhere, asked of a router that answers anybody.
//
// The one read in this app that goes past lo. Everything else these glasses show
// comes off lo's own server, and the venues themselves do — but lo has no
// routing engine behind it, and the question here is not "what is around" but
// "which streets get me to this one door". Valhalla's public instance answers
// that for pedestrians, worldwide, with no key in front of it — the same bargain
// every upstream lo leans on makes — and it says so with an open CORS header, so
// this WebView can ask it directly.
//
// What comes back is drawn and never spoken: the map beside an open venue is the
// whole consumer (see glassesui/navmap.ts), so the manoeuvre list, the times and
// the narrative are all left in the answer. The shape is the route.

import type { Coordinates, NavPoint } from "../types";

const ROUTER_URL = "https://valhalla1.openstreetmap.de/route";

// The understudy: FOSSGIS's OSRM, on the same bargain as their Valhalla —
// keyless, worldwide, open CORS — and asked the same question in its own
// dialect when Valhalla has nothing. One public instance being down for an
// afternoon is a thing that actually happens (it is how this line came to be
// written), and a map that dashes a straight line for the whole of it when a
// sibling service knows the streets is a map giving up early. GET rather than
// POST, which also spares the WebView a preflight.
const UNDERSTUDY_URL = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";

// What each router is given, and half of the map's whole patience: two tries
// back to back cost at most what the one used to, so the dashed straight line
// — which is what stands on the screen while this is out — is still not the
// whole of somebody's walk. A route that cannot be had inside either is filed
// as failed and asked again after a pause (see feeds.ts), the dash standing in
// the meantime — which still points the right way.
const ATTEMPT_TIMEOUT_MS = 6_000;

/**
 * Valhalla's shape, decoded: Google's encoded-polyline algorithm at six decimal
 * places rather than the classic five, which is what Valhalla documents itself
 * as writing. Each coordinate is a zigzag-encoded delta from the one before it,
 * five bits to a character, low group first.
 */
function decodeShape(encoded: string): NavPoint[] {
  const points: NavPoint[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const next = (): number => {
    let result = 0;
    let shift = 0;
    let byte = 0x20;
    while (byte >= 0x20) {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    }
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    latitude += next();
    longitude += next();
    points.push({ latitude: latitude / 1e6, longitude: longitude / 1e6 });
  }
  return points;
}

/** One router's turn, on its own clock. */
async function timed(ask: (signal: AbortSignal) => Promise<NavPoint[]>): Promise<NavPoint[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    return await ask(controller.signal);
  } finally {
    window.clearTimeout(timer);
  }
}

// Both routers speak through this contract: the shape where there is one, the
// empty route where the router read the question and declined it — "no path
// could be found" for a door that snaps to no walkable edge is the same answer
// every time it is asked — and a throw only where the router could not be
// reached or answered at all. 429 is the one 4xx about this client rather than
// this question, and stays a throw with the 5xxs; a 200 with no drawable shape
// is the 4xx's kind of no, because asking again will not grow it a line.

async function askValhalla(from: Coordinates, to: NavPoint, signal: AbortSignal): Promise<NavPoint[]> {
  const response = await fetch(ROUTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      locations: [
        { lat: from.latitude, lon: from.longitude },
        { lat: to.latitude, lon: to.longitude },
      ],
      costing: "pedestrian",
      directions_options: { units: "kilometers" },
    }),
  });
  if (response.status >= 400 && response.status < 500 && response.status !== 429) return [];
  if (!response.ok) throw new Error(`the router answered ${response.status}`);
  const answer = (await response.json()) as { trip?: { legs?: Array<{ shape?: string }> } };
  const legs = answer.trip?.legs ?? [];
  return legs.flatMap((leg) => (leg.shape ? decodeShape(leg.shape) : []));
}

async function askUnderstudy(from: Coordinates, to: NavPoint, signal: AbortSignal): Promise<NavPoint[]> {
  // OSRM's dialect: coordinates in the path, longitude first, and the shape
  // asked for at the six decimals `decodeShape` already reads.
  const pair = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const response = await fetch(`${UNDERSTUDY_URL}/${pair}?overview=full&geometries=polyline6`, { signal });
  if (response.status >= 400 && response.status < 500 && response.status !== 429) return [];
  if (!response.ok) throw new Error(`the understudy answered ${response.status}`);
  const answer = (await response.json()) as { code?: string; routes?: Array<{ geometry?: string }> };
  const geometry = answer.code === "Ok" ? answer.routes?.[0]?.geometry : null;
  return geometry ? decodeShape(geometry) : [];
}

/**
 * The streets between here and one door, as a line of coordinates — start to
 * finish, however many legs the router cut it into. Valhalla is asked first,
 * and where it has nothing — down, throttled, or a no — the understudy is
 * asked the same question before this gives its own answer. That answer is the
 * empty route where a router read the question and had no line to offer — a
 * walk that cannot be plotted is an answer rather than an outage, and would be
 * the same answer asked again — and a throw only where neither could be
 * reached at all, which the feed store files as `failed` and re-asks after a
 * pause (see feeds.ts). Either way the map's stand-in is a dashed straight
 * line rather than a sentence, because the screen it is on has no room for one
 * and the dash still points the right way.
 */
export async function fetchRoute(from: Coordinates, to: NavPoint): Promise<NavPoint[]> {
  try {
    const points = await timed((signal) => askValhalla(from, to, signal));
    if (points.length >= 2) return points;
  } catch {
    // The understudy's turn either way: a no is worth a second opinion from a
    // router with its own graph, and an outage is what it is for.
  }
  return timed((signal) => askUnderstudy(from, to, signal));
}
