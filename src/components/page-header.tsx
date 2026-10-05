"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  action,
  onBack,
  backLabel,
}: {
  title: string;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}) {
  const { t } = useLocale();
  const resolvedBackLabel = backLabel ?? t("common.back");
  const titleRef = useRef<HTMLHeadingElement>(null);
  // The large title collapses into a compact bar once it scrolls away, the way
  // a navigation bar does. Observed rather than scroll-listened: no per-frame
  // work, and it follows whichever ancestor is doing the scrolling.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const node = titleRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only a title that has left through the top counts. A hidden pane
        // measures zero-height, and the scroller clips the title below the
        // safe-area padding (so its own box can still sit at a positive y),
        // hence "above the middle of the screen" rather than "above zero".
        const box = entry.boundingClientRect;
        setCollapsed(!entry.isIntersecting && box.height > 0 && box.top < window.innerHeight / 2);
      },
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      <div aria-hidden className="app-nav-bar" data-visible={collapsed ? "true" : "false"}>
        <span className="app-nav-bar-title">{title}</span>
        {onBack ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={onBack}
            className="app-nav-bar-back"
            data-visible={collapsed ? "true" : "false"}
          >
            <ChevronLeft className="size-6" aria-hidden />
            <span className="ui-body">{t("common.back")}</span>
          </button>
        ) : null}
      </div>
      {onBack ? (
        // A navigation bar's back control: chevron and word in the tint, on
        // its own row above the large title, like every iPhone screen that
        // was pushed. VoiceOver still hears where it goes.
        <button
          type="button"
          aria-label={resolvedBackLabel}
          onClick={onBack}
          className="-ml-2 flex min-h-11 basis-full items-center gap-0.5 self-start rounded-lg pr-3 pl-1 text-primary ui-press"
        >
          <ChevronLeft className="size-6" aria-hidden />
          <span className="ui-body">{t("common.back")}</span>
        </button>
      ) : null}
      <div className="flex min-w-min flex-1 basis-0 items-start gap-1">
        <div className="min-w-0">
          {eyebrow ? <p className="ui-caption text-muted-foreground">{eyebrow}</p> : null}
          <h1 ref={titleRef} className="ui-heading ui-display font-semibold tracking-tight">{title}</h1>
          {subtitle ? <div className="mt-1 ui-caption text-muted-foreground">{subtitle}</div> : null}
        </div>
      </div>
      <div className="flex min-h-11 min-w-11 shrink-0 items-center justify-center">{action ?? null}</div>
    </header>
  );
}
