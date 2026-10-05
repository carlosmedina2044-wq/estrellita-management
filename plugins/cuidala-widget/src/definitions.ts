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

export interface CuidalaWidgetPlugin {
  updateSnapshot(options: WidgetSnapshotPayload): Promise<void>;
  clearSnapshot(): Promise<void>;
}
