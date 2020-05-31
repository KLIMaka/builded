import { List, Node } from "../../utils/list";
import { IndexedDeck } from "../../utils/collections";

export type ReferenceUpdater<T> = (value: T) => T;

export interface ReferenceTracker<T, R> {
  ref(value: T): R;
  val(ref: R): T;
  update(updater: ReferenceUpdater<T>): void;
  start(): ReferenceTracker<T, R>;
  stop(): void;
}

export function track<T, R>(refs: ReferenceTracker<T, R>, f: (refs: ReferenceTracker<T, R>) => void): void {
  const crefs = refs.start();
  f(crefs);
  crefs.stop();
}

export class ReferenceTrackerImpl<T> implements ReferenceTracker<T, number>{
  constructor(
    private readonly nil: T,
    private readonly parent: ReferenceTrackerImpl<T> = null,
    private parentNode: Node<ReferenceTrackerImpl<T>> = null,
    private refs = new IndexedDeck<T>(),
    private nested = new List<ReferenceTrackerImpl<T>>(),
    private stopped = false
  ) { }

  ref(value: T): number {
    if (this.stopped) return -1;
    let ref = this.refs.indexOf(value);
    if (ref == -1) {
      this.refs.push(value);
      ref = this.refs.length() - 1;
    }
    return ref;
  }

  val(ref: number): T {
    if (this.stopped) return this.nil;
    const val = this.refs.get(ref);
    return val == undefined ? this.nil : val;
  }

  update(updater: ReferenceUpdater<T>): void {
    if (this.stopped) return;
    for (let i = 0; i < this.refs.length(); i++) {
      const r = this.refs.get(i);
      if (r == this.nil) continue;
      this.refs.set(i, updater(r));
    }
    for (const n of this.nested) n.update(updater);
  }

  start(): ReferenceTracker<T, number> {
    if (this.stopped) throw new Error('Tracker already stopped');
    const tracker = new ReferenceTrackerImpl<T>(this.nil, this);
    tracker.parentNode = this.nested.push(tracker);
    return tracker;
  }

  stop(): void {
    if (this.stopped) return;
    if (this.parent == null) throw new Error('Cannot stop root trackers');
    this.parent.nested.remove(this.parentNode);
    for (const n of this.nested) n.stop();
    this.nested = null;
    this.refs = null;
    this.stopped = true;
  }
}