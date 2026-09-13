export type WidgetSnapshotPayload = {
  dueCount: number;
  doneCount: number;
  updatedAt: string;
  titles: string[];
};

export interface CuidalaWidgetPlugin {
  updateSnapshot(options: WidgetSnapshotPayload): Promise<void>;
  clearSnapshot(): Promise<void>;
}
