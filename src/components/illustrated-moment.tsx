"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useReducedMotion } from "motion/react";
import { Illustration } from "@/components/illustration";
import { MOMENTS, type MomentId } from "@/lib/illustrations";
import { cn } from "@/lib/utils";

type LottieAnimation = {
  play: () => void;
  pause: () => void;
  destroy: () => void;
  addEventListener: (name: string, cb: () => void) => void;
  removeEventListener: (name: string, cb: () => void) => void;
};

type LottiePlayer = {
  loadAnimation: (params: {
    container: Element;
    renderer: "svg" | "canvas" | "html";
    loop: boolean;
    autoplay: boolean;
    path?: string;
    animationData?: unknown;
    assetsPath?: string;
    rendererSettings?: { progressiveLoad?: boolean; preserveAspectRatio?: string };
  }) => LottieAnimation;
};

/** Turbopack/CJS interop can yield `{ default: {} }`; never trust a truthy empty default. */
function resolveLottiePlayer(mod: unknown): LottiePlayer {
  const record = mod as Record<string, unknown> | null;
  const candidates = [record, record?.default, (record?.default as Record<string, unknown> | undefined)?.default];
  for (const candidate of candidates) {
    if (
      candidate &&
      typeof candidate === "object" &&
      typeof (candidate as LottiePlayer).loadAnimation === "function"
    ) {
      return candidate as LottiePlayer;
    }
  }
  throw new Error("lottie player export missing loadAnimation");
}

function assetsPathFor(jsonPath: string): string {
  const slash = jsonPath.lastIndexOf("/");
  return slash >= 0 ? `${jsonPath.slice(0, slash + 1)}images/` : "images/";
}

export function IllustratedMoment({
  kind,
  loop,
  autoplay = true,
  playing = true,
  onComplete,
  onError,
  className,
  size,
  label,
}: {
  kind: MomentId;
  loop?: boolean;
  autoplay?: boolean;
  playing?: boolean;
  onComplete?: () => void;
  onError?: () => void;
  className?: string;
  size: number;
  label?: string;
}) {
  const reduceMotion = useReducedMotion();
  const moment = MOMENTS[kind];
  const shouldLoop = loop ?? moment.loop;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<LottieAnimation | null>(null);
  const [ready, setReady] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const playingRef = useRef(playing);
  const autoplayRef = useRef(autoplay);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);
  useEffect(() => {
    playingRef.current = playing;
    autoplayRef.current = autoplay;
  }, [autoplay, playing]);

  useEffect(() => {
    if (reduceMotion) return;
    const host = canvasHostRef.current;
    if (!host) return;
    let cancelled = false;
    let anim: LottieAnimation | null = null;

    void (async () => {
      try {
        const mod = await import("lottie-web/build/player/lottie_light");
        if (cancelled || !canvasHostRef.current) return;
        const lottie = resolveLottiePlayer(mod);
        const response = await fetch(moment.path);
        if (!response.ok) throw new Error(`lottie fetch ${response.status}`);
        const animationData: unknown = await response.json();
        if (cancelled || !canvasHostRef.current) return;
        // Clear any prior SVG children before mounting a new animation.
        canvasHostRef.current.replaceChildren();
        anim = lottie.loadAnimation({
          container: canvasHostRef.current,
          renderer: "svg",
          loop: shouldLoop,
          autoplay: autoplayRef.current && playingRef.current,
          animationData,
          assetsPath: assetsPathFor(moment.path),
          rendererSettings: {
            progressiveLoad: true,
            preserveAspectRatio: "xMidYMid meet",
          },
        });
        animRef.current = anim;
        const onDomLoaded = () => {
          if (!cancelled) setReady(true);
        };
        const onCompleteEvent = () => {
          if (!shouldLoop) onCompleteRef.current?.();
        };
        const onDataFailed = () => {
          onErrorRef.current?.();
        };
        anim.addEventListener("DOMLoaded", onDomLoaded);
        anim.addEventListener("complete", onCompleteEvent);
        anim.addEventListener("data_failed", onDataFailed);
      } catch {
        if (!cancelled) onErrorRef.current?.();
      }
    })();

    return () => {
      cancelled = true;
      anim?.destroy();
      animRef.current = null;
      setReady(false);
    };
  }, [moment.path, reduceMotion, shouldLoop]);

  useEffect(() => {
    const anim = animRef.current;
    if (!anim || reduceMotion) return;
    if (playing && autoplay) anim.play();
    else anim.pause();
  }, [autoplay, playing, reduceMotion]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || reduceMotion) return;

    const sync = () => {
      const anim = animRef.current;
      if (!anim) return;
      const hidden =
        document.hidden || Boolean(root.closest("[hidden]"));
      if (hidden) anim.pause();
      else if (playing && autoplay) anim.play();
    };

    const onVisibility = () => sync();
    document.addEventListener("visibilitychange", onVisibility);
    const observer = new MutationObserver(sync);
    let node: HTMLElement | null = root;
    while (node) {
      observer.observe(node, { attributes: true, attributeFilter: ["hidden"] });
      node = node.parentElement;
    }
    sync();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
    };
  }, [autoplay, playing, reduceMotion]);

  const boxStyle: CSSProperties = { width: size, height: size };
  const showPoster = Boolean(moment.poster) && (reduceMotion || !ready);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden",
        // Soft-fade cream glow layers so clipped ellipses don't read as hard squares.
        "[mask-image:radial-gradient(closest-side,black_72%,transparent)]",
        className,
      )}
      style={boxStyle}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {showPoster && moment.poster ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Illustration name={moment.poster} size={size} />
        </div>
      ) : null}
      {!reduceMotion ? (
        <div
          ref={canvasHostRef}
          className="absolute inset-0 [&>svg]:size-full"
          style={{ opacity: ready ? 1 : 0 }}
        />
      ) : null}
    </div>
  );
}
