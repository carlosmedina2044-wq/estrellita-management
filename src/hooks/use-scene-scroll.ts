"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Scroll behaviour shared by the two screens that pin a scene under a sheet
 * (Today and Home): it softens the scene with a stepped blur as the page
 * scrolls, and reports when the scene has scrolled far enough that the compact
 * title bar should show.
 *
 * `rootRef` is the screen's root element; the scroll container is its nearest
 * `.app-keep-alive` pane, and the blur lands on its `[data-scene-blur]` child.
 */
export function useSceneScroll(rootRef: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [compactBar, setCompactBar] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const pane = rootRef.current?.closest(".app-keep-alive");
    if (!(pane instanceof HTMLElement)) return;
    // Queried once per mount, not once per scroll frame: the node this
    // selector finds does not change while the scene is up.
    const blur = rootRef.current?.querySelector("[data-scene-blur]");
    const blurEl = blur instanceof HTMLElement ? blur : null;
    let frame = 0;
    // `backdrop-filter` is the most expensive property in this scroll: every
    // distinct blur radius forces the browser to re-sample and re-composite
    // whatever sits behind the scene, every frame, for the whole first 120px
    // of scroll — exactly the moment someone is judging how the app feels.
    // Snapping to a handful of steps reads as continuous (a new level every
    // 24px of scroll) while cutting DOM writes by well over 90%.
    const BLUR_STEPS = 5;
    const MAX_BLUR_PX = 12;
    let lastStep = -1;
    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        // Clamp against iOS rubber-band overscroll: .app-keep-alive can report a
        // momentary negative scrollTop while it elastically bounces at the top,
        // which previously fed straight into the scene's transform and made the
        // art visibly bounce. The scene itself no longer transforms on scroll —
        // it is `position: sticky` (see the wrapper below) so the browser pins it
        // natively and the sheet slides up to cover it with no seam, instead of
        // two independently JS-driven layers racing at different speeds.
        const y = Math.max(0, pane.scrollTop);
        const step = Math.round(Math.min(y / 120, 1) * BLUR_STEPS);
        if (step !== lastStep) {
          lastStep = step;
          if (blurEl) {
            const amount = (step / BLUR_STEPS) * MAX_BLUR_PX;
            blurEl.style.backdropFilter = `blur(${amount}px)`;
            blurEl.style.setProperty("-webkit-backdrop-filter", `blur(${amount}px)`);
          }
        }
        setCompactBar(y > 120);
      });
    };
    pane.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      pane.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [enabled, rootRef]);
  return compactBar;
}
