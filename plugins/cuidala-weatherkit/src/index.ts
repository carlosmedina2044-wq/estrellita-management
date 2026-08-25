import { registerPlugin } from "@capacitor/core";
import type { CuidalaWeatherKitPlugin } from "./definitions";

const CuidalaWeatherKit = registerPlugin<CuidalaWeatherKitPlugin>("CuidalaWeatherKit", {
  web: () => import("./web").then((module) => new module.CuidalaWeatherKitWeb()),
});

export * from "./definitions";
export { CuidalaWeatherKit };
