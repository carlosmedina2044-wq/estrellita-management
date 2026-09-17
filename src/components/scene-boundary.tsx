"use client";

import { Component, type ReactNode } from "react";

type SceneBoundaryProps = {
  children: ReactNode;
  /** Rendered in place of the scene once it has thrown. Defaults to nothing. */
  fallback?: ReactNode;
};

type SceneBoundaryState = { failed: boolean };

/**
 * Keeps a broken picture from taking the screen down with it.
 *
 * `PortraitScene` reads generated assets (the portrait manifest, layer URLs)
 * and renders in places where losing the surrounding screen is far worse
 * than losing the illustration: the onboarding welcome, the house-look
 * picker, the lock screen and the top of Today. Without a boundary here the
 * nearest one is Next's app-level `error.tsx`, which remounts the whole tree
 * — during the 2026-09-16 review a manifest reload made the scene throw on
 * the house-look step and onboarding reset to the welcome screen, discarding
 * every answer. The scene is decoration; the answers are not.
 */
export class SceneBoundary extends Component<SceneBoundaryProps, SceneBoundaryState> {
  state: SceneBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    if (process.env.NODE_ENV !== "production") {
      console.error("PortraitScene failed to render; showing its fallback instead.", error);
    }
  }

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
