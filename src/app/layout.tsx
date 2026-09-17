import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

// Enforced in the bundled WKWebView and on the web shell alike.
// script-src keeps 'unsafe-inline' because Next.js static export emits inline
// hydration bootstrap scripts whose hashes change per build. Compensating
// controls: no third-party scripts, no HTML rendered from user input.
// WeatherKit is native (not WKWebView fetch). frame-ancestors is ignored in
// meta tags so it is omitted.
const CSP = [
  "default-src 'self'",
  // next dev needs eval for React refresh; production/static export does not.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export const metadata: Metadata = {
  title: "Cuidala",
  description: "Home maintenance, restock, and seasonal checklists on your iPhone.",
  applicationName: "Cuidala",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Cuidala" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Cuidala",
    description: "Home maintenance, restock, and seasonal checklists on your iPhone.",
    siteName: "Cuidala",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ef" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1a16" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

// Applies the evening "today-night" look before first paint, from a plain
// (non-vault) localStorage cache written by `today-view.tsx`'s real decision
// after hydration. `today-night` is a UI-only hint, not the encrypted
// household data, so a synchronous `window.localStorage` read here is safe —
// unlike the vault, it deliberately does not go through `lib/native/kv.ts`
// (Capacitor Preferences is async and unavailable this early). Worst case on
// a cache miss is today's status quo: one frame of cream before the real sky
// phase resolves.
const NIGHT_BOOTSTRAP_SCRIPT = `(function(){try{if(localStorage.getItem("cuidala-today-night")==="1"){document.documentElement.classList.add("today-night");}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
        <script dangerouslySetInnerHTML={{ __html: NIGHT_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
