// The only thing here that talks to the glasses.
//
// Everything above this file deals in panels — rectangles of type — and this
// turns them into bridge calls. It exists as its own module for one reason: the
// difference between the two calls it can make is worth a lot, and deciding
// between them is arithmetic rather than judgement.
//
//   • `rebuildPageContainer` throws the page away and builds it again. It is the
//     SDK's own way of changing a page and is what a card switch needs, because
//     a different card is a different set of containers in different places.
//   • `textContainerUpgrade` writes a string into a container that is already
//     there. It is what a clock tick needs, and a status line, and a list whose
//     rows came back from a refresh unchanged in shape.
//
// So the painter keeps two things: what shape the page is (the signature) and
// what each container currently says. A different shape has to be rebuilt. The
// same shape is written into — but only up to a point, because an update is a
// round trip too, and enough of them cost more than the one rebuild they were
// avoiding. So the rule is three-way: rebuild a different page, rebuild a page
// where most of the lines have changed anyway, and write into the rest.
//
// A minute of the clock ticking is one short write rather than a page rebuilt.
// Stepping from the clock to the weather is a rebuild, even though those two
// cards happen to have the same shape and the signature says so — every line of
// it is different, and seven updates queued on a BLE link land later than one
// page does.

import {
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  type EvenAppBridge,
} from "@evenrealities/even_hub_sdk";
import { signature, type Panel } from "./layout";
import { CONTAINER, FRAME_BORDER_COLOR, FRAME_BORDER_RADIUS, FRAME_BORDER_WIDTH } from "./theme";

export interface Painter {
  /** Put this on the glasses. Returns at once; the writing is queued. */
  paint(panels: Panel[]): void;
  shutdown(): Promise<void>;
}

/**
 * The host answered, and what it said was no.
 *
 * It is worth its own kind of error because of what it is *not*: a package
 * running in an ordinary browser cannot reach a native handler at all, and the
 * call rejects before any of this. That is development, and the right answer to
 * it is to draw nothing and get on with the phone view. This is the other thing —
 * a real Even App, a real pair of glasses, and a start-up page they would not
 * make — and the right answer to that is to say so, because every gesture after
 * it will go on arriving from a touchpad attached to a screen with nothing on it
 * (see main.ts).
 *
 * The codes are the host's own: 1 invalid, 2 oversize, 3 out of memory.
 */
export class PageRefused extends Error {
  readonly code: number;

  constructor(code: number) {
    super(`the glasses would not take the start-up page (${code})`);
    this.name = "PageRefused";
    this.code = code;
  }
}

// Past this many changed lines, rebuilding the page beats writing them one at a
// time. An update is a smaller message than a rebuild but it is still a round
// trip, and on a BLE link the round trips are what cost — one rebuild carrying
// eight containers lands sooner than seven updates queued behind each other.
//
// Three is where the two kinds of change fall either side. A minute turning over
// is one line; a page turned inside a list is three columns; stepping from the
// clock to the weather is seven, because those two cards have the same shape and
// so every line of it is different. That last one is why this exists at all — the
// signature says the page has not changed, and it is right, but "same page" and
// "cheaper to update" turn out to be different questions.
const UPGRADE_LIMIT = 3;

// The name goes out with every call beside the id. Derived rather than stored so
// that the two can never disagree — the firmware matches on both.
function nameFor(id: number): string {
  return `lo${id}`;
}

function toProperty(panel: Panel): TextContainerProperty {
  return new TextContainerProperty({
    xPosition: panel.rect.x,
    yPosition: panel.rect.y,
    width: panel.rect.width,
    height: panel.rect.height,
    borderWidth: panel.bordered ? FRAME_BORDER_WIDTH : 0,
    borderColor: panel.bordered ? FRAME_BORDER_COLOR : 0,
    borderRadius: panel.bordered ? FRAME_BORDER_RADIUS : 0,
    // Whatever gutter the panel asked for, which is nothing for all but the
    // frame: a body column is placed where it is meant to be and padding would
    // shift it off the grid the columns share. It is charged on the top and the
    // bottom as well as the sides, which is what decides where the heading's line
    // sits — and why the box round a chosen group asks for none, a bordered box
    // one line tall having no room to give away (see theme.ts and layout.ts).
    paddingLength: panel.padding,
    containerID: panel.id,
    containerName: nameFor(panel.id),
    content: panel.text,
    textColor: panel.brightness,
    // Exactly one container captures, and it is the one that is on every screen.
    // Two would be two of every event; none risks the page hearing nothing at
    // all. The events the app actually steers by are system-level anyway (a
    // scroll, a tap, a hold — see main.ts), so which container holds this makes
    // no difference beyond there being one.
    isEventCapture: panel.id === CONTAINER.frame ? 1 : 0,
    zOrderIndex: panel.zOrder,
  });
}

export async function createPainter(bridge: EvenAppBridge, boot: Panel[]): Promise<Painter> {
  // The start-up page is not optional — the OS wants it before it will show
  // anything — and it is the one call worth retrying: on a cold start the
  // glasses may still be coming up when the WebView is already running.
  const delays = [0, 200, 500, 1000];
  let created = 1;
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
    created = await bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: boot.length,
        textObject: boot.map(toProperty),
      }),
    );
    if (created === 0) break;
  }
  // And where it still will not, that is the end of this display rather than a
  // line in the console. It used to warn and carry on, which built a painter that
  // wrote every page of the app into a container the glasses had never made: the
  // launch looked well, the wheel and the taps worked, the feeds came back — and
  // nothing was ever on the glass. The first the reader heard of it was a hold on
  // the touchpad failing to open the microphone, which is the same page's absence
  // reported as something else entirely (see main.ts).
  if (created !== 0) throw new PageRefused(created);

  let shape = signature(boot);
  let shown = new Map(boot.map((panel) => [panel.id, panel.text]));

  async function apply(panels: Panel[]): Promise<void> {
    const next = signature(panels);
    const changed = next === shape ? panels.filter((panel) => shown.get(panel.id) !== panel.text) : panels;

    if (next !== shape || changed.length > UPGRADE_LIMIT) {
      await bridge.rebuildPageContainer(
        new RebuildPageContainer({
          containerTotalNum: panels.length,
          textObject: panels.map(toProperty),
        }),
      );
      shape = next;
      shown = new Map(panels.map((panel) => [panel.id, panel.text]));
      return;
    }

    for (const panel of changed) {
      await bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: panel.id,
          containerName: nameFor(panel.id),
          contentOffset: 0,
          contentLength: panel.text.length,
          content: panel.text,
        }),
      );
      shown.set(panel.id, panel.text);
    }
  }

  // One writer at a time, and only ever the newest frame. A reader spinning the
  // scroll wheel produces frames faster than the link can carry them, and a
  // queue of every one of them would keep drawing pages the reader has already
  // scrolled past; holding just the latest means the display lands on where they
  // actually stopped.
  let pending: Panel[] | null = null;
  let writing = false;

  function paint(panels: Panel[]): void {
    pending = panels;
    if (writing) return;
    writing = true;
    void (async () => {
      while (pending) {
        const next = pending;
        pending = null;
        try {
          await apply(next);
        } catch (error) {
          // A dropped frame is not worth stopping the loop for: the next paint
          // carries the whole page anyway, and a rebuild after a failed upgrade
          // puts everything back in step.
          console.error("could not paint the glasses", error);
        }
      }
      writing = false;
    })();
  }

  return {
    paint,
    async shutdown() {
      await bridge.shutDownPageContainer(0);
    },
  };
}
