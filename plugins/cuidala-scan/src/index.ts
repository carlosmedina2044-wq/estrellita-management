import { registerPlugin } from "@capacitor/core";

export type ScannedBarcode = { value: string; symbology: string };
export type ScanAnyResult = { lines: string[]; barcodes: ScannedBarcode[] };

/**
 * Rejection codes from `scanLabel`, `scanAny` and `readPhoto`:
 * - "cancelled": the person closed the scanner or picker.
 * - "denied": camera access is off or restricted.
 * - "unsupported": this device has no text scanner.
 * - "unavailable": the photo could not be read.
 */
export type CuidalaScanPlugin = {
  isSupported(): Promise<{ supported: boolean }>;
  /** Text lines only, top to bottom. No image is ever captured or returned. */
  scanLabel(): Promise<{ lines: string[] }>;
  /** Live text and barcodes, top to bottom. No image is ever captured or returned. */
  scanAny(): Promise<ScanAnyResult>;
  /** Photo picker (no library permission) then on-device text and barcode reading. The image is never stored. */
  readPhoto(): Promise<ScanAnyResult>;
};

export const CuidalaScan = registerPlugin<CuidalaScanPlugin>("CuidalaScan");
