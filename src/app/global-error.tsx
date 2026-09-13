"use client";

import { useEffect } from "react";
import { detectDeviceLocale, translate } from "@/i18n";

const GLOBAL_ERROR_THEME_CSS = `
:root {
  color-scheme: light dark;
  --ge-bg: #faf6ef;
  --ge-fg: #1f1a16;
  --ge-muted: #6b635c;
  --ge-btn-bg: #1f1a16;
  --ge-btn-fg: #faf6ef;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ge-bg: #1f1a16;
    --ge-fg: #faf6ef;
    --ge-muted: #b7aea5;
    --ge-btn-bg: #faf6ef;
    --ge-btn-fg: #1f1a16;
  }
}
`;

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const locale = detectDeviceLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es" : "en"}>
      <head>
        <style>{GLOBAL_ERROR_THEME_CSS}</style>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--ge-bg)",
          color: "var(--ge-fg)",
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
          <h1 style={{ fontSize: 28, margin: "20px 0 0" }}>{t("error.somethingWrong")}</h1>
          <p style={{ color: "var(--ge-muted)", marginTop: 8, fontSize: 14 }}>
            {t("error.globalBody")}
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
              background: "var(--ge-btn-bg)",
              color: "var(--ge-btn-fg)",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {t("error.tryAgain")}
          </button>
        </main>
      </body>
    </html>
  );
}
