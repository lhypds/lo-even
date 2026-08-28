// Throwaway: print where every measured box actually stands, in pixels and in
// the cells the paper proof draws them on.
import { CHAR_WIDTH, EDGE, FOOT_PAGER, FRAME, HEAD_META, HEAD_TIME, SCREEN_WIDTH } from "../theme";
import { textWidth } from "../metrics";

const show = (name: string, r: { x: number; width: number }) =>
  console.log(
    `${name.padEnd(10)} x=${String(r.x).padStart(4)} w=${String(r.width).padStart(4)}` +
      ` right=${String(r.x + r.width).padStart(4)}` +
      ` cellRight=${Math.round((r.x + r.width) / CHAR_WIDTH)}`,
  );

console.log(`SCREEN=${SCREEN_WIDTH} EDGE=${EDGE} gutter=${SCREEN_WIDTH - EDGE} cols=${Math.round(SCREEN_WIDTH / CHAR_WIDTH)}`);
show("FRAME", FRAME);
show("HEAD_TIME", HEAD_TIME);
show("HEAD_META", HEAD_META);
show("FOOT_PAGER", FOOT_PAGER);
console.log(`corner widest = ${textWidth("msg (99+) · 00:00")}`);
console.log(`corner typical = ${textWidth("msg (2) · 14:32")}`);
