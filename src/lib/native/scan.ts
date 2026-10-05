import { isNativeIos } from "@/lib/native/platform";

export type ScanFailure = "cancelled" | "denied" | "unsupported" | "unavailable";
export type ScanResult = { ok: true; lines: string[] } | { ok: false; reason: ScanFailure };

type ScanPlugin = {
  isSupported(): Promise<{ supported: boolean }>;
  scanLabel(): Promise<{ lines: string[] }>;
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
    return { ok: true, lines: Array.isArray(lines) ? lines.filter((l) => typeof l === "string") : [] };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code === "cancelled" || code === "denied" || code === "unsupported") return { ok: false, reason: code };
    return { ok: false, reason: "unavailable" };
  }
}
