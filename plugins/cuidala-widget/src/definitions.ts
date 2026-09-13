export type WidgetSnapshotPayload = {
  dueCount: number;
  doneCount: number;
  updatedAt: string;
  titles: string[];
  dueLabel: string;
  doneLabel: string;
  emptyLabel: string;
};

export interface CuidalaWidgetPlugin {
  updateSnapshot(options: WidgetSnapshotPayload): Promise<void>;
  clearSnapshot(): Promise<void>;
}
