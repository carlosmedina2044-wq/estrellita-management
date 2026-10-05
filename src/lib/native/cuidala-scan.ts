import { registerPlugin } from "@capacitor/core";

export type CuidalaScanPlugin = {
  isSupported(): Promise<{ supported: boolean }>;
  /** Rejects with code "cancelled" | "denied" | "unsupported". Text lines only. */
  scanLabel(): Promise<{ lines: string[] }>;
};

export const CuidalaScan = registerPlugin<CuidalaScanPlugin>("CuidalaScan");
