import { WebPlugin } from "@capacitor/core";
import type { CuidalaWidgetPlugin, PowerHourStartResult } from "./definitions";

export class CuidalaWidgetWeb extends WebPlugin implements CuidalaWidgetPlugin {
  async updateSnapshot(): Promise<void> {}

  async clearSnapshot(): Promise<void> {}

  async startPowerHour(): Promise<PowerHourStartResult> {
    return { started: false, reason: "unsupported" };
  }

  async updatePowerHour(): Promise<void> {}

  async endPowerHour(): Promise<void> {}
}
