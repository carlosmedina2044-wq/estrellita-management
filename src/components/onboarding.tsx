"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BrandLockup } from "@/components/brand-logo";
import { CircleCheck } from "@/components/circle-check";
import { LegalDocSheet, type LegalDocId } from "@/components/legal/legal-doc-sheet";
import { PortraitScene } from "@/components/today/portrait-scene";
import { SceneBoundary } from "@/components/scene-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/i18n/locale-provider";
import type { MessageKey } from "@/i18n";
import { useClock } from "@/hooks/use-clock";
import { deriveClimate } from "@/lib/climate";
import { toISODate } from "@/lib/dates";
import { DUR_INSTANT, DUR_NONE, DUR_QUICK, EASE_OUT, SPRING_SETTLE } from "@/lib/motion";
import { hapticSuccess, hapticTab } from "@/lib/native/haptics";
import { dayArc } from "@/lib/momentum";
import { portraitKit } from "@/lib/scene/portrait";
import { previewHousehold } from "@/lib/scene/preview-household";
import { skyPhase } from "@/lib/scene/sun";
import { sceneWeather } from "@/lib/scene/weather";
import {
  sampleHomeAnswers,
  type FeatureKey,
  type OnboardingAnswers,
} from "@/lib/onboarding/generate";
import { ADD_ROOM_TYPES, addRoomTypeLabel, nextRoomKey, roomTemplateFor, type RoomChoice } from "@/lib/onboarding/rooms";
import type { HomeLocation, HomeType, KitType, PaletteId, Tenure } from "@/lib/types";
import { HouseLookPicker } from "@/components/house-look-picker";
import { rankKits } from "@/lib/scene/infer-kit";
import { cn } from "@/lib/utils";

const EXTRA_HOME_FEATURES: { id: FeatureKey; labelKey: MessageKey }[] = [
  { id: "hasPool", labelKey: "onboarding.feature.pool" },
  { id: "hasEvaporativeCooler", labelKey: "onboarding.feature.evaporativeCooler" },
  { id: "hasWell", labelKey: "onboarding.feature.well" },
];

export function Onboarding({
  onComplete,
}: {
  onComplete: (input: { answers: OnboardingAnswers; ownerName?: string }) => void | Promise<void>;
}) {
  const { t } = useLocale();
  // The progress bar animates its width, which `reducedMotion="user"` does not
  // neutralise — it only covers transforms and layout.
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [homeType, setHomeType] = useState<HomeType>("house");
  const [tenure, setTenure] = useState<Tenure | undefined>();
  const [rooms, setRooms] = useState<RoomChoice[]>(() => roomTemplateFor("house"));
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [extraFeatures, setExtraFeatures] = useState<FeatureKey[]>([]);
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [homeLook, setHomeLook] = useState<{ kitType: KitType; palette: PaletteId } | undefined>();

  // Where the house is gets asked later, on Today, the first time weather or
  // seasonal chores need it. The same goes for the supply walk and stores.
  const location: HomeLocation = { climateZone: deriveClimate({}) };
  const answers: OnboardingAnswers = {
    homeType,
    tenure,
    location,
    nickname: t("onboarding.nicknameHome"),
    rooms,
    features: extraFeatures,
    restockPicks: [],
    preferredRetailers: ["amazon", "home-depot"],
    homeLook,
  };
  // Best guess first, computed from what's known by the time this step is
  // reachable (home type only — onboarding never asks floors/bedrooms
  // directly, see `rankKits`). Recomputed only when those inputs change, not
  // on every render, so picking a kit doesn't reshuffle the strip under the
  // user's thumb.
  const kitOrder = useMemo(() => rankKits({ homeType }), [homeType]);
  const selectedLook: { kitType: KitType; palette: PaletteId } = homeLook ?? {
    kitType: kitOrder[0] ?? "a",
    palette: "classic",
  };
  const lastStep = 3;
  const progress = step / lastStep;

  function go(next: number) {
    setStep(next);
    setAdding(false);
  }

  async function finish(nextAnswers: OnboardingAnswers) {
    setBusy(true);
    // Setting up a home is the one thing in onboarding worth a success beat.
    // Fired before the work rather than after it: `onComplete` hands over to
    // Today, and a buzz that lands on the next screen belongs to that screen.
    void hapticSuccess();
    try {
      const trimmed = ownerName.trim();
      await onComplete({ answers: nextAnswers, ownerName: trimmed || undefined });
    } finally {
      setBusy(false);
    }
  }

  function applyType(next: HomeType) {
    setHomeType(next);
    setRooms(roomTemplateFor(next));
  }

  function addRoom(type: RoomChoice["type"]) {
    const label = addRoomTypeLabel(type);
    const count = rooms.filter((room) => room.type === type && !room.system).length;
    setRooms((current) => [
      ...current,
      {
        key: nextRoomKey(type, current),
        type,
        name: count === 0 ? label : `${label} ${count + 1}`,
        enabled: true,
      },
    ]);
    setAdding(false);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        {step > 0 ? (
          <div
            className="h-1 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label={t("onboarding.progressAria")}
          >
            <motion.div
              className="h-full bg-brand"
              initial={false}
              animate={{ width: `${Math.round(progress * 100)}%` }}
              transition={reduceMotion ? { duration: DUR_NONE } : SPRING_SETTLE}
            />
          </div>
        ) : (
          <div className="h-1" aria-hidden />
        )}
        <div className="mt-8">
          <BrandLockup size={step === 0 ? "md" : "sm"} />
        </div>

        <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="flex flex-1 flex-col"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12, transition: { duration: DUR_INSTANT } }}
          transition={{ duration: DUR_QUICK, ease: EASE_OUT }}
        >
        {step === 0 ? (
          <Screen title={t("onboarding.welcomeTitle")} copy={t("onboarding.welcomeCopy")}>
            <WelcomeScene />
            <Button className="mt-6 h-14 w-full text-base" disabled={busy} onClick={() => go(1)}>
              {t("onboarding.setupCta")}
            </Button>
            <Button
              variant="outline"
              className="mt-3 h-14 w-full text-base"
              disabled={busy}
              onClick={() => void finish(sampleHomeAnswers())}
            >
              {t("onboarding.sampleCta")}
            </Button>
            <button
              type="button"
              className="mt-auto inline-flex min-h-11 items-center pt-8 text-sm font-medium text-primary"
              onClick={() => setLegalDoc("how-it-works")}
            >
              {t("onboarding.howItWorksLink")}
              <ChevronRight className="ml-0.5 size-4" aria-hidden />
            </button>
            <p className="mt-3 text-sm leading-5 text-muted-foreground">{t("onboarding.privacyHint")}</p>
          </Screen>
        ) : null}

        {step === 1 ? (
          <Screen title={t("onboarding.placeTitle")} copy={t("onboarding.placeCopy")}>
            <p className="mb-2 ui-caption font-medium text-muted-foreground">{t("onboarding.whatManaging")}</p>
            <ChoiceGrid
              value={homeType}
              options={[
                { id: "house", label: t("onboarding.homeType.house") },
                { id: "apartment", label: t("onboarding.homeType.apartment") },
                { id: "condo", label: t("onboarding.homeType.condo") },
                { id: "townhouse", label: t("onboarding.homeType.townhouse") },
              ]}
              onChange={(value) => applyType(value as HomeType)}
            />
            <p className="mb-2 mt-6 ui-caption font-medium text-muted-foreground">{t("onboarding.howLong")}</p>
            <ChoiceGrid
              value={tenure ?? ""}
              options={[
                { id: "new", label: t("onboarding.tenure.new"), hint: t("onboarding.tenure.newHint") },
                { id: "settled", label: t("onboarding.tenure.settled") },
                { id: "longtime", label: t("onboarding.tenure.longtime") },
              ]}
              onChange={(value) => setTenure(value as Tenure)}
            />
            <div className="mt-auto flex gap-3 pt-6">
              <Button variant="secondary" className="h-14 flex-1" onClick={() => go(0)}>
                {t("common.back")}
              </Button>
              <Button className="h-14 flex-1" disabled={!tenure} onClick={() => go(2)}>
                {t("common.continue")}
              </Button>
            </div>
          </Screen>
        ) : null}

        {step === 2 ? (
          <Screen title={t("onboarding.buildTitle")} copy={t("onboarding.buildCopy")}>
            <div className="ui-group">
              {rooms.map((room) => (
                <label key={room.key} className="ui-group-row flex items-center gap-3 px-3 py-1">
                  <span className="relative flex size-11 shrink-0 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={room.enabled}
                      onChange={() => {
                        void hapticTab();
                        setRooms((current) =>
                          current.map((item) => (item.key === room.key ? { ...item, enabled: !item.enabled } : item)),
                        );
                      }}
                      className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
                      // The wrapping label's only text is the room-name input,
                      // and the icon beside it is `aria-hidden`, so this
                      // checkbox had no accessible name at all.
                      aria-label={t("onboarding.roomIncludeAria", { name: room.name })}
                    />
                    <CircleCheck checked={room.enabled} />
                  </span>
                  <Input
                    value={room.name}
                    onChange={(event) =>
                      setRooms((current) =>
                        current.map((item) => (item.key === room.key ? { ...item, name: event.target.value } : item)),
                      )
                    }
                    className="h-11 bg-transparent px-1 dark:bg-transparent"
                    aria-label={t("onboarding.roomNameAria", { name: room.name })}
                  />
                </label>
              ))}
            </div>
            {adding ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {ADD_ROOM_TYPES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="h-11 rounded-2xl bg-secondary text-sm font-medium"
                    onClick={() => {
                      void hapticTab();
                      addRoom(item.id);
                    }}
                  >
                    {t(item.labelKey)}
                  </button>
                ))}
              </div>
            ) : (
              <button type="button" className="mt-4 inline-flex min-h-11 items-center ui-body font-medium text-brand" onClick={() => setAdding(true)}>
                {t("onboarding.addRoom")}
              </button>
            )}
            <p className="mt-6 ui-caption font-medium text-muted-foreground">{t("onboarding.alsoHere")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXTRA_HOME_FEATURES.map((item) => {
                const on = extraFeatures.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "h-11 rounded-full px-3 ui-caption font-medium",
                      on ? "bg-primary text-primary-foreground" : "bg-secondary",
                    )}
                    onClick={() => {
                      void hapticTab();
                      setExtraFeatures((current) =>
                        on ? current.filter((id) => id !== item.id) : [...current, item.id],
                      );
                    }}
                  >
                    {t(item.labelKey)}
                  </button>
                );
              })}
            </div>
            <div className="mt-auto flex gap-3 pt-6">
              <Button variant="secondary" className="h-14 flex-1" onClick={() => go(1)}>
                {t("common.back")}
              </Button>
              <Button
                className="h-14 flex-1"
                disabled={!rooms.some((room) => room.enabled && !room.system)}
                onClick={() => go(3)}
              >
                {t("common.continue")}
              </Button>
            </div>
          </Screen>
        ) : null}

        {step === 3 ? (
          <Screen title={t("onboarding.houseTitle")} copy={t("onboarding.houseCopy")}>
            <HouseLookPicker
              kitType={selectedLook.kitType}
              palette={selectedLook.palette}
              order={kitOrder}
              now={new Date()}
              onChange={setHomeLook}
            />
            <label className="mt-6 block">
              <span className="ui-caption font-medium text-muted-foreground">{t("onboarding.ownerNameLabel")}</span>
              <Input
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
                placeholder={t("onboarding.ownerNamePlaceholder")}
                className="mt-2 h-14"
                autoComplete="given-name"
                aria-label={t("onboarding.ownerNameLabel")}
              />
            </label>
            <p className="mt-4 ui-caption text-muted-foreground">{t("onboarding.laterNote")}</p>
            <div className="mt-auto flex gap-3 pt-6">
              <Button variant="secondary" className="h-14 flex-1" onClick={() => go(2)}>
                {t("common.back")}
              </Button>
              <Button
                className="h-14 flex-1"
                disabled={busy}
                onClick={() => void finish({ ...answers })}
              >
                {t("onboarding.showChores")}
              </Button>
            </div>
          </Screen>
        ) : null}
        </motion.div>
        </AnimatePresence>
      </div>
      <LegalDocSheet doc={legalDoc} onOpenChange={(open) => !open && setLegalDoc(null)} />
    </div>
  );
}

/**
 * The house, alive, before there's a real household to show — a sample
 * home with its windows lighting one by one on a slow loop, so the welcome
 * screen is the signature illustration instead of a mocked-up chore row.
 * Nothing here is interactive (`aria-hidden`; the loop is decorative).
 */
function WelcomeScene() {
  const reduce = useReducedMotion();
  const clock = useClock();
  const clockMs = clock.getTime();
  const household = useMemo(() => previewHousehold("Casa"), []);
  const scenePhase = useMemo(() => skyPhase(new Date(clockMs), null), [clockMs]);
  const arc = useMemo(() => dayArc(household, clock, "all"), [household, clock]);
  const weather = useMemo(() => sceneWeather(null, toISODate(clock)), [clock]);
  const windowCount = useMemo(() => {
    const kit = portraitKit("a");
    return kit.windowCount || kit.windows.length || 1;
  }, []);
  const [lit, setLit] = useState(() => (reduce ? windowCount : 0));

  useEffect(() => {
    if (reduce) return;
    // A step every 700ms (not a per-frame tween — the per-window fade this
    // drives is already a CSS transition, and animating a whole scene at
    // 60fps for a decorative loop is exactly the kind of waste the app's
    // other motion work has been quantizing away) counting 0..windowCount
    // then resetting, so lights come on one at a time and start over.
    let count = 0;
    const id = window.setInterval(() => {
      count = count >= windowCount ? 0 : count + 1;
      setLit(count);
    }, 700);
    return () => window.clearInterval(id);
  }, [reduce, windowCount]);

  return (
    <div aria-hidden className="pointer-events-none select-none overflow-hidden rounded-2xl">
      <SceneBoundary>
        <PortraitScene
          household={household}
          arc={arc}
          phase={scenePhase.phase}
          phaseT={scenePhase.t}
          weather={weather}
          ceremony={false}
          greeting=""
          secondaryLine=""
          insetTop={false}
          overrides={{ windowsLit: lit }}
        />
      </SceneBoundary>
    </div>
  );
}

function Screen({
  title,
  copy,
  children,
  onSkip,
  skipLabel,
}: {
  title: string;
  copy: string;
  children: React.ReactNode;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  const { t } = useLocale();
  return (
    <div className="flex flex-1 flex-col pt-10">
      <h1 className="ui-heading ui-display leading-tight font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
      <div className="mt-6 flex flex-1 flex-col">{children}</div>
      {onSkip ? (
        <button type="button" className="mt-4 inline-flex min-h-11 items-center ui-caption font-medium text-brand" onClick={onSkip}>
          {skipLabel ?? t("common.skip")}
        </button>
      ) : null}
    </div>
  );
}

function ChoiceGrid({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string; hint?: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {options.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => {
            void hapticTab();
            onChange(item.id);
          }}
          className={cn(
            "flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-left ui-card font-medium transition-transform active:scale-[0.99]",
            value === item.id ? "bg-primary/10" : "bg-card",
          )}
          aria-pressed={value === item.id}
        >
          <span className="min-w-0 flex-1">
            <span className="block">{item.label}</span>
            {item.hint ? <span className="mt-0.5 block ui-caption font-normal text-muted-foreground">{item.hint}</span> : null}
          </span>
          <CircleCheck checked={value === item.id} />
        </button>
      ))}
    </div>
  );
}
