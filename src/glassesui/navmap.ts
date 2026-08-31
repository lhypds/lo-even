// The little map beside an open doorway: where you are, where it is, and the
// streets between — drawn, because it is the one answer on these glasses that
// words are the wrong shape for.
//
// This is the first picture in the app. Everything else on the display is type,
// because type is what the firmware draws well and a page of readings needs
// nothing else; a route is the exception, being a shape before it is anything
// sayable. The SDK's image container takes raw grey bytes, one a pixel, and the
// host turns them to the four-bit grey the glass actually shows — so this file
// is a rasteriser with no canvas behind it: a Uint8Array and some line
// arithmetic, which also lets the dev tools run it where there is no DOM.
//
// **North-up, always.** A map that turned with the reader's head would need the
// compass to be right sixty times a minute and would smear on every glance; a
// map that holds still is one the reader can learn. Which way they are facing is
// the arrow's to say, and the N in the corner is the one label the picture
// carries.
//
// **What one frame costs.** The bytes go to the glasses over the same BLE link
// as everything else, LZ4'd by the host — a mostly-black square compresses to
// very little, but it is still the biggest single write this app makes. So the
// picture is memoised against a key built from its own inputs, quantised: the
// fix to the metre-ish, the compass to fifteen degrees. A repaint that changed
// neither redraws nothing and sends nothing (see paint.ts, which compares the
// key rather than the bytes).

import { NAV_MAP } from "./theme";
import type { NavPoint } from "../types";

// The square's edge, which is the body's height: where the picture stands and
// how big it is belong to the layout's one page of geometry (see NAV_MAP in
// theme.ts), and this file draws whatever size that says. Taller than the 144
// one image container may be, which is not a mistake — the bitmap is drawn
// whole here and shipped as two stacked slices, cut where the containers are
// made (see layout.ts).
const SIZE = NAV_MAP.width;

/** One rendered frame: the bytes, and the key that says which frame this is. */
export interface NavMapImage {
  /** Gray8, row by row, the NAV_MAP square of them (see theme.ts). */
  bytes: Uint8Array;
  key: string;
}

export interface NavMapSpec {
  /** Where the reader is standing. */
  user: NavPoint;
  /** Degrees clockwise from north, or null where the handset offers none. */
  heading: number | null;
  /** The door being walked to. */
  target: NavPoint;
  /** The streets between, where the router has answered; null dashes a straight line. */
  route: NavPoint[] | null;
  /**
   * The streets around, where the tiles have answered; null draws the route on
   * dark ground. They are furniture rather than the answer — quiet lines under a
   * bright one — and they never widen the view: the map is fitted to the walk,
   * and the streets are cut to the map (see services/roads.ts).
   */
  roads: NavPoint[][] | null;
}

// The greys. Full ink for the route and the two markers, which are the answer;
// a quarter of it for the frame, the N, the streets and the dashed stand-in,
// which are furniture; and a middle weight for the scale bar, which is a
// reading — it exists to be read, and must still not fight the route. The glass
// shows sixteen levels, so anything under ~16 is off.
const INK = 255;
const MID = 160;
const DIM = 72;

// Air kept inside the square so a marker on the edge of the bounds still has
// room for its whole arrow.
const PAD = 14;

// The tightest the view is allowed to zoom, in metres across the square. A
// reader standing at the door would otherwise be handed a map of ten metres,
// which is a picture of GPS jitter.
const MIN_SPAN_M = 80;

// Metres per degree of latitude. Longitude is this times cos(lat), which is the
// whole of the projection: at map scale the flat earth is exact to a pixel.
const DEG_M = 111_320;

// The compass is quantised this coarse before it draws, which is what keeps a
// jittering handset from re-sending the square twice a second (see the key).
const HEADING_STEP = 15;

// The whole of the type this bitmap can set: what a scale bar needs and not a
// character more. Three columns to a glyph and five rows, the M five wide
// because three cannot draw one; a 1 is a column each side so it holds the
// width of the digits around it.
const GLYPHS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  k: ["101", "110", "100", "110", "101"],
  m: ["10001", "11011", "10101", "10001", "10001"],
};

// The distances a scale bar is allowed to claim. Round figures only — a bar of
// 137 metres is a bar nobody can multiply — and the bar is the longest of these
// that fits in about a third of the square (see `render`).
const BAR_STEPS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

// And the fix to five decimals — about a metre — for the same reason.
const FIX_DECIMALS = 5;

function quantHeading(heading: number | null): number | null {
  if (heading == null || !Number.isFinite(heading)) return null;
  return (Math.round(heading / HEADING_STEP) * HEADING_STEP + 360) % 360;
}

function quantPoint(point: NavPoint): string {
  return `${point.latitude.toFixed(FIX_DECIMALS)},${point.longitude.toFixed(FIX_DECIMALS)}`;
}

/**
 * Which frame these inputs would draw. The route contributes its length and its
 * ends rather than every point: a different answer from the router differs in
 * those, and a same answer re-offered differs in none of them. The streets
 * contribute their count for the same reason — the moment they matter is the
 * moment they arrive, when null becomes a number.
 */
function keyOf(spec: NavMapSpec, heading: number | null): string {
  const route = spec.route?.length
    ? `${spec.route.length}:${quantPoint(spec.route[0])}:${quantPoint(spec.route[spec.route.length - 1])}`
    : "-";
  const roads = spec.roads ? String(spec.roads.length) : "-";
  return `${quantPoint(spec.user)}|${quantPoint(spec.target)}|${heading ?? "-"}|${route}|${roads}`;
}

// One frame remembered, because the common repaint — a clock tick, a feed
// landing elsewhere on the page — asks for exactly the frame it already has.
let lastKey = "";
let lastBytes: Uint8Array | null = null;

/** The map for these inputs, drawn only where they differ from the last ask. */
export function navMap(spec: NavMapSpec): NavMapImage {
  const heading = quantHeading(spec.heading);
  const key = keyOf(spec, heading);
  if (key === lastKey && lastBytes) return { key, bytes: lastBytes };
  lastKey = key;
  lastBytes = render(spec, heading);
  return { key, bytes: lastBytes };
}

function render(spec: NavMapSpec, heading: number | null): Uint8Array {
  const size = SIZE;
  const bytes = new Uint8Array(size * size);

  // Brighter wins where marks cross, so the route can pass under a marker
  // without biting a notch out of it.
  const ink = (x: number, y: number, value: number): void => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const at = y * size + x;
    if (bytes[at] < value) bytes[at] = value;
  };

  // And the one mark that beats brighter: a clearing. The route begins under the
  // reader and ends under the door, so both markers would otherwise be drawn on
  // top of their own line and read as a knot in it — a disc of dark first is
  // what lets each of them stand alone (the same trick every phone map plays).
  const wipe = (x: number, y: number, r: number): void => {
    const cx = Math.round(x);
    const cy = Math.round(y);
    const span = Math.ceil(r);
    for (let dy = -span; dy <= span; dy += 1) {
      for (let dx = -span; dx <= span; dx += 1) {
        if (dx * dx + dy * dy > r * r) continue;
        const px = cx + dx;
        const py = cy + dy;
        if (px >= 0 && py >= 0 && px < size && py < size) bytes[py * size + px] = 0;
      }
    }
  };

  // The same clearing squared off, for the two pieces of legend — the N and the
  // scale bar sit over whatever streets happen to run through their corner, and
  // five-pixel type over a street is noise twice.
  const wipeRect = (x0: number, y0: number, width: number, height: number): void => {
    for (let y = Math.max(0, y0); y < Math.min(size, y0 + height); y += 1) {
      for (let x = Math.max(0, x0); x < Math.min(size, x0 + width); x += 1) {
        bytes[y * size + x] = 0;
      }
    }
  };

  // A line of the microtype above, drawn from its top-left corner; the advance
  // is each glyph's own width and a column of air.
  const text = (x0: number, y0: number, label: string, value: number): number => {
    let x = x0;
    for (const char of label) {
      const glyph = GLYPHS[char];
      if (!glyph) continue;
      glyph.forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx += 1) {
          if (row[dx] === "1") ink(x + dx, y0 + dy, value);
        }
      });
      x += glyph[0].length + 1;
    }
    return x - x0 - 1;
  };

  const disc = (x: number, y: number, r: number, value: number): void => {
    const cx = Math.round(x);
    const cy = Math.round(y);
    const span = Math.ceil(r);
    for (let dy = -span; dy <= span; dy += 1) {
      for (let dx = -span; dx <= span; dx += 1) {
        if (dx * dx + dy * dy <= r * r) ink(cx + dx, cy + dy, value);
      }
    }
  };

  // A stepped line of discs rather than Bresenham: at three pixels wide the
  // difference is invisible and the arithmetic is half the length.
  const stroke = (x0: number, y0: number, x1: number, y1: number, r: number, value: number): void => {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= steps; i += 1) {
      disc(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, r, value);
    }
  };

  const dashed = (x0: number, y0: number, x1: number, y1: number, value: number): void => {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= steps; i += 1) {
      if (i % 9 < 5) disc(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, 1, value);
    }
  };

  const ring = (x: number, y: number, r: number, value: number): void => {
    const span = Math.ceil(r) + 1;
    for (let dy = -span; dy <= span; dy += 1) {
      for (let dx = -span; dx <= span; dx += 1) {
        const away = Math.hypot(dx, dy);
        if (Math.abs(away - r) <= 0.9) ink(Math.round(x) + dx, Math.round(y) + dy, value);
      }
    }
  };

  /* ------------------------------------------------------- the projection -- */

  // Metres east and north of the reader, then fitted: the square shows whatever
  // rectangle holds the reader, the door and the whole route, centred, at one
  // scale for both axes — which is what makes it a map rather than a chart.
  const lonScale = Math.cos((spec.user.latitude * Math.PI) / 180);
  const metres = (point: NavPoint): { x: number; y: number } => ({
    x: (point.longitude - spec.user.longitude) * DEG_M * lonScale,
    y: (point.latitude - spec.user.latitude) * DEG_M,
  });

  const shown: NavPoint[] = [spec.user, spec.target, ...(spec.route ?? [])];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of shown) {
    const { x, y } = metres(point);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(maxX - minX, maxY - minY, MIN_SPAN_M);
  const scale = (size - PAD * 2) / span;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const place = (point: NavPoint): { x: number; y: number } => {
    const { x, y } = metres(point);
    // North up: metres north go up the screen, and pixel rows go down it.
    return { x: size / 2 + (x - cx) * scale, y: size / 2 - (y - cy) * scale };
  };

  /* --------------------------------------------------------- the drawing -- */

  // The streets first, under everything: one quiet pixel of line each, and only
  // the strokes with any chance of touching the square — a z14 tile's streets
  // run kilometres past the edge of an eighty-metre view, and drawing them all
  // would be most of the work of the frame spent off-screen.
  if (spec.roads) {
    const off = 4;
    for (const road of spec.roads) {
      if (road.length < 2) continue;
      let previous = place(road[0]);
      for (let i = 1; i < road.length; i += 1) {
        const point = place(road[i]);
        const out =
          (previous.x < -off && point.x < -off) ||
          (previous.x > size + off && point.x > size + off) ||
          (previous.y < -off && point.y < -off) ||
          (previous.y > size + off && point.y > size + off);
        if (!out) stroke(previous.x, previous.y, point.x, point.y, 0, DIM);
        previous = point;
      }
    }
  }

  // The frame, one pixel, quiet: the square has to read as an instrument with an
  // edge rather than as marks floating in the dark, and a quarter of the ink is
  // enough to say so on a display where every lit pixel glows.
  for (let i = 0; i < size; i += 1) {
    ink(i, 0, DIM);
    ink(i, size - 1, DIM);
    ink(0, i, DIM);
    ink(size - 1, i, DIM);
  }

  const user = place(spec.user);
  const target = place(spec.target);

  // N, in whichever top corner neither marker is standing in — each marker
  // clears the ground under itself, and a legend in that clearing would come out
  // half-eaten. Two strokes and a diagonal rather than a glyph, because there is
  // no type in a bitmap; a map with both top corners taken simply goes without,
  // the markers being the answer and the legend only furniture. Its own ground
  // is cleared first, now that there are streets to be standing on.
  const clearOf = (x: number, y: number): boolean =>
    Math.hypot(user.x - x, user.y - y) > 20 && Math.hypot(target.x - x, target.y - y) > 20;
  const nx = clearOf(size - 10, 10) ? size - 13 : clearOf(10, 10) ? 8 : null;
  if (nx != null) {
    const ny = 6;
    wipeRect(nx - 3, ny - 3, 12, 14);
    stroke(nx, ny + 7, nx, ny, 0, DIM);
    stroke(nx, ny, nx + 5, ny + 7, 0, DIM);
    stroke(nx + 5, ny + 7, nx + 5, ny, 0, DIM);
  }

  // The way there: the router's line where it has answered, and a dashed
  // straight line where it has not — still an answer, and honest about being the
  // crow's rather than the street's.
  const route = spec.route;
  if (route && route.length >= 2) {
    let previous = place(route[0]);
    for (let i = 1; i < route.length; i += 1) {
      const point = place(route[i]);
      stroke(previous.x, previous.y, point.x, point.y, 1, INK);
      previous = point;
    }
  } else {
    dashed(user.x, user.y, target.x, target.y, DIM);
  }

  // The scale bar: the longest round figure that fits in about a third of the
  // square, drawn as a line with an end tick each and the figure over it. It is
  // the one reading on the map — how big is this picture — and the middle grey
  // is that said in ink: brighter than the streets it measures, quieter than
  // the route. It picks its bottom corner the way the N picks its top one, and
  // for the same reason: the markers clear the ground under themselves, and a
  // figure in a clearing comes out half-eaten. With both corners taken it
  // stands in the left one anyway and loses to the marker, the marker being
  // the answer and the bar a reading about the picture.
  {
    const metresPerPixel = span / (size - PAD * 2);
    let metres = BAR_STEPS[0];
    for (const step of BAR_STEPS) {
      if (step / metresPerPixel <= 52) metres = step;
    }
    const wide = Math.round(metres / metresPerPixel);
    const label = metres >= 1000 ? `${metres / 1000}km` : `${metres}m`;
    const labelWide = [...label].reduce((sum, char) => sum + (GLYPHS[char]?.[0].length ?? 0) + 1, -1);
    const barY = size - 8;
    const labelY = barY - 9;
    const room = Math.max(wide, labelWide);
    const fits = (x: number): boolean =>
      clearOf(x, barY - 6) && clearOf(x + room / 2, barY - 6) && clearOf(x + room, barY - 6);
    const x0 = fits(6) || !fits(size - 6 - room) ? 6 : size - 6 - room;
    wipeRect(x0 - 3, labelY - 3, room + 8, barY - labelY + 9);
    stroke(x0, barY, x0 + wide, barY, 0, MID);
    stroke(x0, barY - 3, x0, barY, 0, MID);
    stroke(x0 + wide, barY - 3, x0 + wide, barY, 0, MID);
    text(x0, labelY, label, MID);
  }

  // The door: a ring with its own centre lit, in a clearing of its own — the
  // route ends underneath it, and a ring drawn over its own line reads as a knot.
  wipe(target.x, target.y, 8);
  ring(target.x, target.y, 5.5, INK);
  disc(target.x, target.y, 1.6, INK);

  // The reader: an arrow where the handset knows which way they are facing, a
  // plain dot where it does not. The arrow is the one thing on the map that is
  // not north-up — it is the reader's own bearing laid onto a map that holds
  // still, which is exactly the question a person mid-walk asks of it.
  //
  // A dart rather than an even triangle: the route begins under this marker, and
  // an arrow whose back corners are as far from the centre as its tip has no
  // readable front at three pixels' width. The tip gets most of the length, the
  // wings stay short, and the clearing underneath is what lets the shape be read
  // against the very line it is standing on.
  wipe(user.x, user.y, 9);
  if (heading != null) {
    const angle = (heading * Math.PI) / 180;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const at = (dx: number, dy: number): { x: number; y: number } => ({
      // Rotate clockwise-from-north in screen space, where y runs down.
      x: user.x + dx * cos + dy * sin,
      y: user.y + dx * sin - dy * cos,
    });
    const tip = at(0, 8);
    const left = at(-4, -5);
    const right = at(4, -5);
    const back = at(0, -2);
    // Filled by its edges plus a spine — quicker than a scanline fill and solid
    // at this size.
    stroke(tip.x, tip.y, left.x, left.y, 1, INK);
    stroke(tip.x, tip.y, right.x, right.y, 1, INK);
    stroke(left.x, left.y, back.x, back.y, 1, INK);
    stroke(right.x, right.y, back.x, back.y, 1, INK);
    stroke(tip.x, tip.y, back.x, back.y, 1, INK);
  } else {
    disc(user.x, user.y, 3, INK);
  }

  return bytes;
}
