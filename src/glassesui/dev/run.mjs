// Runs one of the tools in this folder under node.
//
// They are browser code — the display talks to an Even bridge, and the SDK
// behind it installs shadow timers over `window` the moment it is imported — so
// there has to be enough of a browser here for that import to succeed. Nothing
// below is a working DOM; it is the handful of names the SDK reaches for on the
// way up, and it exists so a layout can be checked without a pair of glasses on
// the desk.

import { pathToFileURL } from "node:url";
import { join } from "node:path";

globalThis.window = {
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  cancelAnimationFrame: clearTimeout,
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  screen: {},
  location: { href: "http://localhost/" },
};

globalThis.document = {
  readyState: "complete",
  addEventListener() {},
  querySelector: () => null,
};

const tool = process.env.TOOL;
if (!tool) throw new Error("Set TOOL=preview or TOOL=drive");
await import(pathToFileURL(join(process.cwd(), ".tools", `${tool}.js`)).href);
