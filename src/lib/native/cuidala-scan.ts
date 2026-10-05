import { registerPlugin } from "@capacitor/core";

export type CuidalaScanPlugin = {
  isSupported(): Promise<{ supported: boolean }>;
  /** Rejects with code "cancelled" | "denied" | "unsupported". Text lines only. */
  scanLabel(): Promise<{ lines: string[] }>;
  /** Live text and barcodes. Same rejection codes as scanLabel. */
  scanAny(): Promise<{ lines: string[]; barcodes: { value: string; symbology: string }[] }>;
  /** Photo picker plus on-device reading. Rejects "cancelled" or "unavailable". */
  readPhoto(): Promise<{ lines: string[]; barcodes: { value: string; symbology: string }[] }>;
};

export const CuidalaScan = registerPlugin<CuidalaScanPlugin>("CuidalaScan");
