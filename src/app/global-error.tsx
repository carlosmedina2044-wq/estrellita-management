"use client";

import { useEffect } from "react";
import { detectDeviceLocale, translate } from "@/i18n";

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
          <h1 style={{ fontSize: 28, margin: "20px 0 0" }}>{t("error.somethingWrong")}</h1>
          <p style={{ color: "#86868b", marginTop: 8, fontSize: 14 }}>
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
              background: "#1d1d1f",
              color: "#f7f3ec",
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
