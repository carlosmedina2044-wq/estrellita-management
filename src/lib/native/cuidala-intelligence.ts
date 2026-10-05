import { registerPlugin } from "@capacitor/core";
import type { CuidalaIntelligencePlugin } from "../../../plugins/cuidala-intelligence/src/definitions";

export type {
  CuidalaIntelligencePlugin,
  IntelligenceFailureCode,
  IntelligenceUnavailableReason,
  RawAction,
  RawLabel,
  RawReceipt,
  RawReceiptItem,
  TellCuidalaInput,
} from "../../../plugins/cuidala-intelligence/src/definitions";

export const CuidalaIntelligence = registerPlugin<CuidalaIntelligencePlugin>("CuidalaIntelligence");
