import { WebPlugin } from "@capacitor/core";
import type { CuidalaWidgetPlugin } from "./definitions";

export class CuidalaWidgetWeb extends WebPlugin implements CuidalaWidgetPlugin {
  async updateSnapshot(): Promise<void> {}

  async clearSnapshot(): Promise<void> {}
}
