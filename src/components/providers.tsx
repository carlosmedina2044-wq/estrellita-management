"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { useVisualViewport } from "@/hooks/use-visual-viewport";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  useVisualViewport();
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LocaleProvider>
        <MotionConfig reducedMotion="user">
          {children}
          {/* One at a time: the toast is the house answering a chore, and a
              stack of the house talking over itself is noise. Ticking three
              things quickly should read as three answers in turn. */}
          <Toaster
            position="bottom-center"
            visibleToasts={1}
            className="mb-[max(1rem,env(safe-area-inset-bottom))]"
          />
        </MotionConfig>
      </LocaleProvider>
    </ThemeProvider>
  );
}
