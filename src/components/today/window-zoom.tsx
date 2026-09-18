"use client";

import { AnimatePresence, motion } from "motion/react";
import { DUR_SCREEN, EASE_OUT } from "@/lib/motion";

export type WindowZoom = { x: number; y: number; w: number; h: number; key: number };

/**
 * Tapping a lit window used to switch tabs and slide a sheet up from nowhere:
 * two unrelated movements where the user had just pointed at one specific
 * thing. This carries the tap out of the window itself — the pane of light
 * grows toward the viewer and dissolves as the room's sheet rises behind it,
 * so the sheet reads as what was inside that window.
 *
 * It grows toward the screen's centre rather than onto the sheet's own header
 * art. Landing on the header would be a closer match, but the sheet has not
 * mounted when this starts, so its position would have to be guessed — and a
 * flight that lands slightly off is worse than one that never claimed a
 * target. Purely decorative and never interactive: it is gone in 400ms and
 * the sheet underneath is already usable.
 */
export function WindowZoomLayer({ zoom }: { zoom: WindowZoom | null }) {
  return (
    <AnimatePresence>
      {zoom ? (
        <motion.div
          key={zoom.key}
          aria-hidden
          className="pointer-events-none fixed z-50 rounded-lg"
          style={{
            left: zoom.x,
            top: zoom.y,
            width: zoom.w,
            height: zoom.h,
            background:
              "radial-gradient(closest-side, rgba(255, 224, 176, 0.95), rgba(255, 214, 150, 0.45) 60%, transparent 85%)",
            transformOrigin: "center",
          }}
          initial={{ opacity: 0.9, scale: 1 }}
          animate={{ opacity: 0, scale: 7 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR_SCREEN, ease: EASE_OUT }}
        />
      ) : null}
    </AnimatePresence>
  );
}
