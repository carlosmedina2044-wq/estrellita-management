"use client";

import { useState } from "react";
import { BrandLockup } from "@/components/brand-logo";
import { RestockWalkPicker } from "@/components/restock-walk-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { climatePayoff } from "@/lib/climate-payoff";
import { deriveClimate, isValidUsZip, normalizeUsZip, roundCoord } from "@/lib/climate";
import { DEFAULT_ATTRIBUTES } from "@/lib/household-defaults";
import { defaultFeatures, sampleHomeAnswers, type OnboardingAnswers } from "@/lib/onboarding/generate";
import { ADD_ROOM_TYPES, nextRoomKey, roomTemplateFor, type RoomChoice } from "@/lib/onboarding/rooms";
import { SAMPLE_RESTOCK_PICKS, type RestockPick } from "@/lib/onboarding/restock-walk";
import { geocodeUsZip } from "@/lib/weather/client";
import type { HomeAttributes, HomeLocation, HomeType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Onboarding({
  onComplete,
}: {
  onComplete: (input: { answers: OnboardingAnswers; ownerName?: string }) => void | Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [homeType, setHomeType] = useState<HomeType>("house");
  const [rooms, setRooms] = useState<RoomChoice[]>(() => roomTemplateFor("house"));
  const [adding, setAdding] = useState(false);
  const [postalCode, setPostalCode] = useState("");
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [placeName, setPlaceName] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [zipError, setZipError] = useState("");
  const [restockPicks, setRestockPicks] = useState<RestockPick[]>(SAMPLE_RESTOCK_PICKS);

  const location: HomeLocation = {
    postalCode: postalCode || undefined,
    lat,
    lng,
    placeName,
    climateZone: deriveClimate({ postalCode, lat, lng }),
  };
  const answers: OnboardingAnswers = {
    homeType,
    location,
    nickname: "Home",
    rooms,
    restockPicks,
  };
  const lastStep = 5;
  const progress = step / lastStep;
  const preview = climatePayoff(location, attributesForPreview(homeType, location));

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
    go(2);
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

  function afterLocation(nextLocation: HomeLocation) {
    const resolved = {
      ...answers,
      location: { ...nextLocation, climateZone: deriveClimate(nextLocation) },
    };
    if (nextLocation.postalCode || (nextLocation.lat != null && nextLocation.lng != null)) {
      go(4);
      return resolved;
    }
    go(5);
    return resolved;
  }

  async function requestLocation() {
    if (!navigator.geolocation) {
      afterLocation(location);
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLat = roundCoord(position.coords.latitude);
        const nextLng = roundCoord(position.coords.longitude);
        setLat(nextLat);
        setLng(nextLng);
        setBusy(false);
        afterLocation({ ...location, lat: nextLat, lng: nextLng, climateZone: deriveClimate({ postalCode, lat: nextLat, lng: nextLng }) });
      },
      () => {
        setBusy(false);
        afterLocation(location);
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
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
            copy="Rooms, chores, and the filters and batteries you need to reorder — all on this device. Setup takes about two minutes."
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
            <p className="mt-auto pt-8 text-[12px] leading-5 text-muted-foreground">
              Cuidala keeps your home data on this iPhone, encrypted. No account, no server copy.
              iCloud backup restores the encrypted home but not the key — make a backup in Settings before
              you switch phones. See Settings for the privacy policy.
            </p>
          </Screen>
        ) : null}

        {step === 1 ? (
          <Screen title="What are you managing?" copy="Tap one. Rooms are pre-filled so you can finish in a couple of minutes.">
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
            copy="ZIP is only for weather and seasonal tasks. We’ll show what that climate means for your house next."
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

        {step === 4 ? (
          <Screen
            title={preview.headline}
            copy="Here’s what this climate means for your house. These jobs show up on Seasonal when they’re due."
          >
            <ul className="grid gap-2">
              {preview.beats.map((beat) => (
                <li key={beat} className="rounded-2xl bg-card px-4 py-3 text-[15px] leading-5">
                  {beat}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] leading-5 text-muted-foreground">
              This home lives only on this iPhone. Before you switch phones, make an encrypted backup in Settings.
            </p>
            <div className="mt-auto flex gap-3 pt-6">
              <Button variant="secondary" className="h-14 flex-1" onClick={() => go(3)}>
                Back
              </Button>
              <Button className="h-14 flex-1" onClick={() => go(5)}>
                Continue
              </Button>
            </div>
          </Screen>
        ) : null}

        {step === 5 ? (
          <Screen
            title="Walk your house"
            copy="Tap what you actually buy. Restock will track order-by dates so you’re not hunting sizes later."
          >
            <RestockWalkPicker picks={restockPicks} onChange={setRestockPicks} />
            <div className="mt-auto flex gap-3 pt-6">
              <Button variant="secondary" className="h-14 flex-1" onClick={() => go(location.postalCode || location.lat != null ? 4 : 3)}>
                Back
              </Button>
              <Button className="h-14 flex-1" disabled={busy} onClick={() => void finish({ ...answers, restockPicks })}>
                Show me my chores
              </Button>
            </div>
          </Screen>
        ) : null}
      </div>
    </div>
  );
}

function attributesForPreview(homeType: HomeType, location: HomeLocation): HomeAttributes {
  const features = defaultFeatures(homeType, location);
  return {
    ...DEFAULT_ATTRIBUTES,
    ...Object.fromEntries(features.map((id) => [id, true])),
  };
}

function Screen({
  title,
  copy,
  children,
  onSkip,
}: {
  title: string;
  copy: string;
  children: React.ReactNode;
  onSkip?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col pt-10">
      <h1 className="ui-heading text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
      <div className="mt-6 flex flex-1 flex-col">{children}</div>
      {onSkip ? (
        <button type="button" className="mt-4 text-[13px] font-medium text-brand" onClick={onSkip}>
          Skip
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
  options: { id: string; label: string }[];
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
            "min-h-14 rounded-2xl border px-4 text-left text-[17px] font-medium",
            value === item.id ? "border-brand bg-brand-cream/60" : "border-border bg-card",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
