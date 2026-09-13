import { registerPlugin } from "@capacitor/core";
import type { CuidalaWidgetPlugin } from "./definitions";

const CuidalaWidget = registerPlugin<CuidalaWidgetPlugin>("CuidalaWidget", {
  web: () => import("./web").then((module) => new module.CuidalaWidgetWeb()),
});

export * from "./definitions";
export { CuidalaWidget };
