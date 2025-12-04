import { BuildReferenceTracker } from "../../apis/app2";
import { ReferenceTrackerImpl } from "../../apis/referencetracker";

export class BuildReferenceTrackerImpl implements BuildReferenceTracker {
  readonly walls = new ReferenceTrackerImpl<number>(-1);
  readonly sectors = new ReferenceTrackerImpl<number>(-1);
  readonly sprites = new ReferenceTrackerImpl<number>(-1);
}