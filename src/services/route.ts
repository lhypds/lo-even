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

// Long enough for a public instance under load, short enough that the map's
// dashed straight line — which is what stands on the screen while this is out —
// is not the whole of somebody's walk. A route that cannot be had inside this is
// answered by that dash for good, which still points the right way.
const ROUTE_TIMEOUT_MS = 12_000;

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

/**
 * The streets between here and one door, as a line of coordinates — start to
 * finish, however many legs the router cut it into. Throws where the router
 * cannot be reached or has nothing to say, which the feed store files as
 * `failed` like any other read (see feeds.ts); the map's answer to that is a
 * dashed straight line rather than a sentence, because the screen it is on has
 * no room for one and the dash still points the right way.
 */
export async function fetchRoute(from: Coordinates, to: NavPoint): Promise<NavPoint[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ROUTE_TIMEOUT_MS);
  try {
    const response = await fetch(ROUTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        locations: [
          { lat: from.latitude, lon: from.longitude },
          { lat: to.latitude, lon: to.longitude },
        ],
        costing: "pedestrian",
        directions_options: { units: "kilometers" },
      }),
    });
    if (!response.ok) throw new Error(`the router answered ${response.status}`);
    const answer = (await response.json()) as { trip?: { legs?: Array<{ shape?: string }> } };
    const legs = answer.trip?.legs ?? [];
    const points = legs.flatMap((leg) => (leg.shape ? decodeShape(leg.shape) : []));
    if (points.length < 2) throw new Error("the router answered with no shape");
    return points;
  } finally {
    window.clearTimeout(timer);
  }
}
