"use client";

import { useEffect } from "react";
import { detectDeviceLocale, translate } from "@/i18n";

const GLOBAL_ERROR_THEME_CSS = `
:root {
  color-scheme: light dark;
  --ge-bg: #f4f1ec;
  --ge-fg: #101418;
  --ge-muted: #5d6670;
  --ge-btn-bg: #101418;
  --ge-btn-fg: #f4f1ec;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ge-bg: #101418;
    --ge-fg: #f4f1ec;
    --ge-muted: #9aa4af;
    --ge-btn-bg: #f4f1ec;
    --ge-btn-fg: #101418;
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
