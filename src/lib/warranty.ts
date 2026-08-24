import { addCalendarYears, formatDueDate, formatShortDate, parseISODate, startOfDay, toISODate } from "@/lib/dates";
import type { HomeAsset } from "@/lib/types";

export const WARRANTY_LEAD_DAYS = 30;
export const WARRANTY_BADGE_DAYS = 60;
export const WARRANTY_REMINDER_HOUR = 9;

export type WarrantyNotice = {
  id: string;
  title: string;
  body: string;
  at: Date;
  extra: { tab: "home" };
};

export function warrantyFromInstall(installDate: string, years: number): string {
  return toISODate(addCalendarYears(new Date(parseISODate(installDate)), years));
}

export function warrantyBadgeLabel(asset: Pick<HomeAsset, "warrantyUntil">, today = new Date()): string | null {
  if (!asset.warrantyUntil) return null;
  const end = parseISODate(asset.warrantyUntil);
  if (!Number.isFinite(end)) return null;
  const days = Math.round((end - startOfDay(today)) / 86_400_000);
  if (days < 0 || days > WARRANTY_BADGE_DAYS) return null;
  return `Warranty ends ${formatShortDate(asset.warrantyUntil)}`;
}

export function warrantyNotificationsFor(
  assets: Array<Pick<HomeAsset, "id" | "name" | "warrantyUntil">>,
  today = new Date(),
): WarrantyNotice[] {
  const notices: WarrantyNotice[] = [];
  for (const asset of assets) {
    if (!asset.warrantyUntil) continue;
    const end = parseISODate(asset.warrantyUntil);
    if (!Number.isFinite(end)) continue;
    const at = new Date(end);
    at.setDate(at.getDate() - WARRANTY_LEAD_DAYS);
    at.setHours(WARRANTY_REMINDER_HOUR, 0, 0, 0);
    if (at.getTime() <= today.getTime()) continue;
    notices.push({
      id: `warranty-${asset.id}`,
      title: "Warranty ending soon",
      body: `${asset.name} warranty ends ${formatDueDate(asset.warrantyUntil)}. If anything’s been acting up, get it looked at while it’s covered.`,
      at,
      extra: { tab: "home" },
    });
  }
  return notices;
}
