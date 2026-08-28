// iOS never hands the keyboard a layout viewport. It shrinks the *visual*
// viewport, leaves the layout viewport at its full height, and then shifts the
// visual viewport around inside it to keep the focused field in sight. A frame
// that is `100dvh` tall over a document that cannot scroll gives WebKit nothing
// to scroll, so the shift is all it has left — and whether it bothers depends on
// what the previous focus left behind, which is why the jump arrives on every
// other tap rather than every one.
//
// Publishing the visual viewport's own height and offset as CSS variables takes
// that decision away from WebKit. The frame is never taller than the space above
// the keyboard, so the field lo is focusing is already on screen: the site
// scrolls its own login form into place inside the frame and this side stays put.
export function trackVisualViewport(): void {
  const viewport = window.visualViewport;
  if (!viewport) return;

  const root = document.documentElement;
  let pending = 0;

  const sync = () => {
    pending = 0;
    root.style.setProperty("--vv-height", `${viewport.height}px`);
    root.style.setProperty("--vv-top", `${viewport.offsetTop}px`);
    // `--vv-top` follows the visual viewport moving inside the layout viewport.
    // A shift WebKit put on the document itself is a different animal and ours
    // to undo — nothing here is ever meant to be scrolled.
    if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
  };

  // The keyboard animates, and both events fire through the whole animation.
  // One write per frame is enough, and it keeps the frame's height from
  // thrashing the site's layout on the way up.
  const schedule = () => {
    if (pending) return;
    pending = requestAnimationFrame(sync);
  };

  viewport.addEventListener("resize", schedule);
  viewport.addEventListener("scroll", schedule);
  window.addEventListener("orientationchange", schedule);
  sync();
}
