"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appendAudit } from "@/lib/audit";
import { deriveClimate, isValidUsZip, normalizeUsZip, roundCoord } from "@/lib/climate";
import { signInWithAppleNative, signInWithAppleWeb } from "@/lib/native/apple-sign-in";
import { persistRefreshToken, persistVaultSecret } from "@/lib/native/keychain";
import { isNativeIos } from "@/lib/native/platform";
import { sampleHomeAnswers, type OnboardingAnswers } from "@/lib/onboarding/generate";
import { ADD_ROOM_TYPES, nextRoomKey, roomTemplateFor, type RoomChoice } from "@/lib/onboarding/rooms";
import { beginPasskeyRegistration, finishPasskeyRegistration } from "@/lib/passkey";
import type { Account, HomeType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Onboarding({
  onComplete,
}: {
  onComplete: (input: {
    answers: OnboardingAnswers;
    account?: Account;
    vaultSecret?: string;
    ownerName?: string;
  }) => void | Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [homeType, setHomeType] = useState<HomeType>("house");
  const [rooms, setRooms] = useState<RoomChoice[]>(() => roomTemplateFor("house"));
  const [adding, setAdding] = useState(false);
  const [postalCode, setPostalCode] = useState("");
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [account, setAccount] = useState<Account>({ providers: [] });
  const [email, setEmail] = useState("");
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);
  const [zipError, setZipError] = useState("");

  const location = {
    postalCode: postalCode || undefined,
    lat,
    lng,
    climateZone: deriveClimate({ postalCode, lat, lng }),
  };
  const answers: OnboardingAnswers = {
    homeType,
    location,
    nickname: "Home",
    rooms,
  };
  const progress = step === 0 ? 0 : step / 3;

  function go(next: number) {
    setStep(next);
    setAdding(false);
  }

  async function finish(nextAnswers: OnboardingAnswers) {
    setBusy(true);
    try {
      await appendAudit("onboarding_complete");
      await onComplete({
        answers: nextAnswers,
        account,
        ownerName: account.email?.split("@")[0],
      });
    } finally {
      setBusy(false);
    }
  }

  async function finishAuth(nextAccount: Account, vaultSecret: string) {
    setAccount(nextAccount);
    await persistVaultSecret(vaultSecret);
    go(1);
  }

  async function apple() {
    setBusy(true);
    setAuthError("");
    try {
      const native = isNativeIos();
      const result = native ? await signInWithAppleNative() : await signInWithAppleWeb().catch(() => null);
      if (!result) {
        setAuthError("Sign in with Apple needs the iOS app, or Apple JS configured for the web build.");
        return;
      }
      const response = await fetch("/api/auth/apple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityToken: result.identityToken }),
      });
      const payload = (await response.json()) as {
        refreshToken?: string;
        user?: { id: string; email?: string; emailHidden?: boolean; appleUserId?: string };
        error?: string;
      };
      if (!response.ok || !payload.refreshToken) {
        setAuthError(payload.error || "Apple could not sign you in.");
        return;
      }
      await persistRefreshToken(payload.refreshToken);
      const vaultSecret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      await finishAuth(
        {
          appleUserId: payload.user?.appleUserId ?? result.user,
          email: payload.user?.email ?? result.email,
          emailHidden: payload.user?.emailHidden,
          providers: ["apple"],
        },
        vaultSecret,
      );
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Apple sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function passkey() {
    setBusy(true);
    setAuthError("");
    try {
      const vaultId = crypto.randomUUID();
      const vaultSecret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const credential = await beginPasskeyRegistration(vaultId);
      await finishPasskeyRegistration(credential, vaultSecret, vaultId);
      await finishAuth({ providers: ["passkey"] }, vaultSecret);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Passkey sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMagic() {
    setBusy(true);
    setAuthError("");
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        setAuthError("Could not send the email link.");
        return;
      }
      setAuthError("Check your email for a 15-minute sign-in link. It opens this app.");
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

  async function requestLocation() {
    if (!navigator.geolocation) {
      await finish(answers);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLat = roundCoord(position.coords.latitude);
        const nextLng = roundCoord(position.coords.longitude);
        setLat(nextLat);
        setLng(nextLng);
        void finish({
          ...answers,
          location: { ...location, lat: nextLat, lng: nextLng, climateZone: deriveClimate({ postalCode, lat: nextLat, lng: nextLng }) },
        });
      },
      () => {
        void finish(answers);
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="h-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className="mt-4 flex items-center gap-2 text-primary">
          <Star className="size-5 fill-current" />
          <span className="text-sm font-medium tracking-wide">Estrellita</span>
        </div>

        {step === 0 ? (
          <Screen title="Your home, on your iPhone." copy="Sign in once. After that it’s Face ID, then today’s chores.">
            <Button className="h-14 w-full text-base" disabled={busy} onClick={() => void apple()}>
              Sign in with Apple
            </Button>
            <Button variant="secondary" className="mt-3 h-14 w-full" disabled={busy} onClick={() => void passkey()}>
              Continue with passkey
            </Button>
            <div className="mt-4">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email for a magic link"
                className="h-12"
              />
              <Button variant="secondary" className="mt-2 h-12 w-full" disabled={busy || !email.includes("@")} onClick={() => void sendMagic()}>
                Email me a sign-in link
              </Button>
            </div>
            {authError ? <p className="mt-3 text-sm text-muted-foreground">{authError}</p> : null}
            <button type="button" className="mt-6 text-[13px] font-medium text-primary" onClick={() => go(1)}>
              Continue without signing in
            </button>
            <button
              type="button"
              className="mt-3 text-[13px] font-medium text-primary"
              disabled={busy}
              onClick={() => void finish(sampleHomeAnswers())}
            >
              Use a sample home
            </button>
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
              <button type="button" className="mt-4 text-[15px] font-medium text-primary" onClick={() => setAdding(true)}>
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
            copy="ZIP is only for weather and seasonal tasks. Skip if you want chores now."
            onSkip={() => void finish(answers)}
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
            <Button
              className="mt-6 h-14 w-full"
              disabled={busy}
              onClick={() => {
                const zip = normalizeUsZip(postalCode);
                if (zip && !isValidUsZip(zip)) {
                  setZipError("Enter a 5-digit US ZIP, or skip.");
                  return;
                }
                void finish({
                  ...answers,
                  location: { ...location, postalCode: zip || undefined },
                });
              }}
            >
              Show me my chores
            </Button>
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
}: {
  title: string;
  copy: string;
  children: React.ReactNode;
  onSkip?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col pt-8">
      <h1 className="font-heading text-3xl leading-tight tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
      <div className="mt-6 flex flex-1 flex-col">{children}</div>
      {onSkip ? (
        <button type="button" className="mt-4 text-[13px] font-medium text-primary" onClick={onSkip}>
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
            value === item.id ? "border-primary bg-primary/10" : "border-border bg-card",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
