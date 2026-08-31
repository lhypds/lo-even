// The dashboard, as the glasses see it, and the three levels underneath it.
//
// This is the whole of what main.ts talks to: hand it everything that is known
// right now and it draws the screenful the reader is looking at; tell it the
// wheel turned and it moves to the next one, or that the touchpad was tapped and
// it steps into what is under them. All the state it owns is where the reader
// has got to.
//
// **The sequence.** lo's dashboard is a grid of tiles turned with a thumb. There
// is no grid up here and nothing to put a thumb on, so the same dashboard becomes
// three screenfuls walked with the wheel: where you are, what is around you, what
// is being said about the wider place. Each of them is built to come in at or
// under the lines there are, so a scroll is always a page rather than sometimes
// the rest of one — but a page that did overflow would contribute a second screen
// rather than lose the difference (see layout.ts).
//
// **The four levels.** A dashboard fits by cutting, and what it cuts is the ends
// of sentences. That is the right trade for the question "what is going on here"
// and no answer at all to "what did they say", so under two of the three pages
// there is the group the reader picks out of it, under that the whole of that
// group, and under that one entry of it, read (see pages/list.ts).
//
//   `lo/` `lo/nearby` `lo/info`     the three pages, one flick apart
//   `lo/nearby · 1/4`               the same page, with a box round one group
//   `lo/nearby/msg · 2/4`           that group's own list, the second letter
//   `lo/nearby/msg · 1/2`           that letter, whole, over two screenfuls
//
// The middle level is the one that would not be obvious from the outside. The
// step from a page to a list could have been one tap, and it is two because the
// page has four things on it: a tap that opened *a* list would have to guess
// which, and the wheel would then have to carry the reader across group
// boundaries to correct the guess. So the choosing happens where the reader can
// already see all four — on the page itself, with a box round one of them (see
// theme.ts on why a box and not brightness) — and the tap after it opens the one
// they chose, which is the only list the wheel then walks.
//
// Each page carries its own name, and the group joins the path only once it has
// been opened: while the reader is still choosing they have not gone anywhere,
// and the corner says so. What the counter counts is whatever the path has just
// named — which page of the three, which group of the four, which letter, which
// screenful of it.
//
// The wheel means the same thing at all four levels: the next thing along,
// rounding at the end rather than stopping. A tap goes in, a double tap comes
// back out, and at the top a double tap is the way out of the app it always was.
//
// **Where the reader is** is kept by name at every level, never as an index. A
// page appears when the country turns out to feed it, a list grows an entry when
// somebody posts, a post is deleted from a phone three streets away — all of it
// underneath a reader who has not touched anything. An index into a list that
// moved is how they end up looking at something they never scrolled to; a name
// survives all of it, and where the name has gone the fallback is the nearest
// thing to it rather than the top.

import type { EvenAppBridge } from "@evenrealities/even_hub_sdk";
import { offeredPages } from "./pages";
import type { Item, ItemRef, PageContext, PageDefinition, PageView } from "./pages/types";
import { listView, locate as locateItem, readView } from "./pages/list";
import { spans, type Span } from "./pages/stack";
import { formatPlace } from "./format";
import { ROOT, clockFace, pathOf } from "./pages/chrome";
import { layout, screens, type Chrome, type Panel } from "./layout";
import { navMap } from "./navmap";
import { createPainter, type Painter } from "./paint";
import {
  BODY_LINES,
  BODY_WIDTH,
  CONTAINER,
  FRAME,
  FRAME_PADDING,
  INK,
  MUTED,
  frameCells,
  noteRect,
} from "./theme";
import { clipCells, wrap } from "./metrics";

/**
 * A screen that is not part of the sequence and takes the display over while it
 * is up. There is one of them — the composer, which asks a dictation what it is
 * (see pages/compose.ts) — and it is named rather than anonymous so that anything
 * asking what the reader is looking at gets an answer that is true.
 */
export interface Takeover {
  id: string;
  view: PageView;
}

export interface GlassesDisplay {
  /** Draw what is known now. Called on every change of data, status or minute. */
  render(context: PageContext, status?: string): void;
  /** The wheel turned: -1 back towards the standing page, +1 away from it. */
  scroll(direction: 1 | -1): void;
  /**
   * A tap: into the list under this page, or into the entry under the reader.
   * Nothing at all where there is nothing under them — the standing page is
   * instruments rather than a list of anything, and an empty group is a sentence
   * saying so rather than a screen to open.
   */
  enter(): void;
  /**
   * A double tap: back out one level. False when there was nowhere to come back
   * from, which is how the caller knows the gesture was the one that leaves the
   * app (see main.ts).
   */
  back(): boolean;
  /**
   * Put a screen in front of everything, or `null` to take it away. Where the
   * reader was is not touched either way: a question asked in the middle of the
   * dashboard puts them back on exactly the screen they were reading, which is
   * the least a question that interrupted them can do.
   */
  takeover(screen: Takeover | null): void;
  /** Which page the reader is looking at, for anything that needs to know. */
  current(): string | null;
  /**
   * The entry being read whole, where it is one whose words have to be fetched.
   * Null everywhere else — on the dashboard, in a list, and on any entry that
   * already carries what it says. What acts on it is main.ts, after every paint.
   */
  reading(): ReadRef | null;
  /**
   * The entry being read whole, whatever kind it is — the one above without the
   * condition that its words live elsewhere. Null on the dashboard, null while a
   * group is only picked out, and null in a list: a reader walking a list of
   * letters has opened none of them.
   *
   * It is what tells the app which letter is in front of the reader, which two
   * things now hang off: the three seconds that mark it read, and the hold that
   * answers it (see main.ts). Neither can use `reading` — a letter carries its own
   * words and so has no link — and neither wants the reader's position in a list,
   * which is where `enter` has not been pressed yet.
   */
  opened(): ItemRef | null;
  /** Where in the app they are, as the corner of the footer says it: `lo/nearby`. */
  path(): string;
  shutdown(): Promise<void>;
}

/** One screenful: a page, and which screen of that page. */
interface Step {
  page: PageDefinition;
  view: PageView;
  screen: number;
}

/** Where the reader is on the dashboard, by name rather than by index. */
interface Anchor {
  pageId: string;
  screen: number;
}

/**
 * How deep in: the dashboard, a group of the page picked out on the page itself,
 * that group's own list, or one entry of it read whole. A number rather than four
 * shapes of state, because the page it is all under is the same one at every
 * depth — the anchor is never disturbed by going in, so coming back out is a
 * subtraction and the reader is where they left off.
 */
type Depth = 0 | 1 | 2 | 3;

const CHOOSING = 1;
const LISTING = 2;
const READING = 3;

/**
 * An entry whose words live somewhere else, and what to say when asking for
 * them.
 *
 * The title is the feed's own wording, passed on as lo's fallback for a page
 * that does not state its own. The masthead is deliberately not passed: what
 * this level has is the entry's first line, which is the source and the hour
 * together — sent as a source it would file half the stories in the app under
 * `BBC · 2h ago`. lo reads the publisher's own name off the page anyway.
 */
export interface ReadRef {
  link: string;
  group: string;
  title: string;
}

/** One screenful of what is underneath a page, and everything the wheel needs to leave it. */
interface Inside {
  view: PageView;
  screen: number;
  /** Which group has a box round it, on the screen where the reader is choosing one. */
  select?: number;
  chrome: Chrome;
  /**
   * Where the wheel is standing at this depth and how many places there are to
   * stand — which group, which entry, or which screenful of one thing. The same
   * pair whatever the depth, so one line of arithmetic turns the wheel at all
   * three of them.
   */
  step: number;
  total: number;
  /** The groups of the page, and the entries of the one the reader has chosen. */
  groups: Span[];
  items: Item[];
  /**
   * Set only on the screen that is reading one entry whole, and only where that
   * entry keeps its words elsewhere. It is how the app knows a story is worth
   * fetching, and it is deliberately not set at the two depths above: a reader
   * looking at a list of twenty headlines has chosen none of them.
   */
  read?: ReadRef;
  /**
   * Which entry that screen is reading, whatever kind it is — set at the same one
   * depth as `read` and for the same reason, but without the condition that made
   * `read` about newswire rows alone.
   */
  open?: ItemRef;
}

/**
 * Every screenful the dashboard currently amounts to, in order. Rendering a page
 * to count its screens is not wasteful — a render is a pure read of data already
 * in hand, and it is the only way to know how many screens a page is worth.
 */
function sequence(context: PageContext): Step[] {
  const steps: Step[] = [];
  for (const page of offeredPages(context)) {
    const view = page.render(context);
    const total = screens(view);
    for (let screen = 0; screen < total; screen += 1) steps.push({ page, view, screen });
  }
  return steps;
}

/**
 * Where the anchor points now. A screen that is no longer there falls back to the
 * last screen of the same page rather than to a different page — a list that
 * shrank under the reader should leave them looking at the same thing, shorter.
 */
function locate(steps: Step[], anchor: Anchor): number {
  const exact = steps.findIndex((step) => step.page.id === anchor.pageId && step.screen === anchor.screen);
  if (exact !== -1) return exact;
  const lastOfPage = steps.map((step) => step.page.id).lastIndexOf(anchor.pageId);
  return lastOfPage === -1 ? 0 : lastOfPage;
}

/** The screen before there is anything to put on it. */
function bootPanels(message: string): Panel[] {
  const lines = wrap(message, BODY_WIDTH, BODY_LINES);
  return [
    {
      id: CONTAINER.frame,
      rect: FRAME,
      text: clipCells("lo", frameCells()),
      brightness: INK,
      bordered: true,
      padding: FRAME_PADDING,
      zOrder: 0,
    },
    {
      id: CONTAINER.note,
      rect: noteRect(lines),
      text: lines.join("\n"),
      brightness: MUTED,
      bordered: false,
      padding: 0,
      zOrder: 7,
    },
  ];
}

export async function createGlassesDisplay(
  bridge: EvenAppBridge,
  bootMessage = "Connecting to your phone",
): Promise<GlassesDisplay> {
  const painter: Painter = await createPainter(bridge, bootPanels(bootMessage));

  // Where you are standing is where lo opens and so is this.
  let anchor: Anchor = { pageId: "here", screen: 0 };
  // On the dashboard, which is where every launch starts and where a double tap
  // eventually returns everybody.
  let depth: Depth = 0;
  // Which group of the page the reader has picked out, which entry of it they are
  // on, and which screenful of that entry. All three are kept across a step out
  // and back in, so a reader who left the letters to check the time comes back to
  // the letter they were reading rather than to the top of the app.
  let chosen: string | null = null;
  let at: ItemRef | null = null;
  let reading = 0;
  let latest: PageContext | null = null;
  let latestStatus = "";
  let taken: Takeover | null = null;
  // What the last paint actually said in the corner. Kept rather than worked out
  // again on demand, because the honest answer to "where is the reader" is the
  // one that is on the glass.
  let shownPath = ROOT;
  // The entry the reader is actually reading whole, where it is one that keeps
  // its words somewhere else — which today means a newswire row, whose story is
  // a read of lo's own. Kept from the paint for the same reason the path above
  // is: what is worth fetching is what is on the glass, not what some other part
  // of the app has worked out ought to be. Null at every other depth, and on
  // every entry that already carries what it says (see main.ts).
  let shownRead: ReadRef | null = null;
  // And which entry that screen is reading, whichever kind it turned out to be —
  // kept off the same paint, for the same reason: what is in front of the reader
  // is what the glass says is, not what some other part of the app has worked out
  // ought to be by now.
  let shownOpen: ItemRef | null = null;

  /** The place, the hour, the badge and whatever is being said — the same on every screen. */
  function surround(context: PageContext): Chrome {
    return {
      place: formatPlace(context.place),
      time: clockFace(context),
      status: latestStatus,
      unread: context.unread,
      mail: context.t("mail.badge"),
    };
  }

  /** The groups a page is offering to be chosen between, in the order it lists them. */
  function groupsOf(view: PageView): Span[] {
    return view.block.kind === "readings" ? spans(view.block.rows) : [];
  }

  /**
   * The screenful under the page the anchor names, or `null` where there is no
   * longer anything under it — a country that stopped feeding this page, a
   * sign-out that emptied every list.
   *
   * It is also the one place that knows whether the level the reader is on still
   * exists, so it is the one place allowed to move them up a level: a group whose
   * entries have all gone, or a sentence with nothing behind it, leaves them
   * standing one step further out rather than on a screen with nothing on it.
   * Going further out than that is the caller's, and it does it by drawing the
   * dashboard instead.
   */
  function inside(context: PageContext): Inside | null {
    const page = offeredPages(context).find(({ id }) => id === anchor.pageId);
    if (!page) return null;
    const view = page.render(context);
    const groups = groupsOf(view);
    if (groups.length === 0) return null;

    // Which group, by name. A group that has gone — a country that stopped
    // feeding its listings — leaves the reader on the first of what is left
    // rather than on a number that now points at something else.
    let picked = groups.findIndex((group) => group.id === chosen);
    if (picked === -1) picked = 0;
    chosen = groups[picked].id;

    // Everything filed under it. Only that group: the reader chose it one level
    // up, and a wheel that carried them out of the letters and into the posts
    // would be undoing the choice they had just made.
    const items =
      depth > CHOOSING ? (page.items?.(context) ?? []).filter((item) => item.group === chosen) : [];
    if (depth > CHOOSING && items.length === 0) depth = CHOOSING;

    if (depth === CHOOSING) {
      // The page as it always was, with a box round one group of it. The path is
      // still the page's own — the reader has not gone anywhere yet, they are
      // deciding where — and the counter is which of the groups on offer.
      return {
        view,
        screen: 0,
        select: picked,
        chrome: { ...surround(context), path: pathOf(page), index: picked + 1, total: groups.length },
        step: picked,
        total: groups.length,
        groups,
        items,
      };
    }

    const focus = locateItem(items, at);
    const item = items[focus];
    // Written back, so that an entry the reader only reached by falling back is
    // the one the next flick of the wheel moves on from.
    at = { group: item.group, key: item.key };
    // Nothing behind a sentence saying a group is empty, so a reader who is
    // somehow standing behind one is put back in front of it.
    if (depth === READING && !item.body) depth = LISTING;

    if (depth === LISTING) {
      return {
        view: listView(items, focus, context.t),
        screen: focus,
        chrome: {
          ...surround(context),
          path: pathOf(page, item.group),
          index: focus + 1,
          total: items.length,
        },
        step: focus,
        total: items.length,
        groups,
        items,
      };
    }

    const read = readView(item);
    // The map, for the one kind of entry that stands somewhere: a venue carries
    // its spot and nothing else does (see pages/types.ts). Built here rather
    // than by the page because it needs three things no page holds together —
    // the reader's own fix, the handset's compass, and the router's answer,
    // which arrives on the feed store like everything else and is started by
    // main.ts when this screen goes up. Until it lands, `data` is null and the
    // map dashes a straight line; the rasteriser memoises against its own
    // inputs, so a repaint that moved nothing draws nothing (see navmap.ts).
    if (item.spot && context.coords) {
      read.map = navMap({
        user: context.coords,
        heading: context.heading.heading,
        target: item.spot,
        route: context.route(item.key).data,
        roads: context.roads(item.key).data,
      });
    }
    const total = screens(read);
    // A post that was four screenfuls when the reader stepped into it and is two
    // now — because the language changed under it, or because this is a repaint
    // of something that has been edited — leaves them on the last of what is
    // left rather than on a screen that is no longer there.
    reading = Math.min(Math.max(reading, 0), total - 1);
    return {
      view: read,
      screen: reading,
      chrome: {
        ...surround(context),
        path: pathOf(page, item.group),
        index: reading + 1,
        total,
      },
      step: reading,
      total,
      groups,
      items,
      // Only here, at the bottom of the app: the reader has opened this one
      // entry and nothing else, which is the whole of what makes fetching its
      // story worth a request. An entry that carries its own words — a post, a
      // letter — has no link and so asks for nothing.
      read: item.link ? { link: item.link, group: item.group, title: item.line } : undefined,
      // And the entry itself, on the same one screen, whether or not it has a
      // story behind it. A letter is the case that made this necessary: it
      // carries its own words, so it never sets `read`, and it is nevertheless
      // the thing two errands out here need to be able to name.
      open: { group: item.group, key: item.key },
    };
  }

  function draw(): void {
    if (!latest) return;

    // The screen in front of everything, where there is one. It wears the same
    // chrome as a page — the place, the hour, whatever the status line has to say
    // — because it is the same screen with a different question on it, and the
    // reader should not have to work out that it is. No path and no counter: it
    // is not anywhere in the app, and it has its own way out (see compose.ts).
    shownRead = null;
    shownOpen = null;
    if (taken) {
      painter.paint(layout(taken.view, 0, surround(latest)));
      return;
    }

    if (depth > 0) {
      const step = inside(latest);
      if (step) {
        shownPath = step.chrome.path ?? ROOT;
        shownRead = step.read ?? null;
        shownOpen = step.open ?? null;
        painter.paint(layout(step.view, step.screen, step.chrome, step.select));
        return;
      }
      // What was under the reader is not there any more. The page it was under
      // still is — that is what the anchor is — so they land back on it rather
      // than on a screen apologising.
      depth = 0;
    }

    const steps = sequence(latest);
    if (steps.length === 0) {
      shownPath = ROOT;
      painter.paint({ panels: bootPanels(latest.t("glasses.empty")), images: [] });
      return;
    }

    const index = locate(steps, anchor);
    const step = steps[index];
    // Written back, so that a screen the anchor only reached by falling back is
    // the one the next scroll moves on from.
    anchor = { pageId: step.page.id, screen: step.screen };

    // Each page says its own name, so the corner is `lo/`, `lo/nearby` and
    // `lo/info` as the wheel goes round — and the counter beside it is which of
    // the three, which is the one thing a reader on a ring of pages cannot work
    // out from what is in front of them.
    const chrome: Chrome = {
      ...surround(latest),
      path: pathOf(step.page),
      index: index + 1,
      total: steps.length,
    };
    shownPath = chrome.path ?? ROOT;
    painter.paint(layout(step.view, step.screen, chrome));
  }

  return {
    render(context, status = "") {
      latest = context;
      latestStatus = status;
      draw();
    },

    scroll(direction) {
      if (!latest) return;
      // The wheel belongs to whatever has the screen. While the composer has it
      // the wheel is choosing between two answers rather than walking anything,
      // and a sequence that moved underneath it would put the reader somewhere
      // they never scrolled to (see main.ts).
      if (taken) return;

      // Round rather than stopping at either end, at every depth. On a phone a
      // list resists at its edges because there is a thumb on it and the
      // resistance is felt; a wheel gives nothing back, so an edge there is just
      // a scroll that did nothing.
      if (depth > 0) {
        const step = inside(latest);
        if (step) {
          // One turn of the wheel, wherever the reader is standing: the next
          // group, the next entry, the next screenful. What that means is the
          // only thing that changes with the depth.
          const next = (step.step + direction + step.total) % step.total;
          if (depth === CHOOSING) chosen = step.groups[next].id;
          else if (depth === LISTING) at = { group: step.items[next].group, key: step.items[next].key };
          else reading = next;
          draw();
          return;
        }
        depth = 0;
      }

      const steps = sequence(latest);
      if (steps.length === 0) return;
      const next = (locate(steps, anchor) + direction + steps.length) % steps.length;
      anchor = { pageId: steps[next].page.id, screen: steps[next].screen };
      draw();
    },

    enter() {
      if (!latest || taken) return;

      if (depth === 0) {
        const page = offeredPages(latest).find(({ id }) => id === anchor.pageId);
        // Nothing behind the standing page, which is instruments rather than a
        // list of anything, and nothing behind a page whose country feeds none
        // of its groups. A tap that boxed a group that was not there would be a
        // step the reader has to take back.
        if (!page || groupsOf(page.render(latest)).length === 0) return;
        depth = CHOOSING;
        draw();
        return;
      }

      if (depth === CHOOSING) {
        depth = LISTING;
        draw();
        return;
      }

      if (depth === LISTING) {
        const step = inside(latest);
        // A group with nothing in it is one entry saying so, and there is
        // nothing behind that sentence but itself (see pages/list.ts).
        if (!step?.items[step.step]?.body) return;
        depth = READING;
        reading = 0;
        draw();
      }
    },

    back() {
      // The composer answers its own double tap, and it answers it by throwing a
      // sentence away — which is not a step out of anywhere (see main.ts).
      if (taken || depth === 0) return false;
      depth = (depth - 1) as Depth;
      draw();
      return true;
    },

    takeover(screen) {
      taken = screen;
      draw();
    },

    current() {
      return taken?.id ?? anchor.pageId;
    },

    path() {
      return taken ? "" : shownPath;
    },

    reading() {
      return taken ? null : shownRead;
    },

    opened() {
      return taken ? null : shownOpen;
    },

    shutdown() {
      return painter.shutdown();
    },
  };
}

/**
 * What runs in an ordinary browser, where there is no bridge and so no glasses.
 * The phone view is lo's own website in a frame (see webui.ts) and draws itself,
 * so there is genuinely nothing for this to do — it exists so main.ts can be
 * written once, against a display that is always there.
 */
export function createBrowserDisplay(): GlassesDisplay {
  let pageId: string | null = null;
  let taken: string | null = null;
  return {
    render(context) {
      pageId = offeredPages(context)[0]?.id ?? null;
    },
    scroll() {},
    enter() {},
    // Never anywhere to come back from, so a double tap here is what it has
    // always been in a browser: the gesture that closes the app.
    back: () => false,
    // Nothing to draw, but the answer to `current` still has to be the truth: the
    // gestures that drive the composer are gated on it (see main.ts).
    takeover(screen) {
      taken = screen?.id ?? null;
    },
    current: () => taken ?? pageId,
    // Nothing is ever read whole in a browser: the phone view is lo's own site
    // in a frame and does its own reading, its own marking read and its own
    // replying (see webui.ts).
    reading: () => null,
    opened: () => null,
    path: () => ROOT,
    async shutdown() {},
  };
}
