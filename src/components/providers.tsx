"use client";

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
        {children}
        <Toaster position="bottom-center" className="mb-[max(1rem,env(safe-area-inset-bottom))]" />
      </LocaleProvider>
    </ThemeProvider>
  );
}
