import { registerPlugin } from "@capacitor/core";

/**
 * Rejection codes from `scanLabel`:
 * - "cancelled": the person closed the scanner.
 * - "denied": camera access is off or restricted.
 * - "unsupported": this device has no text scanner.
 */
export type CuidalaScanPlugin = {
  isSupported(): Promise<{ supported: boolean }>;
  /** Text lines only, top to bottom. No image is ever captured or returned. */
  scanLabel(): Promise<{ lines: string[] }>;
};

export const CuidalaScan = registerPlugin<CuidalaScanPlugin>("CuidalaScan");
