"use client";

import { useEffect } from "react";

const FOCUSABLE = "input, textarea, select, [contenteditable='true']";
const KEYBOARD_OPEN_PX = 80;
const PHONE_MAX_PX = 430;
const FALLBACK_KEYBOARD_PX = 346;

let restingHeight = 0;

function keyboardInsetPx(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--keyboard-inset");
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isField(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement && target.matches(FOCUSABLE);
}

function syncViewport() {
  const root = document.documentElement;
  const vv = window.visualViewport;
  const layoutH = window.innerHeight;
  const vvHeight = vv?.height ?? layoutH;
  const offsetTop = vv?.offsetTop ?? 0;
  const overlayInset = Math.max(0, layoutH - vvHeight - offsetTop);
  const focused = isField(document.activeElement);
  const phone = window.innerWidth <= PHONE_MAX_PX;
  const inSheet =
    focused &&
    Boolean(
      document.activeElement?.closest("[data-keyboard-scroll], [data-slot='sheet-content']"),
    );

  if (!focused && overlayInset < KEYBOARD_OPEN_PX) {
    restingHeight = Math.max(restingHeight, layoutH, vvHeight);
  } else if (restingHeight === 0) {
    restingHeight = Math.max(layoutH, vvHeight);
  }

  let inset = overlayInset;
  let visibleH = vvHeight;

  // Overlay keyboards that never shrink visualViewport (some iOS / narrow-desktop cases).
  const alreadyShrunk = restingHeight - vvHeight > KEYBOARD_OPEN_PX;
  if (inSheet && phone && overlayInset < KEYBOARD_OPEN_PX && !alreadyShrunk) {
    inset = Math.round(Math.min(layoutH * 0.42, FALLBACK_KEYBOARD_PX));
    visibleH = Math.max(240, layoutH - inset);
  }

  root.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
  root.style.setProperty("--visual-viewport-height", `${Math.round(visibleH)}px`);
  root.classList.toggle("keyboard-open", inset > KEYBOARD_OPEN_PX || (focused && alreadyShrunk));
}

function scrollFocusedField(target: EventTarget | null) {
  if (!isField(target)) return;

  const run = () => {
    const scroller = target.closest<HTMLElement>("[data-keyboard-scroll]");
    const rect = target.getBoundingClientRect();
    const vv = window.visualViewport;
    const visibleTop = vv?.offsetTop ?? 0;
    const visibleBottom = vv ? vv.height + vv.offsetTop : window.innerHeight;

    if (scroller) {
      const parentRect = scroller.getBoundingClientRect();
      const topLimit = Math.max(parentRect.top + 12, visibleTop + 8);
      const bottomLimit = Math.min(parentRect.bottom - 12, visibleBottom - 12);
      if (rect.top >= topLimit && rect.bottom <= bottomLimit) return;
      const overflowBottom = rect.bottom - bottomLimit;
      const overflowTop = topLimit - rect.top;
      if (overflowBottom > 0) scroller.scrollBy({ top: overflowBottom + 20, behavior: "smooth" });
      else if (overflowTop > 0) scroller.scrollBy({ top: -(overflowTop + 20), behavior: "smooth" });
      return;
    }

    const extra = 24;
    const limit = visibleBottom - Math.max(keyboardInsetPx(), 0) - extra;
    if (rect.bottom <= limit && rect.top >= 72) return;
    target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(run);
    window.setTimeout(run, 120);
    window.setTimeout(run, 320);
  });
}

export function useVisualViewport() {
  useEffect(() => {
    restingHeight = window.innerHeight;
    const vv = window.visualViewport;
    const onViewport = () => {
      syncViewport();
      scrollFocusedField(document.activeElement);
    };
    syncViewport();
    vv?.addEventListener("resize", onViewport);
    vv?.addEventListener("scroll", onViewport);
    window.addEventListener("orientationchange", onViewport);
    window.addEventListener("resize", onViewport);
    const onFocus = (event: FocusEvent) => {
      syncViewport();
      scrollFocusedField(event.target);
    };
    const onBlur = () => window.setTimeout(syncViewport, 80);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    return () => {
      vv?.removeEventListener("resize", onViewport);
      vv?.removeEventListener("scroll", onViewport);
      window.removeEventListener("orientationchange", onViewport);
      window.removeEventListener("resize", onViewport);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
    };
  }, []);
}
