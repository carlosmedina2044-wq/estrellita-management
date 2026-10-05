export type WidgetSnapshotPayload = {
  dueCount: number;
  doneCount: number;
  updatedAt: string;
  titles: string[];
  dueLabel: string;
  doneLabel: string;
  emptyLabel: string;
  runLength: number;
  dayFraction: number;
  careLabel: string;
  runLabel: string;
  kitType: string;
  palette: string;
  season: string;
  windowStates: string;
  layerFiles: string[];
  phaseTimes: number[];
  intents: {
    appliances: {
      id: string;
      name: string;
      type: string;
      roomId: string;
      roomName: string;
      ageYears?: number;
      yearsLeft?: number;
      status?: string;
    }[];
    today: { day: string; left: number; items: { id: string; title: string }[] };
  };
};

export type PowerHourStartOptions = {
  title: string;
  total: number;
  left: number;
  nextTitle?: string;
  endsAtMs: number;
};

export type PowerHourStartResult = {
  started: boolean;
  reason?: "disabled" | "unsupported" | "failed";
};

export interface CuidalaWidgetPlugin {
  updateSnapshot(options: WidgetSnapshotPayload): Promise<void>;
  clearSnapshot(): Promise<void>;
  startPowerHour(options: PowerHourStartOptions): Promise<PowerHourStartResult>;
  updatePowerHour(options: { left: number; nextTitle?: string; endsAtMs?: number }): Promise<void>;
  endPowerHour(options: { finished: boolean }): Promise<void>;
}
