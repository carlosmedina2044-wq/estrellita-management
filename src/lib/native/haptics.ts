import { isNative } from "@/lib/native/platform";

export type HapticKind =
  | "complete"
  | "success"
  | "undo"
  | "ordered"
  | "tab"
  | "destructive"
  | "press"
  | "close";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function play(kind: HapticKind): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    switch (kind) {
      case "complete":
      case "success":
        await Haptics.notification({ type: NotificationType.Success });
        return;
      case "undo":
      case "press":
        await Haptics.impact({ style: ImpactStyle.Light });
        return;
      case "ordered":
        await Haptics.impact({ style: ImpactStyle.Medium });
        return;
      case "tab":
        await Haptics.selectionChanged();
        return;
      case "destructive":
        await Haptics.notification({ type: NotificationType.Warning });
        return;
      case "close":
        await Haptics.notification({ type: NotificationType.Success });
        await wait(120);
        await Haptics.impact({ style: ImpactStyle.Light });
        await wait(120);
        await Haptics.impact({ style: ImpactStyle.Medium });
        return;
    }
  } catch {
    // Web, Simulator, or a missing plugin must never throw into the UI.
  }
}

export function hapticComplete(): Promise<void> {
  return play("complete");
}

export function hapticSuccess(): Promise<void> {
  return play("success");
}

export function hapticUndo(): Promise<void> {
  return play("undo");
}

export function hapticOrdered(): Promise<void> {
  return play("ordered");
}

export function hapticTab(): Promise<void> {
  return play("tab");
}

export function hapticDestructive(): Promise<void> {
  return play("destructive");
}

export function hapticPress(): Promise<void> {
  return play("press");
}

export function hapticClose(): Promise<void> {
  return play("close");
}
