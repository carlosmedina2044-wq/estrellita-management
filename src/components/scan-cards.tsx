"use client";

import { useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CircleCheck } from "@/components/circle-check";
import { SettingsGroup, SelectRow, TextRow } from "@/components/settings-rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectContent, SelectItem } from "@/components/ui/select";
import type { MessageKey } from "@/i18n";
import type { AppLocale } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
import { formatMoney } from "@/lib/forecast";
import { DUR_SCREEN, EASE_OUT } from "@/lib/motion";
import { hapticPress, hapticSuccess } from "@/lib/native/haptics";
import { applyReceipt } from "@/lib/scan/apply-receipt";
import { rememberBarcode } from "@/lib/scan/barcode";
import { applyFilterSize, type FilterTarget } from "@/lib/scan/filter";
import {
  confirmedLines,
  isTickable,

  rereadWarranty,
  receiptTotals,
  startingTicks,
  type Capture,
  type FilterRead,
  type ProductRead,
  type ReaderLine,
  type ReceiptRead,
  type WarrantyRead,
} from "@/lib/scan/reader";
import { isOrdered } from "@/lib/supply";
import type { Household } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Tall, wrapping buttons: Dynamic Type can make a label two lines. */
export const BIG = "h-auto min-h-12 w-full whitespace-normal py-3 text-center";
const DATE_FIELD = "h-11 rounded-lg bg-secondary px-3 text-left ui-body dark:bg-secondary";
const HEADLINE = "ui-page-title text-balance break-words pr-10 text-[1.75rem] font-semibold leading-tight";
const SECONDARY_TEXT = "ui-caption text-muted-foreground";

export type Apply = (build: (current: Household) => Household) => void;

type CardProps = {
  household: Household;
  locale: AppLocale;
  reduceMotion: boolean;
  onApply: Apply;
  onClose: () => void;
  /** Where the invitation to turn on Apple Intelligence sits, when the plain read needed help. */
  footer?: ReactNode;
};

export function dateTagFor(locale: AppLocale): string {
  return locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es-MX" : "en-US";
}

/** One short rise-and-fade when a card appears; nothing at all under Reduce Motion. */
export function Reveal({ reduceMotion, children }: { reduceMotion: boolean; children: ReactNode }) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR_SCREEN, ease: EASE_OUT }}
      className="flex flex-col gap-4 [&>*]:shrink-0"
    >
      {children}
    </motion.div>
  );
}

/** The small line that says some of the card was filled in by Apple Intelligence. */
export function AiBadge({ show }: { show: boolean }) {
  const { t } = useLocale();
  if (!show) return null;
  return (
    <p className="flex items-center gap-1.5 ui-caption font-medium text-muted-foreground">
      <Sparkles className="size-3.5 shrink-0" aria-hidden />
      {t("scan.aiBadge")}
    </p>
  );
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function joinHead(parts: string[]): string {
  // Keep the dot with the word before it so a wrapped line never starts with it.
  return parts.join(" · ").replace(/ · /g, " · ");
}

// ---------- receipt ----------

function targetName(household: Household, line: ReaderLine): string | undefined {
  const id = line.match?.automationId ?? line.match?.consumableId;
  if (!id) return undefined;
  return (
    household.supplyAutomations.find((a) => a.id === id)?.itemName ?? household.consumables.find((c) => c.id === id)?.name
  );
}

export function ReceiptCard({
  read,
  household,
  locale,
  reduceMotion,
  onApply,
  onClose,
  footer,
}: CardProps & { read: ReceiptRead }) {
  const { t } = useLocale();
  const [ticked, setTicked] = useState<Set<number>>(() => startingTicks(read.lines));
  const [editing, setEditing] = useState(false);
  const [assigned, setAssigned] = useState<Record<number, string>>({});

  const lines: ReaderLine[] = useMemo(
    () =>
      read.lines.map((line, index) =>
        assigned[index]
          ? { ...line, match: { automationId: assigned[index], score: 0.6, via: "name" as const }, status: "maybe" as const, preChecked: false }
          : line,
      ),
    [read.lines, assigned],
  );

  const dateText = read.date
    ? isoToDate(read.date).toLocaleDateString(dateTagFor(locale), { month: "short", day: "numeric" })
    : undefined;
  const headline = joinHead([
    read.store ?? t("scan.receiptStoreUnknown"),
    ...(dateText ? [dateText] : []),
    ...(read.total !== undefined ? [formatMoney(read.total)] : []),
  ]);

  const tickable = lines.filter(isTickable);
  const rest = lines.filter((l) => !isTickable(l) && !l.line.discount && l.line.price > 0);
  const confirmed = confirmedLines(lines, ticked, household);
  const anyMaybe = tickable.some((l) => l.status === "maybe");
  const foundText =
    tickable.length === 0
      ? t("scan.receiptFoundNone")
      : tickable.length === 1
        ? t("scan.receiptFoundOne")
        : t("scan.receiptFound", { n: tickable.length });

  function toggle(index: number) {
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    void hapticPress();
  }

  function assign(index: number, id: string) {
    setAssigned((current) => {
      const next = { ...current };
      if (id === "none") delete next[index];
      else next[index] = id;
      return next;
    });
    setTicked((current) => {
      const next = new Set(current);
      if (id === "none") next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function mark() {
    const { count, amount } = receiptTotals(confirmed);
    onApply((current) => applyReceipt(current, confirmed, { date: read.date, store: read.store }).household);
    void hapticSuccess();
    toast.success(
      amount > 0
        ? `${t("scan.receiptDone", { n: count })} ${t("scan.receiptBudget", { amount: formatMoney(amount) })}`
        : t("scan.receiptDone", { n: count }),
    );
    onClose();
  }

  const shownRest = rest.slice(0, editing ? 8 : 4);

  return (
    <Reveal reduceMotion={reduceMotion}>
      <h2 className={HEADLINE}>{headline}</h2>
      <AiBadge show={read.aiFilled.length > 0} />
      <p className="ui-body font-medium">{foundText}</p>

      {tickable.length > 0 ? (
        <div className="grid rounded-[var(--r-container)] bg-card">
          {lines.map((line, index) => {
            if (!isTickable(line)) return null;
            const name = targetName(household, line) ?? line.line.name;
            const checked = ticked.has(index);
            const item = line.match?.automationId
              ? household.supplyAutomations.find((a) => a.id === line.match?.automationId)
              : undefined;
            const caption =
              line.status === "maybe"
                ? t("scan.receiptMaybe")
                : item && isOrdered(item)
                  ? t("scan.receiptWasComing")
                  : null;
            return (
              <button
                key={index}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(index)}
                className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left ui-press"
              >
                <CircleCheck checked={checked} />
                <span className="min-w-0 flex-1">
                  <span className="block ui-body font-medium num">
                    {name} · {formatMoney(line.line.price)}
                  </span>
                  {caption ? (
                    <span className={cn("block", SECONDARY_TEXT, line.status === "maybe" && "text-soon")}>{caption}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {shownRest.length > 0 ? (
        <div className="grid gap-1 px-1">
          {shownRest.map((line, index) => (
            <p key={`${line.line.raw}-${index}`} className={cn(SECONDARY_TEXT, "num")}>
              {line.line.name} · {formatMoney(line.line.price)}
            </p>
          ))}
          {rest.length > shownRest.length ? (
            <p className={SECONDARY_TEXT}>{t("scan.receiptMore", { n: rest.length - shownRest.length })}</p>
          ) : null}
        </div>
      ) : null}

      {anyMaybe || read.receipt.confidence !== "high" || read.total === undefined ? (
        <p className="ui-caption font-medium text-muted-foreground">{t("scan.receiptNotSure")}</p>
      ) : null}

      {editing && rest.length > 0 && household.supplyAutomations.length > 0 ? (
        <SettingsGroup>
          {lines.map((line, index) => {
            const available = !isTickable(line) || assigned[index];
            if (!available || line.line.discount || line.line.price <= 0) return null;
            const current = assigned[index] ?? "none";
            const name = household.supplyAutomations.find((a) => a.id === current)?.itemName;
            return (
              <SelectRow
                key={index}
                label={`${line.line.name} · ${formatMoney(line.line.price)}`}
                value={current}
                display={name ?? t("scan.receiptNotMine")}
                onValueChange={(value) => assign(index, value)}
              >
                <SelectContent>
                  <SelectItem value="none">{t("scan.receiptNotMine")}</SelectItem>
                  {household.supplyAutomations.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.itemName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRow>
            );
          })}
        </SettingsGroup>
      ) : null}

      {tickable.length === 0 && rest.length > 0 ? <p className="ui-body text-muted-foreground">{t("scan.receiptNone")}</p> : null}

      <div className="grid gap-2">
        {tickable.length > 0 || confirmed.length > 0 ? (
          <Button type="button" className={BIG} disabled={confirmed.length === 0} onClick={mark}>
            {confirmed.length === 0 ? t("scan.receiptMarkNone") : t("scan.receiptMark", { n: confirmed.length })}
          </Button>
        ) : (
          <Button type="button" className={BIG} onClick={onClose}>
            {t("common.done")}
          </Button>
        )}
        {rest.length > 0 && household.supplyAutomations.length > 0 ? (
          <Button type="button" variant="ghost" className={BIG} onClick={() => setEditing((v) => !v)}>
            {editing ? t("common.done") : t("scan.receiptEdit")}
          </Button>
        ) : null}
      </div>
      {footer}
    </Reveal>
  );
}

// ---------- filter ----------

const DEPTHS = [1, 2, 4, 5];
const inches = (n: number) => `${n}"`;

export function FilterCard({ read, household, reduceMotion, onApply, onClose, footer }: CardProps & { read: FilterRead }) {
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const [depth, setDepth] = useState<number | undefined>(read.size.depth);
  const base = `${read.size.width}x${read.size.height}`;
  const size = useMemo(
    () => ({ ...read.size, depth, text: depth === undefined ? base : `${base}x${depth}` }),
    [read.size, depth, base],
  );

  const targets = useMemo(() => {
    const probe = { ...read.size, depth: depth ?? 1 };
    const out: { key: string; name: string; target: FilterTarget }[] = [];
    for (const asset of household.assets) {
      const target = { assetId: asset.id };
      const changed = applyFilterSize(household, target, probe).changed;
      if (changed.consumableIds.length + changed.automationIds.length > 0) {
        out.push({ key: `a:${asset.id}`, name: asset.name, target });
      }
    }
    for (const room of household.rooms) {
      if (room.system) continue;
      const target = { roomId: room.id };
      const changed = applyFilterSize(household, target, probe).changed;
      if (changed.consumableIds.length + changed.automationIds.length > 0) {
        out.push({ key: `r:${room.id}`, name: room.name, target });
      }
    }
    return out;
  }, [household, read.size, depth]);

  const [pick, setPick] = useState<string | undefined>();
  const chosen = targets.find((target) => target.key === pick) ?? targets[0];
  const sizeText = size.merv ? `${size.text} MERV ${size.merv}` : size.text;
  const askDepth = read.size.depth === undefined || editing;

  function save() {
    if (!chosen || depth === undefined) return;
    onApply((current) => applyFilterSize(current, chosen.target, size).household);
    void hapticSuccess();
    toast.success(t("scan.filterSaved", { size: size.text }));
    onClose();
  }

  return (
    <Reveal reduceMotion={reduceMotion}>
      <h2 className={HEADLINE}>{t("scan.filterHead", { size: sizeText })}</h2>
      {read.size.depth === undefined ? <p className="ui-body text-muted-foreground">{t("scan.filterNoDepth")}</p> : null}
      {read.size.confidence !== "high" ? <p className="ui-caption font-medium text-muted-foreground">{t("scan.filterCheck")}</p> : null}
      {targets.length === 0 ? (
        <p className="ui-body text-muted-foreground">{t("scan.filterNone")}</p>
      ) : (
        <SettingsGroup>
          {targets.length > 1 ? (
            <SelectRow
              label={t("scan.filterWhich")}
              value={chosen?.key ?? ""}
              display={chosen?.name ?? t("scan.filterWhich")}
              onValueChange={setPick}
            >
              <SelectContent>
                {targets.map((target) => (
                  <SelectItem key={target.key} value={target.key}>
                    {target.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRow>
          ) : null}
          {askDepth ? (
            <SelectRow
              label={t("scan.filterThickness")}
              value={depth === undefined ? "" : String(depth)}
              display={depth === undefined ? t("scan.productPick") : inches(depth)}
              onValueChange={(value) => setDepth(Number(value))}
            >
              <SelectContent>
                {DEPTHS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {inches(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRow>
          ) : null}
        </SettingsGroup>
      )}
      <div className="grid gap-2">
        {targets.length > 0 ? (
          <Button type="button" className={BIG} disabled={depth === undefined} onClick={save}>
            {t("scan.filterSave")}
          </Button>
        ) : (
          <Button type="button" className={BIG} onClick={onClose}>
            {t("common.done")}
          </Button>
        )}
        {targets.length > 0 ? (
          <Button type="button" variant="ghost" className={BIG} onClick={() => setEditing((v) => !v)}>
            {editing ? t("common.done") : t("scan.edit")}
          </Button>
        ) : null}
      </div>
      {footer}
    </Reveal>
  );
}

// ---------- product / barcode ----------

const NEW_SUPPLY = "__new";

export function ProductCard({
  read,
  household,
  reduceMotion,
  onApply,
  onClose,
  onNewSupply,
}: CardProps & {
  read: ProductRead;
  /** Opens the add-supply flow. Without it, "A new supply" is not offered. */
  onNewSupply?: (barcode: string) => void;
}) {
  const { t } = useLocale();
  const [pick, setPick] = useState("");

  if (read.known) {
    const item = read.known;
    return (
      <Reveal reduceMotion={reduceMotion}>
        <h2 className={HEADLINE}>{t("scan.productKnownHead", { item: item.itemName })}</h2>
        {isOrdered(item) ? <p className="ui-body text-muted-foreground">{t("scan.receiptWasComing")}</p> : null}
        <div className="grid gap-2">
          <Button
            type="button"
            className={BIG}
            onClick={() => {
              onApply(
                (current) =>
                  applyReceipt(current, [
                    { line: { name: item.itemName, qty: item.qtyPerOrder || 1, price: 0 }, automationId: item.id },
                  ]).household,
              );
              void hapticSuccess();
              toast.success(t("scan.productKnownDone", { item: item.itemName }));
              onClose();
            }}
          >
            {t("scan.productKnownYes")}
          </Button>
          <Button type="button" variant="ghost" className={BIG} onClick={onClose}>
            {t("scan.notNow")}
          </Button>
        </div>
      </Reveal>
    );
  }

  const items = household.supplyAutomations;
  const chosen = items.find((item) => item.id === pick);
  const canNew = Boolean(onNewSupply);

  return (
    <Reveal reduceMotion={reduceMotion}>
      <h2 className={HEADLINE}>{t("scan.productAskHead")}</h2>
      <p className="ui-body text-muted-foreground">{t("scan.productAskBody")}</p>
      {items.length === 0 && !canNew ? (
        <p className="ui-body text-muted-foreground">{t("scan.productNoSupplies")}</p>
      ) : (
        <SettingsGroup>
          <SelectRow
            label={t("scan.productWhich")}
            value={pick}
            display={pick === NEW_SUPPLY ? t("scan.productNew") : (chosen?.itemName ?? t("scan.productPick"))}
            onValueChange={setPick}
          >
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.itemName}
                </SelectItem>
              ))}
              {canNew ? <SelectItem value={NEW_SUPPLY}>{t("scan.productNew")}</SelectItem> : null}
            </SelectContent>
          </SelectRow>
        </SettingsGroup>
      )}
      <div className="grid gap-2">
        {pick === NEW_SUPPLY ? (
          <Button
            type="button"
            className={BIG}
            onClick={() => {
              onNewSupply?.(read.barcode);
              onClose();
            }}
          >
            {t("scan.productNew")}
          </Button>
        ) : (
          <Button
            type="button"
            className={BIG}
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return;
              onApply((current) => rememberBarcode(current, chosen.id, read.barcode));
              void hapticSuccess();
              toast.success(t("scan.productRemembered"));
              onClose();
            }}
          >
            {t("scan.productRemember")}
          </Button>
        )}
        <Button type="button" variant="ghost" className={BIG} onClick={onClose}>
          {t("scan.notNow")}
        </Button>
      </div>
    </Reveal>
  );
}

// ---------- warranty ----------

export function WarrantyCard({
  read,
  capture,
  household,
  locale,
  reduceMotion,
  onApply,
  onClose,
  footer,
  now,
}: CardProps & { read: WarrantyRead; capture: Capture; now: Date }) {
  const { t } = useLocale();
  const [purchase, setPurchase] = useState("");
  const [endOverride, setEndOverride] = useState("");
  const [editing, setEditing] = useState(false);
  const [assetId, setAssetId] = useState<string | undefined>();

  const reading = useMemo(
    () => (purchase && read.reading.needsStartDate ? rereadWarranty(capture, now, purchase).reading : read.reading),
    [purchase, read.reading, capture, now],
  );
  const end = endOverride || reading.warrantyUntil;
  const endText = end
    ? isoToDate(end).toLocaleDateString(dateTagFor(locale), { month: "long", year: "numeric" })
    : undefined;
  const assets = household.assets;
  const asset = assets.find((a) => a.id === assetId) ?? assets[0];
  const months = reading.termMonths;
  const termText = months
    ? months % 12 === 0
      ? t("scan.warrantyTermYears", { n: months / 12 })
      : t("scan.warrantyTermMonths", { n: months })
    : undefined;

  const headline = endText
    ? t("scan.warrantyHead", { date: endText })
    : reading.needsStartDate && termText
      ? termText
      : reading.lifetime
        ? t("scan.kindWarranty")
        : t("scan.warrantyNoEnd");

  const checks: MessageKey[] = [];
  if (!endOverride && reading.monthOnly) checks.push("scan.warrantyMonthOnly");
  else if (!endOverride && end && reading.confidence !== "high") checks.push("scan.warrantyCheck");

  const askPurchase = reading.needsStartDate && !endOverride;
  const askEnd = !end || editing;
  const maxToday = now.toISOString().slice(0, 10);

  function save() {
    if (!asset || !end) return;
    const id = asset.id;
    onApply((current) => ({
      ...current,
      assets: current.assets.map((a) => (a.id === id ? { ...a, warrantyUntil: end } : a)),
    }));
    void hapticSuccess();
    toast.success(t("scan.warrantySaved", { date: endText ?? end }));
    onClose();
  }

  return (
    <Reveal reduceMotion={reduceMotion}>
      <h2 className={HEADLINE}>{headline}</h2>
      {reading.lifetime && !end ? <p className="ui-body text-muted-foreground">{t("scan.warrantyLifetime")}</p> : null}
      {checks.map((key) => (
        <p key={key} className="ui-caption font-medium text-muted-foreground">
          {t(key)}
        </p>
      ))}
      {assets.length === 0 ? <p className="ui-body text-muted-foreground">{t("scan.warrantyNoAppliance")}</p> : null}
      <SettingsGroup>
        {askPurchase ? (
          <TextRow label={t("scan.warrantyAskBuy")}>
            <Input type="date" value={purchase} max={maxToday} onChange={(e) => setPurchase(e.target.value)} className={DATE_FIELD} />
          </TextRow>
        ) : null}
        {askEnd && !askPurchase ? (
          <TextRow label={t("scan.warrantyAskEnd")}>
            <Input type="date" value={endOverride} onChange={(e) => setEndOverride(e.target.value)} className={DATE_FIELD} />
          </TextRow>
        ) : null}
        {assets.length > 0 ? (
          <SelectRow
            label={t("scan.warrantyWhich")}
            value={asset?.id ?? ""}
            display={asset?.name ?? ""}
            onValueChange={setAssetId}
          >
            <SelectContent>
              {assets.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRow>
        ) : null}
      </SettingsGroup>
      <div className="grid gap-2">
        <Button type="button" className={BIG} disabled={!end || !asset} onClick={save}>
          {t("scan.warrantySave")}
        </Button>
        {end ? (
          <Button type="button" variant="ghost" className={BIG} onClick={() => setEditing((v) => !v)}>
            {editing ? t("common.done") : t("scan.edit")}
          </Button>
        ) : null}
      </div>
      {footer}
    </Reveal>
  );
}

