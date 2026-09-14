"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { TodayHero } from "@/components/today/today-hero";
import { DevLocaleOverride, useLocale } from "@/i18n/locale-provider";
import { addDays, formatLongDate, toISODate } from "@/lib/dates";
import { todayGreeting } from "@/lib/greeting";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { dayArc } from "@/lib/momentum";
import type { Completion, Duty, HomeRoom, Household } from "@/lib/types";
import { isAppLocale, type AppLocale } from "@/i18n";

const STATES = [
  "open-many",
  "open-one",
  "closed-settled",
  "closed-mid-ceremony",
  "clear",
  "momentum-off",
] as const;

type ShotState = (typeof STATES)[number];

function isShotState(value: string | null): value is ShotState {
  return STATES.some((item) => item === value);
}

function duty(partial: Partial<Duty> & Pick<Duty, "id" | "title" | "room">): Duty {
  return {
    notes: "",
    nodeId: partial.room,
    nodeType: "room",
    audience: "me",
    effort: "small",
    frequency: "daily",
    kind: "chore",
    weekday: 0,
    monthDay: 1,
    dueDate: null,
    priority: "medium",
    createdAt: "2026-09-01T00:00:00.000Z",
    archived: false,
    estimatedMinutes: 8,
    ...partial,
  };
}

function completion(dutyId: string, at: Date): Completion {
  return {
    id: `c-${dutyId}`,
    dutyId,
    actor: "me",
    visitId: null,
    completedAt: at.toISOString(),
  };
}

function rooms(): HomeRoom[] {
  const types: HomeRoom["type"][] = [
    "kitchen",
    "living",
    "bathroom",
    "primary_bedroom",
    "laundry",
    "office",
    "dining",
    "patio",
    "bedroom",
  ];
  return types.map((type, index) => ({
    id: type,
    floorId: "main",
    name: type,
    type,
    sortOrder: index,
  }));
}

function fixtureHousehold(state: ShotState, now: Date): Household {
  const noon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const allRooms = rooms();
  const openMany = ["wipe", "bath", "beds", "laundry", "desk"].map((id, index) =>
    duty({
      id,
      title: id,
      room: allRooms[index]?.id ?? "kitchen",
      estimatedMinutes: 10,
    }),
  );
  const weekly = duty({
    id: "trash",
    title: "trash",
    room: "kitchen",
    frequency: "weekly",
    weekday: (now.getDay() + 2) % 7,
    estimatedMinutes: 5,
  });

  let duties: Duty[] = openMany;
  let completions: Completion[] = [];

  if (state === "open-many") {
    completions = [completion("wipe", noon), completion("bath", noon)];
  } else if (state === "open-one") {
    duties = [duty({ id: "wipe", title: "wipe", room: "kitchen", estimatedMinutes: 12 })];
  } else if (state === "closed-settled" || state === "closed-mid-ceremony") {
    completions = openMany.map((item) => completion(item.id, noon));
  } else if (state === "clear") {
    duties = [weekly];
  } else if (state === "momentum-off") {
    completions = [];
  }

  return withHouseholdDefaults({
    version: 8,
    householdName: "Casa",
    ownerName: "Alex",
    cleanerName: "Ana",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: "home",
    floors: [{ id: "main", name: "Main", sortOrder: 0 }],
    rooms: allRooms,
    assets: [],
    duties,
    completions,
    visits: [],
    supplyAutomations: [],
    momentum: {
      enabled: state !== "momentum-off",
      bestRun: 12,
      care: { level: "well-kept", since: toISODate(addDays(now, -3)), direction: "up" },
    },
  });
}

function HeroShotInner({
  state,
  locale,
}: {
  state: ShotState;
  locale: AppLocale;
}) {
  const { t } = useLocale();
  const now = new Date(2026, 8, 13, 10, 0, 0);
  const household = fixtureHousehold(state, now);
  const arc = dayArc(household, now);
  const ceremony = state === "closed-mid-ceremony";
  const greeting = todayGreeting(household.ownerName, 10);
  const secondaryLine = `${formatLongDate(now)} · ${72}°`;

  return (
    <div
      className="min-h-dvh bg-background px-4 py-4"
      data-locale={locale}
      data-locale-ready="1"
    >
      <TodayHero
        household={household}
        now={now}
        arc={arc}
        greeting={greeting}
        secondaryLine={secondaryLine}
        variant={household.momentum.enabled ? "momentum" : "plain"}
        careState={household.momentum.care}
        ceremony={ceremony}
        ceremonyStats={{ done: arc.done, minutes: arc.minutesDone, rooms: 4 }}
        ledgerLine={t("today.weekWrappedBody", { done: 18, minutes: 40, rooms: 5 })}
        onOpenSettings={() => undefined}
        onOpenCalendar={() => undefined}
        onShareClosed={() => undefined}
      />
    </div>
  );
}

export function HeroShotPage() {
  const params = useSearchParams();
  const rawState = params.get("state");
  const state: ShotState = isShotState(rawState) ? rawState : "open-many";
  const localeParam = params.get("locale");
  const locale: AppLocale = isAppLocale(localeParam) ? localeParam : "en";

  useEffect(() => {
    const root = document.documentElement;
    if (params.get("theme") === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [params]);

  return (
    <DevLocaleOverride locale={locale}>
      <HeroShotInner state={state} locale={locale} />
    </DevLocaleOverride>
  );
}
