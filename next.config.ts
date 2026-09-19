import type { NextConfig } from "next";

/**
 * The app ships as a static bundle inside the Capacitor iOS shell. There is no
 * server: weather is fetched on-device via WeatherKit, and all data stays on device.
 * Security headers for the web shell are set by the host (see vercel.json);
 * the Content-Security-Policy is also emitted as a meta tag in app/layout.tsx
 * so it applies inside the WKWebView bundle.
 *
 * The fixture routes under `src/app/dev/**` are named `page.dev.tsx`, and
 * `.dev.tsx` only counts as a page extension outside a production build. They
 * used to guard themselves with `notFound()`, which replaces the HTML but
 * still emits `out/dev/**` and a chunk carrying the fixtures — and `cap sync`
 * copied all of it into the App Store bundle. `npm run dev` still serves them.
 */
const devPageExtensions = process.env.NODE_ENV === "production" ? [] : ["dev.tsx"];

const nextConfig: NextConfig = {
  output: "export",
  pageExtensions: ["tsx", "ts", "jsx", "js", ...devPageExtensions],
  trailingSlash: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "1.0.0" },
};

export default nextConfig;
