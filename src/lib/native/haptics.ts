import { isNative } from "@/lib/native/platform";

export type HapticKind = "complete" | "undo" | "ordered" | "tab" | "destructive";

async function play(kind: HapticKind): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    switch (kind) {
      case "complete":
        await Haptics.notification({ type: NotificationType.Success });
        return;
      case "undo":
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
    }
  } catch {
    // Web, Simulator, or a missing plugin must never throw into the UI.
  }
}

export function hapticComplete(): Promise<void> {
  return play("complete");
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
