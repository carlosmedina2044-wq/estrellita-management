"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { AiInviteCard } from "@/components/ai-invite-card";
import { useAiAvailability } from "@/hooks/use-ai-availability";
import { recordAiInviteDismissal, shouldShowAiInvite } from "@/lib/ai-invite";
import { FilterCard, ProductCard, ReceiptCard, WarrantyCard, AiBadge, BIG } from "@/components/scan-cards";
import { RollingNumber } from "@/components/today/rolling-number";
import { SettingsGroup, SelectRow, TextRow } from "@/components/settings-rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { MessageKey } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
import { assetLabel } from "@/lib/asset-catalog";
import { formatMoney } from "@/lib/forecast";
import { ASSET_TYPES } from "@/lib/home-model";
import { DUR_SCREEN, EASE_OUT } from "@/lib/motion";
import { hapticPress, hapticSuccess } from "@/lib/native/haptics";
import { isNative } from "@/lib/native/platform";
import { readPhoto, scanAny, scanSupported, type ScanAnyResult } from "@/lib/native/scan";
import { addFromLabel, assetNameFor, defaultRoomFor, typeFor } from "@/lib/scan/add-from-label";
import { appraise, type LabelReading } from "@/lib/scan";
import {
  decideKind,
  enrichWithAi,
  linesOfText,
  makeCapture,
  needsHelp,
  readAs,
  type Capture,
  type LabelRead,
  type Read,
  type ReadKind,
} from "@/lib/scan/reader";
import type { AssetType, Household } from "@/lib/types";
import { cn } from "@/lib/utils";

type Phase = "intro" | "scanning" | "denied" | "typed" | "unread" | "ask" | "reading" | "confirm";

type Typed = { brand: string; model: string; serial: string; date: string; more: string };
const EMPTY_TYPED: Typed = { brand: "", model: "", serial: "", date: "", more: "" };

/** The same plate lines the camera would hand over, built from what the person typed. */
export function linesFromTyped(typed: Typed): string[] {
  const lines: string[] = [];
  if (typed.brand.trim()) lines.push(typed.brand.trim());
  if (typed.model.trim()) lines.push(`MODEL NO. ${typed.model.trim()}`);
  if (typed.serial.trim()) lines.push(`SERIAL NO. ${typed.serial.trim()}`);
  if (typed.date.trim()) lines.push(`MFG DATE: ${typed.date.trim()}`);
  for (const line of typed.more.split(/\r?\n/)) if (line.trim()) lines.push(line.trim());
  return lines;
}

const KIND_LABEL: Record<ReadKind, MessageKey> = {
  label: "scan.kindLabel",
  receipt: "scan.kindReceipt",
  filter: "scan.kindFilter",
  product: "scan.kindProduct",
  warranty: "scan.kindWarranty",
};

/** A sentence with one changing number that rolls (a plain figure under Reduce Motion). */
function RollingSentence({
  id,
  name,
  value,
  params,
  prefix = "",
}: {
  id: MessageKey;
  name: string;
  value: number;
  params?: Record<string, string | number>;
  prefix?: string;
}) {
  const { t } = useLocale();
  const marker = "\u0001";
  const [before = "", after = ""] = t(id, { ...params, [name]: marker }).split(marker);
  return (
    <>
      {before}
      {prefix}
      <RollingNumber value={value} />
      {after}
    </>
  );
}

/** One reader for the house: stickers, receipts, filters, boxes and warranties. */
export function ScanLabelSheet({
  open,
  onOpenChange,
  household,
  roomId,
  onApply,
  intent,
  onNewSupply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  household: Household;
  /** The room the sheet was opened from; the card still lets the person change it. */
  roomId?: string;
  /** Saves by building the next household from the latest one. */
  onApply: (build: (current: Household) => Household) => void;
  /** "receipt" when opened from Restock: the words lean to receipts, and an unclear read is tried as one. */
  intent?: "receipt";
  /** Opens the add-supply flow for a box that isn't tracked yet. */
  onNewSupply?: (barcode: string) => void;
}) {
  const { t } = useLocale();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" size="form" className="gap-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* Mounted only while open, so every visit starts fresh at the intro. */}
        {open ? (
          <ScanBody
            household={household}
            roomId={roomId}
            onApply={onApply}
            onClose={() => onOpenChange(false)}
            intent={intent}
            onNewSupply={onNewSupply}
            title={intent === "receipt" ? t("scan.receiptTitle") : t("scan.title")}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ScanBody({
  household,
  roomId,
  onApply,
  onClose,
  intent,
  onNewSupply,
  title,
}: {
  household: Household;
  roomId?: string;
  onApply: (build: (current: Household) => Household) => void;
  onClose: () => void;
  intent?: "receipt";
  onNewSupply?: (barcode: string) => void;
  title: string;
}) {
  const { t, locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("intro");
  const [canScan, setCanScan] = useState(false);
  const [note, setNote] = useState<MessageKey | null>(null);
  const [typed, setTyped] = useState<Typed>(EMPTY_TYPED);
  const [capture, setCapture] = useState<Capture>({ lines: [], barcodes: [] });
  const [choices, setChoices] = useState<ReadKind[]>([]);
  const [read, setRead] = useState<Read | null>(null);
  const [helped, setHelped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [typeOverride, setTypeOverride] = useState<AssetType | undefined>();
  const [dateOverride, setDateOverride] = useState("");
  const [roomPick, setRoomPick] = useState<string | undefined>(roomId);
  const busy = useRef(false);
  const [stampedAt, setStampedAt] = useState(() => new Date());

  useEffect(() => {
    let alive = true;
    void scanSupported().then((ok) => {
      if (alive) setCanScan(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  /** Reads the capture as one kind, asks the model for help only if the plain read is shaky, then shows the card. */
  async function proceed(kind: ReadKind, taken: Capture) {
    if (busy.current) return;
    busy.current = true;
    try {
      const stamp = new Date();
      setStampedAt(stamp);
      const plain = readAs(kind, taken, household, stamp);
      if (!plain) {
        setPhase("unread");
        return;
      }
      const wasShaky = needsHelp(plain);
      // Only show "taking a closer look" if the model really takes a moment.
      const timer = wasShaky ? setTimeout(() => setPhase("reading"), 350) : undefined;
      const final = wasShaky ? await enrichWithAi(plain, taken, household, stamp) : plain;
      if (timer) clearTimeout(timer);
      setHelped(wasShaky);
      setRead(final);
      setTypeOverride(undefined);
      setDateOverride("");
      setEditing(false);
      setRoomPick(roomId);
      setPhase("confirm");
      void hapticPress();
    } finally {
      busy.current = false;
    }
  }

  /** Works out what was captured. `forced` skips the question (typed sticker fields). */
  async function handleCapture(taken: Capture, forced?: ReadKind) {
    setCapture(taken);
    const decision = forced ? { kind: forced, confident: true } : decideKind(taken);
    if (decision.kind === "ask") {
      setChoices(decision.candidates);
      setPhase("ask");
      return;
    }
    if (decision.kind === "none") {
      if (intent === "receipt" && taken.lines.length > 0) {
        await proceed("receipt", taken);
        return;
      }
      setPhase("unread");
      return;
    }
    await proceed(decision.kind, taken);
  }

  function onCaptured(result: ScanAnyResult) {
    if (result.ok) {
      void handleCapture(makeCapture(result.lines, result.barcodes.map((b) => b.value)));
      return;
    }
    if (result.reason === "cancelled") setPhase("intro");
    else if (result.reason === "denied") setPhase("denied");
    else {
      setNote("scan.unavailable");
      setPhase("typed");
    }
  }

  async function startScan() {
    setNote(null);
    setPhase("scanning");
    onCaptured(await scanAny());
  }

  async function startPhoto() {
    setNote(null);
    setPhase("scanning");
    onCaptured(await readPhoto());
  }

  function openSettings() {
    if (!isNative()) return;
    // Same route the lock screen uses: a custom scheme only opens through a top-level navigation.
    window.location.href = "app-settings:";
  }

  const field = (key: keyof Typed) => ({
    value: typed[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setTyped((current) => ({ ...current, [key]: event.target.value })),
  });

  const ai = useAiAvailability();
  const footer =
    helped && shouldShowAiInvite(household, ai.state, new Date()) ? (
      <AiInviteCard context="scan" onDismiss={() => onApply((current) => recordAiInviteDismissal(current))} />
    ) : null;
  const cardProps = {
    household,
    locale,
    reduceMotion: Boolean(reduceMotion),
    onApply,
    onClose,
    footer,
  };

  let body: React.ReactNode;

  if (phase === "confirm" && read) {
    if (read.kind === "label") {
      body = (
        <LabelCard
          household={household}
          read={read}
          locale={locale}
          reduceMotion={Boolean(reduceMotion)}
          editing={editing}
          setEditing={setEditing}
          typeOverride={typeOverride}
          setTypeOverride={setTypeOverride}
          dateOverride={dateOverride}
          setDateOverride={setDateOverride}
          roomPick={roomPick}
          setRoomPick={setRoomPick}
          onApply={onApply}
          onClose={onClose}
          footer={footer}
        />
      );
    } else if (read.kind === "receipt") {
      body = <ReceiptCard {...cardProps} read={read} />;
    } else if (read.kind === "filter") {
      body = <FilterCard {...cardProps} read={read} />;
    } else if (read.kind === "product") {
      body = <ProductCard {...cardProps} read={read} onNewSupply={onNewSupply} />;
    } else {
      body = <WarrantyCard {...cardProps} read={read} capture={capture} now={stampedAt} />;
    }
  } else if (phase === "reading") {
    body = (
      <>
        <h2 className="ui-page-title ui-display pr-10 font-semibold">{t("scan.reading")}</h2>
        <p role="status" className="sr-only">
          {t("scan.reading")}
        </p>
      </>
    );
  } else if (phase === "ask") {
    body = (
      <>
        <h2 className="ui-page-title ui-display pr-10 font-semibold">{t("scan.askTitle")}</h2>
        <p className="ui-body text-muted-foreground">{t("scan.askBody")}</p>
        <div className="grid gap-2">
          {choices.map((kind, index) => (
            <Button
              key={kind}
              type="button"
              variant={index === 0 ? "default" : "secondary"}
              className={BIG}
              onClick={() => void proceed(kind, capture)}
            >
              {t(KIND_LABEL[kind])}
            </Button>
          ))}
          <Button type="button" variant="ghost" className={BIG} onClick={() => setPhase("intro")}>
            {t("scan.tryAgain")}
          </Button>
        </div>
      </>
    );
  } else if (phase === "typed") {
    const empty = Object.values(typed).every((value) => !value.trim());
    const pasted = typed.more.trim().length > 0;
    body = (
      <>
        <h2 className="ui-page-title ui-display pr-10 font-semibold">{t("scan.typedTitle")}</h2>
        {note ? <p className="ui-body text-muted-foreground">{t(note)}</p> : null}
        <LabelField label={t("scan.fieldMore")}>
          <Textarea
            {...field("more")}
            placeholder={t("scan.fieldMorePlaceholder")}
            autoCapitalize="none"
            autoCorrect="off"
            className="min-h-24 ui-body"
          />
        </LabelField>
        <p className="px-1 ui-caption font-medium text-muted-foreground">{t("scan.fieldsHint")}</p>
        <div className="grid gap-3">
          <LabelField label={t("scan.fieldBrand")}>
            <Input {...field("brand")} autoCapitalize="words" className={TONAL} />
          </LabelField>
          <LabelField label={t("scan.fieldModel")}>
            <Input {...field("model")} autoCapitalize="characters" autoCorrect="off" className={TONAL} />
          </LabelField>
          <LabelField label={t("scan.fieldSerial")}>
            <Input {...field("serial")} autoCapitalize="characters" autoCorrect="off" className={TONAL} />
          </LabelField>
          <LabelField label={t("scan.fieldDate")}>
            <Input {...field("date")} placeholder={t("scan.fieldDatePlaceholder")} inputMode="numeric" className={TONAL} />
          </LabelField>
        </div>
        <div className="grid gap-2">
          <Button
            type="button"
            className={BIG}
            disabled={empty}
            onClick={() =>
              // Only the sticker boxes filled in means "this is a sticker"; pasted text is classified.
              void handleCapture(
                makeCapture([...linesOfText(typed.more), ...linesFromTyped({ ...typed, more: "" })]),
                pasted ? undefined : "label",
              )
            }
          >
            {t("scan.readIt")}
          </Button>
          <Button type="button" variant="secondary" className={BIG} onClick={() => setPhase("intro")}>
            {t("common.back")}
          </Button>
        </div>
      </>
    );
  } else if (phase === "unread") {
    body = (
      <>
        <h2 className="ui-page-title ui-display pr-10 font-semibold">{t("scan.unreadTitle")}</h2>
        <p className="ui-body text-muted-foreground">{t("scan.unreadBody")}</p>
        <div className="grid gap-2">
          {canScan ? (
            <Button type="button" className={BIG} onClick={() => void startScan()}>
              {t("scan.tryAgain")}
            </Button>
          ) : null}
          <Button type="button" variant={canScan ? "secondary" : "default"} className={BIG} onClick={() => setPhase("typed")}>
            {t("scan.typeCta")}
          </Button>
        </div>
      </>
    );
  } else if (phase === "denied") {
    body = (
      <>
        <h2 className="ui-page-title ui-display pr-10 font-semibold">{t("scan.deniedTitle")}</h2>
        <p className="ui-body text-muted-foreground">{t("scan.deniedBody")}</p>
        <div className="grid gap-2">
          <Button type="button" className={BIG} onClick={openSettings}>
            {t("scan.openSettings")}
          </Button>
          <Button type="button" variant="secondary" className={BIG} onClick={() => setPhase("typed")}>
            {t("scan.typeCta")}
          </Button>
        </div>
      </>
    );
  } else {
    const scanning = phase === "scanning";
    const canPhoto = isNative();
    body = (
      <>
        <h2 className="ui-page-title ui-display pr-10 font-semibold">{title}</h2>
        <p className="ui-body text-muted-foreground">
          {scanning ? t("scan.opening") : intent === "receipt" ? t("scan.receiptIntro") : t("scan.intro")}
        </p>
        <div className="grid gap-2">
          {canScan ? (
            <Button type="button" className={BIG} disabled={scanning} onClick={() => void startScan()}>
              {t("scan.scanCta")}
            </Button>
          ) : null}
          {canPhoto ? (
            <Button
              type="button"
              variant={canScan ? "secondary" : "default"}
              className={BIG}
              disabled={scanning}
              onClick={() => void startPhoto()}
            >
              {t("scan.photoCta")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={canScan || canPhoto ? "ghost" : "default"}
            className={BIG}
            disabled={scanning}
            onClick={() => {
              setNote(null);
              setPhase("typed");
            }}
          >
            {t("scan.typeCta")}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <SheetHeader className="shrink-0 pb-2">
        <SheetTitle className="sr-only">{title}</SheetTitle>
      </SheetHeader>
      <div data-keyboard-scroll className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 [&>*]:shrink-0">
        {body}
      </div>
    </>
  );
}

const TONAL = "h-11 rounded-lg bg-secondary px-3 ui-body dark:bg-secondary";

/** The appliance card: saves a new appliance from the sticker. */
function LabelCard({
  household,
  read,
  locale,
  reduceMotion,
  editing,
  setEditing,
  typeOverride,
  setTypeOverride,
  dateOverride,
  setDateOverride,
  roomPick,
  setRoomPick,
  onApply,
  onClose,
  footer,
}: {
  household: Household;
  read: LabelRead;
  locale: "en" | "es" | "pt-BR";
  reduceMotion: boolean;
  editing: boolean;
  setEditing: (updater: (current: boolean) => boolean) => void;
  typeOverride?: AssetType;
  setTypeOverride: (type: AssetType) => void;
  dateOverride: string;
  setDateOverride: (iso: string) => void;
  roomPick?: string;
  setRoomPick: (id: string) => void;
  onApply: (build: (current: Household) => Household) => void;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const { t } = useLocale();
  const reading = read.reading;
  return (
    <ConfirmCard
      household={household}
      reading={reading}
      locale={locale}
      reduceMotion={reduceMotion}
      editing={editing}
      onEdit={() => setEditing((current) => !current)}
      typeOverride={typeOverride}
      onType={setTypeOverride}
      dateOverride={dateOverride}
      onDate={setDateOverride}
      room={roomPick ?? defaultRoomFor(household, typeFor(reading, { type: typeOverride }))}
      onRoom={setRoomPick}
      aiFilled={read.aiFilled.length > 0}
      footer={footer}
      onAdd={() => {
        const idBase = crypto.randomUUID();
        const room = roomPick ?? defaultRoomFor(household, typeFor(reading, { type: typeOverride }));
        onApply((current) =>
          addFromLabel({
            household: current,
            reading,
            roomId: room,
            overrides: { type: typeOverride, installDate: dateOverride || undefined },
            idBase,
          }).household,
        );
        void hapticSuccess();
        toast.success(t("scan.added"));
        onClose();
      }}
    />
  );
}


function LabelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="px-1 ui-caption font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
const DATE_FIELD = "h-11 rounded-lg bg-secondary px-3 text-left ui-body dark:bg-secondary";

function ConfirmCard({
  household,
  reading,
  locale,
  reduceMotion,
  editing,
  onEdit,
  typeOverride,
  onType,
  dateOverride,
  onDate,
  room,
  onRoom,
  onAdd,
  aiFilled,
  footer,
}: {
  household: Household;
  reading: LabelReading;
  locale: "en" | "es" | "pt-BR";
  reduceMotion: boolean;
  editing: boolean;
  onEdit: () => void;
  typeOverride?: AssetType;
  onType: (type: AssetType) => void;
  dateOverride: string;
  onDate: (iso: string) => void;
  room: string;
  onRoom: (id: string) => void;
  onAdd: () => void;
  aiFilled?: boolean;
  footer?: React.ReactNode;
}) {
  const { t } = useLocale();
  const type = typeFor(reading, { type: typeOverride });
  const knownType = Boolean(reading.type || typeOverride);
  const made = reading.manufactured;
  const dateTag = locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es-MX" : "en-US";

  // The person's own date wins; otherwise the label's. Recomputed here so a
  // changed type or date updates every line below it.
  const dateSource = dateOverride ? "installed" : made ? "made" : null;
  const dateValue = dateOverride
    ? new Date(`${dateOverride}T00:00:00`)
    : made
      ? new Date(made.year, (made.month ?? 7) - 1, 1)
      : null;
  const monthKnown = Boolean(dateOverride) || made?.month !== undefined;
  const dateText = dateValue
    ? dateValue.toLocaleDateString(dateTag, monthKnown ? { month: "long", year: "numeric" } : { year: "numeric" })
    : null;
  const appraisal = dateValue
    ? appraise({ type, manufacturedAt: dateOverride ? dateOverride : { year: made!.year, month: made!.month } })
    : undefined;

  const name = knownType
    ? assetNameFor(reading.brand?.value.name, type)
    : (reading.brand?.value.name ?? t("scan.unknownAppliance"));
  // Keep the dot with the name so a wrapped line never starts with it.
  const headline = (
    dateText && dateSource
      ? t(dateSource === "made" ? "scan.headMade" : "scan.headInstalled", { name, date: dateText })
      : name
  ).replace(" · ", "\u00a0· ");

  const checks: MessageKey[] = [];
  if (!dateOverride && made?.confidence === "likely") {
    checks.push(made.month === undefined ? "scan.dateLikelyYear" : "scan.dateLikelyMonth");
  }
  if (!dateOverride && reading.dateConflict) checks.push("scan.dateConflict");
  if (!typeOverride && reading.type && reading.type.basis !== "words") checks.push("scan.typeUnsure");

  const askDate = !dateValue || editing;
  const askType = !knownType || editing;
  const maxDate = new Date().toISOString().slice(0, 10);

  const rooms = household.rooms;
  const age = appraisal ? Math.floor(appraisal.ageYears) : 0;
  const statusKey: MessageKey | null =
    appraisal?.status === "past_life" ? "scan.statusPast" : appraisal?.status === "near_end" ? "scan.statusNear" : null;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR_SCREEN, ease: EASE_OUT }}
      className="flex flex-col gap-4 [&>*]:shrink-0"
    >
      <h2 className="ui-page-title text-balance break-words pr-10 text-[1.75rem] font-semibold leading-tight">{headline}</h2>
      <AiBadge show={Boolean(aiFilled)} />

      {appraisal ? (
        <div className="grid gap-1.5 rounded-[var(--r-container)] bg-card px-4 py-3">
          <p className="ui-body font-medium num">
            {appraisal.ageYears < 1 ? (
              t("scan.ageUnderOne", { life: appraisal.lifeYears })
            ) : age === 1 ? (
              t("scan.ageOne", { life: appraisal.lifeYears })
            ) : (
              <RollingSentence id="scan.age" name="age" value={age} params={{ life: appraisal.lifeYears }} />
            )}
          </p>
          {statusKey ? (
            <p className={cn("ui-body font-medium", appraisal.status === "past_life" ? "text-overdue" : "text-soon")}>
              {t(statusKey)}
            </p>
          ) : (
            <p className="ui-body text-muted-foreground num">
              {t("scan.yearsLeft", { n: Math.max(1, Math.round(appraisal.yearsLeft)) })}
            </p>
          )}
          <p className="ui-body num">{t("scan.replaceLine", { cost: formatMoney(appraisal.replacement.mid) })}</p>
          <p className="ui-body num">
            {appraisal.status === "past_life" ? (
              t("scan.setAsidePast")
            ) : (
              <RollingSentence id="scan.setAside" name="amount" value={appraisal.setAside.monthly} prefix="$" />
            )}
          </p>
        </div>
      ) : null}

      {checks.length > 0 ? (
        <div className="grid gap-1">
          {checks.map((key) => (
            <p key={key} className="ui-caption font-medium text-muted-foreground">
              {t(key)}
            </p>
          ))}
        </div>
      ) : null}

      <SettingsGroup>
        {askType ? (
          <SelectRow
            label={knownType ? t("home.applianceType") : t("scan.askType")}
            value={type}
            display={knownType ? assetLabel(type) : t("home.applianceType")}
            onValueChange={(value) => onType(value as AssetType)}
          >
            <SelectContent>
              {ASSET_TYPES.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {assetLabel(item.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRow>
        ) : null}
        {askDate ? (
          <TextRow label={dateValue ? t("scan.askMade") : t("scan.askInstalled")}>
            <Input
              type="date"
              value={dateOverride}
              max={maxDate}
              onChange={(event) => onDate(event.target.value)}
              className={DATE_FIELD}
            />
          </TextRow>
        ) : null}
        <SelectRow
          label={t("home.roomPlaceholder")}
          value={room}
          display={rooms.find((item) => item.id === room)?.name ?? t("home.roomPlaceholder")}
          onValueChange={onRoom}
        >
          <SelectContent>
            {rooms.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </SelectRow>
      </SettingsGroup>

      <div className="grid gap-2">
        <Button type="button" className={BIG} disabled={!knownType} onClick={onAdd}>
          {t("scan.add")}
        </Button>
        <Button type="button" variant="ghost" className={BIG} onClick={onEdit}>
          {editing ? t("common.done") : t("scan.edit")}
        </Button>
      </div>
      {footer}
    </motion.div>
  );
}
