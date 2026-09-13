import { registerPlugin } from "@capacitor/core";

export type CuidalaDeviceKeyPlugin = {
  get(options: { key: string }): Promise<{ value: string }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
  verifyOwner(options: { reason: string; fallbackTitle?: string }): Promise<void>;
};

export const CuidalaDeviceKey = registerPlugin<CuidalaDeviceKeyPlugin>("CuidalaDeviceKey");
