import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

// Enforced in the bundled WKWebView and on the web shell alike.
// script-src keeps 'unsafe-inline' because Next.js static export emits inline
// hydration bootstrap scripts whose hashes change per build. Compensating
// controls: no third-party scripts, no HTML rendered from user input, and
// connect-src pinned to Open-Meteo forecast + geocoding (see docs/RESIDUAL_RISKS.md).
const CSP = [
  "default-src 'self'",
  // next dev needs eval for React refresh; production/static export does not.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const metadata: Metadata = {
  title: "Cuidala",
  description: "Home maintenance, restock, and seasonal checklists — on your iPhone.",
  applicationName: "Cuidala",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Cuidala" },
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
    description: "Home maintenance, restock, and seasonal checklists — on your iPhone.",
    siteName: "Cuidala",
  },
};

export const viewport: Viewport = {
  themeColor: "#F7F3EC",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
