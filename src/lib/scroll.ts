import { scrollBehavior } from "@/lib/motion";

/** The panes and sheets that actually scroll. Ordered from innermost out. */
const SCROLLERS = ".app-shell-push, .app-keep-alive, [data-keyboard-scroll]";

/**
 * Bring `el` into view by scrolling its own pane, on the vertical axis only.
 *
 * `Element.scrollIntoView` is the obvious call here and it is the wrong one.
 * It scrolls *every* scrollable ancestor on *both* axes, and `overflow: hidden`
 * still leaves a box programmatically scrollable — so a pane that never shows a
 * horizontal scrollbar can still be scrolled sideways and left there.
 *
 * That is exactly what happened opening a seasonal job from Today: the pane
 * animates in from `translateX(100%)`, the effect that focuses the job runs on
 * the first frame while it is still off to the right, and WebKit dutifully
 * scrolled the pane sideways to reach it. The animation then settled back to
 * `translateX(0)` and left the pane scrolled — the screen showed a slice of the
 * cards against a field of empty background.
 *
 * Setting `scrollTop` on one known container cannot do that. The measurement is
 * a difference of two rects inside the same transformed subtree, so a transform
 * mid-animation cancels out and the target lands in the right place whether or
 * not the pane has finished arriving.
 */
export function scrollIntoViewVertically(
  el: Element | null | undefined,
  block: "center" | "start" = "center",
): void {
  if (!el) return;
  const scroller = el.closest<HTMLElement>(SCROLLERS);
  if (!scroller) {
    // Nothing recognisable to scroll: fall back, but never on the inline axis.
    el.scrollIntoView({ behavior: scrollBehavior(), block, inline: "nearest" });
    return;
  }
  const target = el.getBoundingClientRect();
  const box = scroller.getBoundingClientRect();
  const offset = target.top - box.top;
  const delta = block === "center" ? offset - (scroller.clientHeight - target.height) / 2 : offset;
  scroller.scrollTo({ top: scroller.scrollTop + delta, behavior: scrollBehavior() });
}
