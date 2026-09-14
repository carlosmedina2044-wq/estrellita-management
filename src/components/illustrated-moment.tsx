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

type LottiePlayer = {
  loadAnimation: (params: {
    container: Element;
    renderer: "svg" | "canvas" | "html";
    loop: boolean;
    autoplay: boolean;
    path: string;
    rendererSettings?: { progressiveLoad?: boolean };
  }) => {
    play: () => void;
    pause: () => void;
    destroy: () => void;
    addEventListener: (name: string, cb: () => void) => void;
    removeEventListener: (name: string, cb: () => void) => void;
  };
};

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
  const animRef = useRef<ReturnType<LottiePlayer["loadAnimation"]> | null>(null);
  const [ready, setReady] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  useEffect(() => {
    if (reduceMotion) return;
    const host = canvasHostRef.current;
    if (!host) return;
    let cancelled = false;
    let anim: ReturnType<LottiePlayer["loadAnimation"]> | null = null;

    void import("lottie-web/build/player/lottie_light")
      .then((mod) => {
        if (cancelled || !canvasHostRef.current) return;
        const lottie = (mod.default ?? mod) as LottiePlayer;
        anim = lottie.loadAnimation({
          container: canvasHostRef.current,
          renderer: "svg",
          loop: shouldLoop,
          autoplay: autoplay && playing,
          path: moment.path,
          rendererSettings: { progressiveLoad: true },
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
      })
      .catch(() => {
        onErrorRef.current?.();
      });

    return () => {
      cancelled = true;
      anim?.destroy();
      animRef.current = null;
      setReady(false);
    };
  }, [autoplay, moment.path, playing, reduceMotion, shouldLoop]);

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

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      style={boxStyle}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {moment.poster ? (
        <div
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-[120ms]"
          style={{ opacity: ready && !reduceMotion ? 0 : 1 }}
        >
          <Illustration name={moment.poster} size={size} />
        </div>
      ) : null}
      {!reduceMotion ? (
        <div
          ref={canvasHostRef}
          className="absolute inset-0 transition-opacity duration-[120ms] [&>svg]:size-full"
          style={{ opacity: ready ? 1 : 0 }}
        />
      ) : null}
    </div>
  );
}
