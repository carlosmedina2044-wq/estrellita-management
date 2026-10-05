import { isNativeIos } from "@/lib/native/platform";

export type ScanFailure = "cancelled" | "denied" | "unsupported" | "unavailable";
export type ScanResult = { ok: true; lines: string[] } | { ok: false; reason: ScanFailure };

export type ScannedBarcode = { value: string; symbology: string };
export type ScanAnyResult =
  | { ok: true; lines: string[]; barcodes: ScannedBarcode[] }
  | { ok: false; reason: ScanFailure };

type ScanPlugin = {
  isSupported(): Promise<{ supported: boolean }>;
  scanLabel(): Promise<{ lines: string[] }>;
  /** Optional so older mocks and older native builds still type-check and degrade to "unavailable". */
  scanAny?(): Promise<{ lines: string[]; barcodes: ScannedBarcode[] }>;
  readPhoto?(): Promise<{ lines: string[]; barcodes: ScannedBarcode[] }>;
};

let testPlugin: ScanPlugin | null = null;

/** Test hook: stand in for the native plugin. Pass null to restore. */
export function installScanPluginForTests(plugin: ScanPlugin | null): void {
  testPlugin = plugin;
}

async function loadPlugin(): Promise<ScanPlugin | null> {
  if (testPlugin) return testPlugin;
  if (!isNativeIos()) return null;
  const { CuidalaScan } = await import("@/lib/native/cuidala-scan");
  return CuidalaScan;
}

/** True only on an iPhone or iPad that can read text live. Never throws. */
export async function scanSupported(): Promise<boolean> {
  try {
    const plugin = await loadPlugin();
    if (!plugin) return false;
    return (await plugin.isSupported()).supported === true;
  } catch {
    return false;
  }
}

function failureReason(error: unknown): ScanFailure {
  const code =
    error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code === "cancelled" || code === "denied" || code === "unsupported") return code;
  return "unavailable";
}

function cleanLines(lines: unknown): string[] {
  return Array.isArray(lines) ? lines.filter((l): l is string => typeof l === "string") : [];
}

function cleanBarcodes(barcodes: unknown): ScannedBarcode[] {
  if (!Array.isArray(barcodes)) return [];
  const out: ScannedBarcode[] = [];
  for (const b of barcodes) {
    if (b && typeof b === "object" && typeof (b as ScannedBarcode).value === "string" && (b as ScannedBarcode).value) {
      const symbology = (b as ScannedBarcode).symbology;
      out.push({ value: (b as ScannedBarcode).value, symbology: typeof symbology === "string" ? symbology : "" });
    }
  }
  return out;
}

/** Opens the camera scanner. Text lines only, never an image. Never throws. */
export async function scanLabel(): Promise<ScanResult> {
  let plugin: ScanPlugin | null;
  try {
    plugin = await loadPlugin();
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!plugin) return { ok: false, reason: "unavailable" };
  try {
    const { lines } = await plugin.scanLabel();
    return { ok: true, lines: cleanLines(lines) };
  } catch (error) {
    return { ok: false, reason: failureReason(error) };
  }
}

async function runAny(method: "scanAny" | "readPhoto"): Promise<ScanAnyResult> {
  let plugin: ScanPlugin | null;
  try {
    plugin = await loadPlugin();
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  const call = plugin?.[method];
  if (!plugin || typeof call !== "function") return { ok: false, reason: "unavailable" };
  try {
    const result = await call.call(plugin);
    return { ok: true, lines: cleanLines(result?.lines), barcodes: cleanBarcodes(result?.barcodes) };
  } catch (error) {
    return { ok: false, reason: failureReason(error) };
  }
}

/** Live camera: text and barcodes together. Never an image. Never throws. */
export function scanAny(): Promise<ScanAnyResult> {
  return runAny("scanAny");
}

/** Pick a photo, read it on the device, keep nothing. Needs no camera. Never throws. */
export function readPhoto(): Promise<ScanAnyResult> {
  return runAny("readPhoto");
}
