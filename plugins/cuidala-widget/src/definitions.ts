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
};

export interface CuidalaWidgetPlugin {
  updateSnapshot(options: WidgetSnapshotPayload): Promise<void>;
  clearSnapshot(): Promise<void>;
}
