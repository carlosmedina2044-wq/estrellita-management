"use client";

import { useState, type ReactNode } from "react";
import { Smartphone } from "lucide-react";
import { HomeEditor } from "@/components/home-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Household } from "@/lib/types";
import { ZipField } from "@/components/zip-prompt";
import { climateLabel, deriveClimate } from "@/lib/climate";
import { toast } from "sonner";

export function HomeView({
  household,
  onUpdate,
  onSavePostalCode,
  onStartCleanerVisit,
  onChangeTree,
  onDeleted,
}: {
  household: Household;
  onUpdate: (
    patch: Partial<Pick<Household, "householdName" | "ownerName" | "cleanerName" | "ownerPin" | "location" | "lockSettings" | "account">>,
  ) => void | Promise<void>;
  onSavePostalCode?: (zip: string) => Promise<{ ok: boolean; error?: string }>;
  onStartCleanerVisit: () => void;
  onChangeTree?: (next: Household) => void;
  onDeleted?: () => void;
}) {
  const [home, setHome] = useState(household.householdName);
  const [owner, setOwner] = useState(household.ownerName);
  const [cleaner, setCleaner] = useState(household.cleanerName);

  async function save() {
    await onUpdate({
      householdName: home,
      ownerName: owner,
      cleanerName: cleaner,
    });
    toast.success("Saved");
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="Home name">
        <Input value={home} onChange={(event) => setHome(event.target.value)} className="h-12" />
      </Field>
      <Field label="Your name">
        <Input value={owner} onChange={(event) => setOwner(event.target.value)} className="h-12" />
      </Field>
      <Field label="Cleaning service / person">
        <Input
          value={cleaner}
          onChange={(event) => setCleaner(event.target.value)}
          placeholder="Cleaner"
          className="h-12"
        />
      </Field>
      <Field label="ZIP (weather + climate)">
        {household.location.postalCode ? (
          <p className="text-sm text-muted-foreground">
            {climateLabel(deriveClimate(household.location))} · {household.location.postalCode}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Used for weather and seasonal jobs. 5-digit US ZIP.</p>
        )}
        <ZipField
          value={household.location.postalCode}
          onSave={async (zip) => {
            if (onSavePostalCode) {
              const result = await onSavePostalCode(zip);
              if (result.ok) toast.success("ZIP saved");
              return result;
            }
            await onUpdate({ location: { ...household.location, postalCode: zip } });
            toast.success("ZIP saved");
            return { ok: true };
          }}
        />
      </Field>

      <div className="rounded-2xl bg-white p-4">
        <p className="font-medium">Require Face ID</p>
        <p className="mt-1 text-xs text-muted-foreground">Default on. Lock after returning from background.</p>
        <button
          type="button"
          className="mt-3 h-12 w-full rounded-xl bg-secondary text-sm font-medium"
          onClick={() =>
            void onUpdate({
              lockSettings: { ...household.lockSettings, requireFaceId: !household.lockSettings.requireFaceId },
            })
          }
        >
          {household.lockSettings.requireFaceId ? "On" : "Off"}
        </button>
        <div className="mt-3 flex gap-2">
          {(["immediate", "2min", "15min"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={
                household.lockSettings.lockAfter === item
                  ? "h-10 flex-1 rounded-full bg-primary text-[13px] text-primary-foreground"
                  : "h-10 flex-1 rounded-full bg-secondary text-[13px]"
              }
              onClick={() => void onUpdate({ lockSettings: { ...household.lockSettings, lockAfter: item } })}
            >
              {item === "immediate" ? "Immediate" : item === "2min" ? "2 min" : "15 min"}
            </button>
          ))}
        </div>
      </div>

      {onChangeTree ? <HomeEditor household={household} onChange={onChangeTree} /> : null}

      <Button
        variant="secondary"
        className="h-12 text-destructive"
        onClick={async () => {
          if (!confirm("Delete this account and all home data on the server? This cannot be undone.")) return;
          if (household.account.appleUserId || household.account.email) {
            await fetch("/api/account", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: household.account.appleUserId || household.account.email }),
            });
          }
          onDeleted?.();
          toast.success("Account deleted");
        }}
      >
        Delete account
      </Button>

      <Button className="h-12" onClick={save}>
        Save
      </Button>

      <Button variant="secondary" className="h-12" onClick={onStartCleanerVisit}>
        Hand phone to {household.cleanerName || "cleaner"}
      </Button>

      <div className="rounded-2xl border border-black/8 bg-white p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-card text-primary">
            <Smartphone className="size-5" />
          </span>
          <div>
            <p className="font-medium">On your iPhone</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
              <li>Open this site in Safari</li>
              <li>Tap Share</li>
              <li>Add to Home Screen</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
