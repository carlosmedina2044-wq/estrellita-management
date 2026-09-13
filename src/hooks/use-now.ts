"use client";

import { useEffect, useState } from "react";
import { parseISODate, toISODate } from "@/lib/dates";
import { isNative } from "@/lib/native/platform";

/**
 * Calendar "today" that advances when the app resumes, becomes visible, or the
 * local date rolls over (checked every 60s). Avoids a frozen mount-time clock.
 */
export function useNow(): Date {
  const [day, setDay] = useState(() => toISODate(new Date()));

  useEffect(() => {
    const sync = () => {
      const next = toISODate(new Date());
      setDay((current) => (current === next ? current : next));
    };

    const onVis = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVis);
    const interval = window.setInterval(sync, 60_000);

    let removeResume: (() => void) | undefined;
    if (isNative()) {
      void import("@capacitor/app")
        .then(async ({ App }) => {
          const handle = await App.addListener("resume", sync);
          removeResume = () => {
            void handle.remove();
          };
        })
        .catch(() => {});
    }

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(interval);
      removeResume?.();
    };
  }, []);

  return new Date(parseISODate(day));
}
