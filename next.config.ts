import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Client bundle has no secrets. BLOB_READ_WRITE_TOKEN is server-only and stores
// ciphertext. The household encryption key is derived from the owner PIN in the browser.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // Dev HMR needs websockets. Production stays same-origin plus the weather/auth APIs.
  isDev
    ? "connect-src 'self' ws: wss: http://localhost:3456 http://127.0.0.1:3456 https://*.trycloudflare.com wss://*.trycloudflare.com https://api.open-meteo.com https://appleid.apple.com https://ai-gateway.vercel.sh"
    : "connect-src 'self' https://api.open-meteo.com https://appleid.apple.com https://ai-gateway.vercel.sh",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  // HTTP localhost + HSTS/upgrade blanks Safari. Only force HTTPS in production.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(), geolocation=(self), payment=(), browsing-topics=(), publickey-credentials-create=(self), publickey-credentials-get=(self)",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // next dev treats Origin: https://*.trycloudflare.com as cross-origin and 403s
  // script tags that send CORS (crossorigin="anonymous"). That leaves the SSR
  // hydration shell blank on iPhone tunnels.
  allowedDevOrigins: ["*.trycloudflare.com", "localhost", "127.0.0.1"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
