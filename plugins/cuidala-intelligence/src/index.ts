import { registerPlugin } from "@capacitor/core";
import type { CuidalaIntelligencePlugin } from "./definitions";

const CuidalaIntelligence = registerPlugin<CuidalaIntelligencePlugin>("CuidalaIntelligence");

export * from "./definitions";
export { CuidalaIntelligence };
