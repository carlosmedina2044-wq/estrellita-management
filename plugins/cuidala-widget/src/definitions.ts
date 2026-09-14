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
};

export interface CuidalaWidgetPlugin {
  updateSnapshot(options: WidgetSnapshotPayload): Promise<void>;
  clearSnapshot(): Promise<void>;
}
