"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f3ec",
          color: "#1d1d1f",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
        }}
      >
        <main style={{ maxWidth: 28 * 16, padding: 20 }}>
          {/* Isolated document — next/image is unavailable here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/cuidala-wordmark.webp"
            alt="Cuidala"
            width={116}
            height={32}
            style={{ height: 32, width: "auto" }}
          />
          <h1 style={{ fontSize: 28, margin: "20px 0 0" }}>Something went wrong</h1>
          <p style={{ color: "#86868b", marginTop: 8, fontSize: 14 }}>
            Cuidala failed to start. Try again. Household data on this device was not
            overwritten.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 24,
              height: 48,
              width: "100%",
              border: 0,
              borderRadius: 12,
              background: "#1d1d1f",
              color: "#f7f3ec",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
