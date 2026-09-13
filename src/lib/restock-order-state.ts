/**
 * Pure state machine for the Restock "Order" flow:
 * closed → picker → (opened | already_ordered) → confirm → ordered.
 *
 * Keeps the confirm step reachable after the picker dismisses (P1-08).
 */

export type RestockOrderPhase =
  | "closed"
  | "picker"
  | "waiting_resume"
  | "confirm"
  | "ordered";

export type RestockOrderEvent =
  | { type: "open_picker" }
  | { type: "picker_opened"; retailer?: string; waitForResume?: boolean }
  | { type: "already_ordered"; retailer?: string }
  | { type: "picker_dismissed" }
  | { type: "resume" }
  | { type: "confirm" }
  | { type: "cancel_confirm" }
  | { type: "reset" };

export type RestockOrderState = {
  phase: RestockOrderPhase;
  retailer?: string;
  /** True after picker selects a path that should open confirm. */
  flowProgressing: boolean;
};

export const initialRestockOrderState: RestockOrderState = {
  phase: "closed",
  flowProgressing: false,
};

export function reduceRestockOrder(
  state: RestockOrderState,
  event: RestockOrderEvent,
): RestockOrderState {
  switch (event.type) {
    case "reset":
      return { ...initialRestockOrderState };

    case "open_picker":
      return { phase: "picker", retailer: undefined, flowProgressing: false };

    case "picker_opened": {
      const retailer = event.retailer;
      if (event.waitForResume) {
        return { phase: "waiting_resume", retailer, flowProgressing: true };
      }
      return { phase: "confirm", retailer, flowProgressing: true };
    }

    case "already_ordered":
      return {
        phase: "confirm",
        retailer: event.retailer ?? state.retailer,
        flowProgressing: true,
      };

    case "picker_dismissed":
      // Picker closes after open/already-ordered; keep confirm / waiting_resume mounted.
      if (state.flowProgressing && (state.phase === "confirm" || state.phase === "waiting_resume")) {
        return state;
      }
      if (state.flowProgressing && state.phase === "picker") {
        return { ...state, phase: "confirm" };
      }
      return { phase: "closed", retailer: undefined, flowProgressing: false };

    case "resume":
      if (state.phase !== "waiting_resume") return state;
      return { phase: "confirm", retailer: state.retailer, flowProgressing: true };

    case "confirm":
      if (state.phase !== "confirm") return state;
      return { phase: "ordered", retailer: state.retailer, flowProgressing: false };

    case "cancel_confirm":
      if (state.phase !== "confirm") return state;
      return { phase: "closed", retailer: undefined, flowProgressing: false };

    default:
      return state;
  }
}

/** Drive pick → opened → confirm → ordered for tests and callers. */
export function runRestockOrderPath(
  events: RestockOrderEvent[],
  start: RestockOrderState = initialRestockOrderState,
): RestockOrderState {
  return events.reduce(reduceRestockOrder, start);
}
