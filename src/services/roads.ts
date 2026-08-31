// The streets around the reader, for the map to draw under the route — off
// OpenFreeMap's public vector tiles, which is the second upstream this app asks
// past lo and chosen the way the first was: keyless, open to any origin, and
// serious about staying up (see route.ts, and lo's own habit of key-free
// upstreams). Overpass would have been the obvious source — lo's server already
// asks it about venues — but its public instances queue, throttle and fall over
// as a matter of course, and a background layer that usually failed to arrive
// would be worse than none.
//
// A tile is a protobuf of layers, features and zigzagged deltas — the Mapbox
// Vector Tile format — and the few dozen lines below decode exactly the slice
// of it this app wants: the `transportation` layer's linestrings, as
// coordinates. A library would decode all of it; nothing here wants the
// buildings, the POIs or the house numbers of central Tokyo, which outweigh the
// streets twenty to one in the very tile they share.

import type { NavPoint } from "../types";

// Where the tiles are. The template carries a snapshot date and moves as the
// planet is re-cut, so it is asked for rather than written down: the TileJSON
// at this address names the current one, and is fetched once per launch.
const TILEJSON_URL = "https://tiles.openfreemap.org/planet";

// The deepest zoom OpenFreeMap serves, which is also the one with every street
// in it. A z14 tile is about two kilometres across at this latitude — one or
// two of them cover any walk this map will ever draw.
const TILE_ZOOM = 14;

const TILE_TIMEOUT_MS = 12_000;

// How many decoded tiles are kept. A walk crosses a tile boundary now and then
// and comes straight back; four is a two-by-two neighbourhood, which is the
// most one map can touch at once.
const TILES_KEPT = 4;

// What the transportation layer calls things that are not streets. Rails and
// rivers of that layer would draw as roads and read as roads, and a reader
// cannot walk down any of them.
const NOT_STREETS = new Set([
  "rail",
  "transit",
  "ferry",
  "cable_car",
  "gondola",
  "aerialway",
  "pier",
  "busway",
  "bus_guideway",
]);

/* ------------------------------------------------------ protobuf, by hand -- */

interface Field {
  id: number;
  /** Varint value, for wire type 0. */
  int: number;
  /** Sub-message or string bytes, for wire type 2. */
  bytes: Uint8Array;
}

/** One pass over one message's fields. Wire types 1 and 5 are skipped whole. */
function* fields(buffer: Uint8Array): Generator<Field> {
  let at = 0;
  const varint = (): number => {
    let value = 0;
    let shift = 0;
    for (;;) {
      const byte = buffer[at++];
      value += (byte & 0x7f) * 2 ** shift;
      if (byte < 0x80) return value;
      shift += 7;
    }
  };
  while (at < buffer.length) {
    const tag = varint();
    const wire = tag & 7;
    const id = tag >> 3;
    if (wire === 0) {
      yield { id, int: varint(), bytes: EMPTY };
    } else if (wire === 2) {
      const length = varint();
      yield { id, int: 0, bytes: buffer.subarray(at, at + length) };
      at += length;
    } else {
      at += wire === 1 ? 8 : 4;
    }
  }
}

const EMPTY = new Uint8Array(0);

/** A packed run of varints — a feature's tags, or its geometry commands. */
function packed(buffer: Uint8Array): number[] {
  const values: number[] = [];
  let value = 0;
  let shift = 0;
  for (const byte of buffer) {
    value += (byte & 0x7f) * 2 ** shift;
    if (byte < 0x80) {
      values.push(value);
      value = 0;
      shift = 0;
    } else {
      shift += 7;
    }
  }
  return values;
}

const zigzag = (value: number): number => (value % 2 === 1 ? -(value + 1) / 2 : value / 2);

/* --------------------------------------------------------------- the tile -- */

/**
 * The streets of one tile, decoded to positions: every linestring of the
 * `transportation` layer whose class is a thing with a surface to walk on.
 *
 * The geometry arrives in tile-local integers on a 4096 grid with its own
 * MoveTo/LineTo command stream; each MoveTo starts a fresh line, which is how
 * one feature carries a whole dual carriageway. Tile coordinates go to the
 * world through the web-mercator arithmetic in `toPoint`.
 */
function decodeStreets(tile: Uint8Array, tx: number, ty: number): NavPoint[][] {
  const scale = 2 ** TILE_ZOOM;
  const lines: NavPoint[][] = [];

  const decoder = new TextDecoder();
  for (const layerField of fields(tile)) {
    if (layerField.id !== 3) continue;
    // The name first and on its own, because it is the cheap question: a
    // central-Tokyo tile spends most of itself on the POI and building layers,
    // and decoding their string tables to learn they are not the streets would
    // be most of the cost of the tile. Only the layer that answers gets read.
    let name = "";
    for (const field of fields(layerField.bytes)) {
      if (field.id === 1) {
        name = decoder.decode(field.bytes);
        break;
      }
    }
    if (name !== "transportation") continue;

    // Then the whole layer: the tag tables before the features are used, because
    // a layer's keys and values can arrive after the features that refer to
    // them, so reading in one pass would be reading a table that is not there
    // yet.
    let extent = 4096;
    const keys: string[] = [];
    const values: string[] = [];
    const features: Uint8Array[] = [];
    for (const field of fields(layerField.bytes)) {
      if (field.id === 2) features.push(field.bytes);
      else if (field.id === 3) keys.push(decoder.decode(field.bytes));
      else if (field.id === 4) {
        // A Value message: the one field of it that is set. Only strings are
        // ever compared against here, so everything else reads as nothing.
        let value = "";
        for (const part of fields(field.bytes)) {
          if (part.id === 1) value = decoder.decode(part.bytes);
        }
        values.push(value);
      } else if (field.id === 5) extent = field.int;
    }

    const classAt = keys.indexOf("class");
    for (const feature of features) {
      let type = 0;
      let tags: number[] = [];
      let geometry: number[] = [];
      for (const field of fields(feature)) {
        if (field.id === 3) type = field.int;
        else if (field.id === 2) tags = packed(field.bytes);
        else if (field.id === 4) geometry = packed(field.bytes);
      }
      if (type !== 2) continue; // linestrings only
      let street = true;
      for (let i = 0; i < tags.length; i += 2) {
        if (tags[i] === classAt && NOT_STREETS.has(values[tags[i + 1]] ?? "")) street = false;
      }
      if (!street) continue;

      const toPoint = (px: number, py: number): NavPoint => {
        const worldX = (tx + px / extent) / scale;
        const worldY = (ty + py / extent) / scale;
        return {
          latitude: (Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY))) * 180) / Math.PI,
          longitude: worldX * 360 - 180,
        };
      };

      let x = 0;
      let y = 0;
      let line: NavPoint[] = [];
      for (let i = 0; i < geometry.length; ) {
        const command = geometry[i] & 7;
        let count = geometry[i] >> 3;
        i += 1;
        if (command === 1) {
          // MoveTo: the pen lifts, and whatever it drew so far is one line.
          if (line.length > 1) lines.push(line);
          x += zigzag(geometry[i]);
          y += zigzag(geometry[i + 1]);
          i += 2;
          line = [toPoint(x, y)];
          count -= 1;
          // A MoveTo of more than one is not something a linestring contains,
          // but counting it down keeps a malformed one from derailing the rest.
          i += count * 2;
        } else if (command === 2) {
          while (count-- > 0) {
            x += zigzag(geometry[i]);
            y += zigzag(geometry[i + 1]);
            i += 2;
            line.push(toPoint(x, y));
          }
        } else {
          // ClosePath, which a linestring never carries. No parameters.
        }
      }
      if (line.length > 1) lines.push(line);
    }
  }
  return lines;
}

/* ------------------------------------------------------------- the fetch -- */

let template: string | null = null;

async function tileTemplate(signal: AbortSignal): Promise<string> {
  if (template) return template;
  const response = await fetch(TILEJSON_URL, { signal });
  if (!response.ok) throw new Error(`the tile index answered ${response.status}`);
  const json = (await response.json()) as { tiles?: string[] };
  const found = json.tiles?.[0];
  if (!found) throw new Error("the tile index named no tiles");
  template = found;
  return found;
}

// Decoded tiles, newest last — the same bounded shape the feed stores keep,
// held here because tiles belong to the ground rather than to any one venue:
// two doors on one street want the same tile, and a reader walking back across
// a boundary wants the one from a minute ago.
const decoded = new Map<string, NavPoint[][]>();

async function streetsOf(tx: number, ty: number, signal: AbortSignal): Promise<NavPoint[][]> {
  const key = `${tx}/${ty}`;
  const held = decoded.get(key);
  if (held) return held;
  const url = (await tileTemplate(signal))
    .replace("{z}", String(TILE_ZOOM))
    .replace("{x}", String(tx))
    .replace("{y}", String(ty));
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`the tiles answered ${response.status}`);
  const lines = decodeStreets(new Uint8Array(await response.arrayBuffer()), tx, ty);
  if (decoded.size >= TILES_KEPT) {
    const oldest = decoded.keys().next();
    if (!oldest.done) decoded.delete(oldest.value);
  }
  decoded.set(key, lines);
  return lines;
}

const tileX = (longitude: number): number => Math.floor(((longitude + 180) / 360) * 2 ** TILE_ZOOM);
const tileY = (latitude: number): number => {
  const radians = (latitude * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** TILE_ZOOM,
  );
};

/**
 * The streets around a walk from `from` to `to`: every tile the pair's
 * surroundings touch, decoded and filtered to the lines near enough to ever be
 * drawn. The margin past the pair matches the room the map gives a route to
 * wander in — a third again each way — so a detour stays on streets that exist.
 *
 * What comes back is bounded twice: the tiles by the two-by-two the zoom makes
 * of any walk, and the lines by the box, because one central-Tokyo tile carries
 * two thousand streets and a map eighty metres wide wants forty of them.
 */
export async function fetchRoads(from: NavPoint, to: NavPoint): Promise<NavPoint[][]> {
  const spanLat = Math.abs(from.latitude - to.latitude);
  const spanLon = Math.abs(from.longitude - to.longitude);
  // A street's width of margin at the least, so a map of a very short walk
  // still has its own block around it.
  const padLat = Math.max(spanLat / 3, 0.002);
  const padLon = Math.max(spanLon / 3, 0.0025);
  const north = Math.max(from.latitude, to.latitude) + padLat;
  const south = Math.min(from.latitude, to.latitude) - padLat;
  const west = Math.min(from.longitude, to.longitude) - padLon;
  const east = Math.max(from.longitude, to.longitude) + padLon;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TILE_TIMEOUT_MS);
  try {
    const asked: Promise<NavPoint[][]>[] = [];
    for (let tx = tileX(west); tx <= tileX(east); tx += 1) {
      for (let ty = tileY(north); ty <= tileY(south); ty += 1) {
        asked.push(streetsOf(tx, ty, controller.signal));
      }
    }
    const tiles = await Promise.all(asked);
    return tiles
      .flat()
      .filter((line) =>
        line.some(
          (point) =>
            point.latitude >= south &&
            point.latitude <= north &&
            point.longitude >= west &&
            point.longitude <= east,
        ),
      );
  } finally {
    window.clearTimeout(timer);
  }
}
