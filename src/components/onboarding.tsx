"use client";

import { useState } from "react";
import { BrandLockup } from "@/components/brand-logo";
import { RestockWalkAddSheet } from "@/components/restock-walk-add-sheet";
import { RestockWalkPicker } from "@/components/restock-walk-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deriveClimate, isValidUsZip, normalizeUsZip, roundCoord } from "@/lib/climate";
import {
  generateHomeFromAnswers,
  sampleHomeAnswers,
  type FeatureKey,
  type OnboardingAnswers,
} from "@/lib/onboarding/generate";
import { ADD_ROOM_TYPES, nextRoomKey, roomTemplateFor, type RoomChoice } from "@/lib/onboarding/rooms";
import {
  defaultWalkPicks,
  newCustomPick,
  SAMPLE_RESTOCK_PICKS,
  type CustomRestockPick,
  type RestockPick,
  type RestockWalkGroup,
} from "@/lib/onboarding/restock-walk";
import { RETAILER_CHIPS } from "@/lib/retailer";
import { geocodeUsZip } from "@/lib/weather/client";
import { isNative } from "@/lib/native/platform";
import { weatherKitReverseGeocode } from "@/lib/native/weatherkit";
import type { HomeLocation, HomeType, RetailerId, Tenure } from "@/lib/types";
import { cn } from "@/lib/utils";

const EXTRA_HOME_FEATURES: { id: FeatureKey; label: string }[] = [
  { id: "hasPool", label: "Pool" },
  { id: "hasEvaporativeCooler", label: "Evaporative cooler" },
  { id: "hasWell", label: "Well" },
];

export function Onboarding({
  onComplete,
}: {
  onComplete: (input: { answers: OnboardingAnswers; ownerName?: string }) => void | Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [homeType, setHomeType] = useState<HomeType>("house");
  const [tenure, setTenure] = useState<Tenure | undefined>();
  const [rooms, setRooms] = useState<RoomChoice[]>(() => roomTemplateFor("house"));
  const [adding, setAdding] = useState(false);
  const [postalCode, setPostalCode] = useState("");
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [placeName, setPlaceName] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [zipError, setZipError] = useState("");
  const [extraFeatures, setExtraFeatures] = useState<FeatureKey[]>([]);
  const [restockPicks, setRestockPicks] = useState<RestockPick[]>(SAMPLE_RESTOCK_PICKS);
  const [walkPhase, setWalkPhase] = useState<"items" | "stores">("items");
  const [sizeBanner, setSizeBanner] = useState(false);
  const [preferredRetailers, setPreferredRetailers] = useState<RetailerId[]>(["amazon", "home-depot"]);
  const [walkContext, setWalkContext] = useState(() => generateHomeFromAnswers(sampleHomeAnswers()));
  const [addGroup, setAddGroup] = useState<RestockWalkGroup | null>(null);
  const [editingCustom, setEditingCustom] = useState<CustomRestockPick | null>(null);

  const location: HomeLocation = {
    postalCode: postalCode || undefined,
    lat,
    lng,
    placeName,
    climateZone: deriveClimate({ postalCode, lat, lng }),
  };
  const answers: OnboardingAnswers = {
    homeType,
    tenure,
    location,
    nickname: "Home",
    rooms,
    features: extraFeatures,
    restockPicks,
    preferredRetailers,
  };
  const lastStep = 4;
  const progress = step / lastStep;

  function go(next: number) {
    setStep(next);
    setAdding(false);
  }

  async function finish(nextAnswers: OnboardingAnswers) {
    setBusy(true);
    try {
      await onComplete({ answers: nextAnswers });
    } finally {
      setBusy(false);
    }
  }

  function applyType(next: HomeType) {
    setHomeType(next);
    setRooms(roomTemplateFor(next));
  }

  function addRoom(type: RoomChoice["type"]) {
    const label = ADD_ROOM_TYPES.find((item) => item.id === type)?.label ?? "Room";
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

  function enterWalk(nextLocation: HomeLocation = location) {
    const preview = generateHomeFromAnswers({
      homeType,
      tenure,
      location: nextLocation,
      nickname: "Home",
      rooms,
      features: extraFeatures,
    });
    setWalkContext(preview);
    setRestockPicks(defaultWalkPicks(preview));
    setWalkPhase("items");
    setSizeBanner(false);
    go(4);
  }

  function afterLocation(nextLocation: HomeLocation) {
    const resolvedLocation = { ...nextLocation, climateZone: deriveClimate(nextLocation) };
    enterWalk(resolvedLocation);
    return {
      ...answers,
      location: resolvedLocation,
    };
  }

  function continueFromWalk() {
    setWalkPhase("stores");
  }

  function toggleRetailer(id: RetailerId) {
    setPreferredRetailers((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function requestLocation() {
    setBusy(true);
    try {
      if (isNative()) {
        const { Geolocation } = await import("@capacitor/geolocation");
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000 });
        const nextLat = roundCoord(position.coords.latitude);
        const nextLng = roundCoord(position.coords.longitude);
        const city = await weatherKitReverseGeocode(nextLat, nextLng);
        setLat(nextLat);
        setLng(nextLng);
        if (city) setPlaceName(city);
        afterLocation({
          ...location,
          lat: nextLat,
          lng: nextLng,
          placeName: city,
          climateZone: deriveClimate({ postalCode, lat: nextLat, lng: nextLng }),
        });
        return;
      }
      if (!navigator.geolocation) {
        afterLocation(location);
        return;
      }
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const nextLat = roundCoord(position.coords.latitude);
            const nextLng = roundCoord(position.coords.longitude);
            setLat(nextLat);
            setLng(nextLng);
            afterLocation({ ...location, lat: nextLat, lng: nextLng, climateZone: deriveClimate({ postalCode, lat: nextLat, lng: nextLng }) });
            resolve();
          },
          () => {
            afterLocation(location);
            resolve();
          },
          { enableHighAccuracy: false, timeout: 8000 },
        );
      });
    } catch {
      afterLocation(location);
    } finally {
      setBusy(false);
    }
  }

  async function continueFromZip() {
    const zip = normalizeUsZip(postalCode);
    if (zip && !isValidUsZip(zip)) {
      setZipError("Enter a 5-digit US ZIP, or skip.");
      return;
    }
    if (!zip) {
      afterLocation({ ...location, postalCode: undefined });
      return;
    }
    setBusy(true);
    const coords = await geocodeUsZip(zip);
    setBusy(false);
    if (coords) {
      setLat(coords.lat);
      setLng(coords.lng);
      setPlaceName(coords.placeName);
      afterLocation({
        ...location,
        postalCode: zip,
        lat: coords.lat,
        lng: coords.lng,
        placeName: coords.placeName,
        climateZone: deriveClimate({ postalCode: zip, lat: coords.lat, lng: coords.lng }),
      });
      return;
    }
    afterLocation({ ...location, postalCode: zip });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="h-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-brand transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className="mt-8">
          <div className={step === 0 ? "brand-enter" : undefined}>
            <BrandLockup size={step === 0 ? "md" : "sm"} />
          </div>
        </div>

        {step === 0 ? (
          <Screen
            title="Your home, on your iPhone."
            copy="Rooms, chores, and the filters and batteries you reorder. All on this device. Setup takes about a minute."
          >
            <Button className="h-14 w-full text-base" disabled={busy} onClick={() => go(1)}>
              Set up my home
            </Button>
            <Button
              variant="secondary"
              className="mt-3 h-14 w-full text-base"
              disabled={busy}
              onClick={() => void finish(sampleHomeAnswers())}
            >
              Use a sample home instead
            </Button>
            <p className="mt-auto pt-8 text-sm leading-5 text-muted-foreground">
              Cuidala keeps your home data on this iPhone, encrypted. No account, no server copy.
              Your home moves to your next iPhone with your normal iCloud backup. A passphrase file in
              Settings is extra protection. Deleting the app removes your home from this iPhone.
              See Settings for the privacy policy.
            </p>
          </Screen>
        ) : null}

        {step === 1 ? (
          <Screen
            title="Tell us about your place"
            copy="Home type fills rooms. How long you’ve been here shapes the first-week checklist."
          >
            <p className="mb-2 text-[13px] font-medium text-muted-foreground">What are you managing?</p>
            <ChoiceGrid
              value={homeType}
              options={[
                { id: "house", label: "House" },
                { id: "apartment", label: "Apartment" },
                { id: "condo", label: "Condo" },
                { id: "townhouse", label: "Townhome" },
              ]}
              onChange={(value) => applyType(value as HomeType)}
            />
            <p className="mb-2 mt-6 text-[13px] font-medium text-muted-foreground">How long have you been here?</p>
            <ChoiceGrid
              value={tenure ?? ""}
              options={[
                { id: "new", label: "Just moved in", hint: "Under a year" },
                { id: "settled", label: "A few years" },
                { id: "longtime", label: "A long time" },
              ]}
              onChange={(value) => setTenure(value as Tenure)}
            />
            <div className="mt-auto flex gap-3 pt-6">
              <Button variant="secondary" className="h-14 flex-1" onClick={() => go(0)}>
                Back
              </Button>
              <Button className="h-14 flex-1" disabled={!tenure} onClick={() => go(2)}>
                Continue
              </Button>
            </div>
          </Screen>
        ) : null}

        {step === 2 ? (
          <Screen title="Build your home" copy="Toggle rooms, rename them, or add one. Chores attach after you finish.">
            <div className="grid gap-2">
              {rooms.map((room) => (
                <label key={room.key} className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2">
                  <input
                    type="checkbox"
                    checked={room.enabled}
                    onChange={() =>
                      setRooms((current) =>
                        current.map((item) => (item.key === room.key ? { ...item, enabled: !item.enabled } : item)),
                      )
                    }
                    className="size-5 accent-primary"
                  />
                  <Input
                    value={room.name}
                    onChange={(event) =>
                      setRooms((current) =>
                        current.map((item) => (item.key === room.key ? { ...item, name: event.target.value } : item)),
                      )
                    }
                    className="h-11"
                    aria-label={`${room.name} name`}
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
                    onClick={() => addRoom(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : (
              <button type="button" className="mt-4 text-[15px] font-medium text-brand" onClick={() => setAdding(true)}>
                + Add room
              </button>
            )}
            <p className="mt-6 text-[13px] font-medium text-muted-foreground">Also here</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXTRA_HOME_FEATURES.map((item) => {
                const on = extraFeatures.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "h-11 rounded-full px-3 text-[13px] font-medium",
                      on ? "bg-primary text-primary-foreground" : "bg-secondary",
                    )}
                    onClick={() =>
                      setExtraFeatures((current) =>
                        on ? current.filter((id) => id !== item.id) : [...current, item.id],
                      )
                    }
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-auto flex gap-3 pt-6">
              <Button variant="secondary" className="h-14 flex-1" onClick={() => go(1)}>
                Back
              </Button>
              <Button
                className="h-14 flex-1"
                disabled={!rooms.some((room) => room.enabled && !room.system)}
                onClick={() => go(3)}
              >
                Continue
              </Button>
            </div>
          </Screen>
        ) : null}

        {step === 3 ? (
          <Screen
            title="Where is it?"
            copy="ZIP is for climate and seasonal tasks. Weather comes from Apple Weather on this iPhone."
            onSkip={() => {
              afterLocation({ ...location, postalCode: undefined });
            }}
          >
            <Button className="h-14 w-full" disabled={busy} onClick={() => void requestLocation()}>
              Allow location
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">Or type a 5-digit ZIP.</p>
            <Input
              inputMode="numeric"
              autoComplete="postal-code"
              value={postalCode}
              onChange={(event) => {
                setPostalCode(normalizeUsZip(event.target.value));
                setZipError("");
              }}
              placeholder="ZIP code"
              className="mt-2 h-14"
              aria-label="ZIP code"
            />
            {zipError ? <p className="mt-2 text-sm text-destructive">{zipError}</p> : null}
            <Button className="mt-6 h-14 w-full" disabled={busy} onClick={() => void continueFromZip()}>
              Continue
            </Button>
          </Screen>
        ) : null}

        {step === 4 && walkPhase === "items" ? (
          <Screen
            title="Walk your house"
            copy="Recommended items are checked. Uncheck what you don’t buy, add anything we missed. Sizes come later, when you order."
          >
            <RestockWalkPicker
              picks={restockPicks}
              onChange={(next) => {
                setRestockPicks(next);
                setSizeBanner(false);
              }}
              context={walkContext}
              sizeWarning={sizeBanner}
              onSkipSizes={() => setWalkPhase("stores")}
              onAddCustom={(group) => {
                setEditingCustom(null);
                setAddGroup(group);
              }}
              onEditCustom={(pick) => {
                setEditingCustom(pick);
                setAddGroup(pick.custom.group);
              }}
            />
            <RestockWalkAddSheet
              open={addGroup !== null}
              onOpenChange={(open) => {
                if (!open) {
                  setAddGroup(null);
                  setEditingCustom(null);
                }
              }}
              group={addGroup ?? "whole-home"}
              household={walkContext}
              initial={editingCustom?.custom}
              onSave={(item) => {
                setRestockPicks((current) => {
                  if (editingCustom) {
                    return current.map((pick) =>
                      pick.id === editingCustom.id ? { ...editingCustom, custom: item } : pick,
                    );
                  }
                  return [...current, newCustomPick(item)];
                });
                setSizeBanner(false);
              }}
            />
            <div className="mt-auto flex gap-3 pt-6">
              <Button variant="secondary" className="h-14 flex-1" onClick={() => go(3)}>
                Back
              </Button>
              <Button className="h-14 flex-1" disabled={busy} onClick={continueFromWalk}>
                Continue
              </Button>
            </div>
          </Screen>
        ) : null}

        {step === 4 && walkPhase === "stores" ? (
          <Screen
            title="Where do you usually shop?"
            copy="Order buttons open your stores first. You can change this any time."
            onSkip={() => void finish({ ...answers, restockPicks, preferredRetailers: ["amazon", "home-depot"] })}
            skipLabel="Keep these — I'll change it later"
          >
            <div className="flex flex-wrap gap-1.5">
              {RETAILER_CHIPS.map((chip) => {
                const index = preferredRetailers.indexOf(chip.id);
                return (
                  <button
                    key={chip.id}
                    type="button"
                    className={cn(
                      "h-11 rounded-full px-3 text-[15px] font-medium",
                      index >= 0 ? "bg-primary text-primary-foreground" : "bg-secondary",
                    )}
                    onClick={() => toggleRetailer(chip.id)}
                  >
                    {chip.label}
                    {index >= 0 ? ` · ${index + 1}` : ""}
                  </button>
                );
              })}
            </div>
            <div className="mt-auto flex gap-3 pt-6">
              <Button variant="secondary" className="h-14 flex-1" onClick={() => setWalkPhase("items")}>
                Back
              </Button>
              <Button
                className="h-14 flex-1"
                disabled={busy}
                onClick={() => void finish({ ...answers, restockPicks, preferredRetailers })}
              >
                Show me my chores
              </Button>
            </div>
          </Screen>
        ) : null}
      </div>
    </div>
  );
}

function Screen({
  title,
  copy,
  children,
  onSkip,
  skipLabel = "Skip",
}: {
  title: string;
  copy: string;
  children: React.ReactNode;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  return (
    <div className="flex flex-1 flex-col pt-10">
      <h1 className="ui-heading text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
      <div className="mt-6 flex flex-1 flex-col">{children}</div>
      {onSkip ? (
        <button type="button" className="mt-4 text-[13px] font-medium text-brand" onClick={onSkip}>
          {skipLabel}
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
          onClick={() => onChange(item.id)}
          className={cn(
            "min-h-14 rounded-2xl border px-4 py-3 text-left text-[17px] font-medium",
            value === item.id ? "border-brand bg-brand-cream/60" : "border-border bg-card",
          )}
        >
          <span className="block">{item.label}</span>
          {item.hint ? <span className="mt-0.5 block text-[13px] font-normal text-muted-foreground">{item.hint}</span> : null}
        </button>
      ))}
    </div>
  );
}
