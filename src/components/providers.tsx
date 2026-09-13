"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { useVisualViewport } from "@/hooks/use-visual-viewport";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  useVisualViewport();
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
      <Toaster position="bottom-center" className="mb-[max(1rem,env(safe-area-inset-bottom))]" />
    </ThemeProvider>
  );
}
