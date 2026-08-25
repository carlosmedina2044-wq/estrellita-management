import type { NextConfig } from "next";

/**
 * The app ships as a static bundle inside the Capacitor iOS shell. There is no
 * server: weather is fetched on-device via WeatherKit, and all data stays on device.
 * Security headers for the web shell are set by the host (see vercel.json);
 * the Content-Security-Policy is also emitted as a meta tag in app/layout.tsx
 * so it applies inside the WKWebView bundle.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "1.0.0" },
};

export default nextConfig;
