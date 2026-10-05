"use client";

import { useEffect, useRef, useState } from "react";
import { dayArc } from "@/lib/momentum";
import { answerRoomFor, completionToAnswer, type HouseAnswer } from "@/lib/scene/house-answer";
import type { Household } from "@/lib/types";

/** Longer than the flare itself, so the scene never unmounts it mid-fall. */
const ANSWER_SHOWN_MS = 1700;
const RECENT_MS = 10_000;

/**
 * The house's latest answer to a finished chore, whichever screen it was
 * ticked on. Lives once, above both scenes, so a chore finished from a Today
 * row, a room sheet or the detail sheet is answered exactly once.
 *
 * Returns null until the first completion of this session. The key rises per
 * completion; scenes play each key at most once (see `useAnswerPlayback`).
 */
export function useHouseAnswer(household: Household, enabled: boolean, now: Date): HouseAnswer | null {
  const [answer, setAnswer] = useState<HouseAnswer | null>(null);
  const before = useRef(household);
  const key = useRef(0);
  const nowRef = useRef(now);
  useEffect(() => {
    nowRef.current = now;
  });
  useEffect(() => {
    const previous = before.current;
    before.current = household;
    if (!enabled) return;
    const added = completionToAnswer(previous.completions, household.completions);
    if (!added) return;
    // A completion that arrived with a load or a restore is old news; only
    // something done in the last few seconds is the house's to answer.
    if (Date.now() - new Date(added.completedAt).getTime() > RECENT_MS) return;
    key.current += 1;
    const closesDay =
      dayArc(previous, nowRef.current, "all").state !== "closed" &&
      dayArc(household, nowRef.current, "all").state === "closed";
    setAnswer({ roomId: answerRoomFor(household, added.dutyId), key: key.current, closesDay });
  }, [household, enabled]);
  return answer;
}

export type AnswerReadiness = "play" | "defer" | "skip";

/**
 * Turns the shared answer into a short-lived one for one scene.
 *
 * - `play`: show it now, once.
 * - `defer`: hold it (a sheet is over the scene); it plays when readiness
 *   becomes `play`, so Home answers when a room sheet closes rather than
 *   behind the sheet where nobody sees it.
 * - `skip`: this scene is not on screen; the answer is consumed unseen so it
 *   cannot replay later when the person switches tabs.
 *
 * `onPlay` runs once per key at the moment the answer starts.
 */
export function useAnswerPlayback(
  answer: HouseAnswer | null,
  readiness: AnswerReadiness,
  onPlay?: (answer: HouseAnswer) => void,
): HouseAnswer | null {
  const [playedKey, setPlayedKey] = useState(0);
  const [shown, setShown] = useState<HouseAnswer | null>(null);
  // Adjusted during render rather than in an effect: the answer starts on the
  // render it arrives in, with no extra frame of the old picture first.
  if (answer && answer.key > playedKey && readiness !== "defer") {
    setPlayedKey(answer.key);
    if (readiness === "play") setShown(answer);
  }
  const onPlayRef = useRef(onPlay);
  useEffect(() => {
    onPlayRef.current = onPlay;
  });
  useEffect(() => {
    if (shown) onPlayRef.current?.(shown);
  }, [shown]);
  useEffect(() => {
    if (!shown) return;
    const timer = window.setTimeout(() => setShown(null), ANSWER_SHOWN_MS);
    return () => window.clearTimeout(timer);
  }, [shown]);
  return shown;
}
