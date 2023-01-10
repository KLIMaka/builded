import { map, range } from "../../../utils/collections";
import { Dependency, LifecycleListener } from "../../../utils/injector";
import { iter } from "../../../utils/iter";
import { int } from "../../../utils/mathutils";
import { Logger, Timer } from "../../apis/app";

type TimeStats = { start: number, end: number };

function repeat(num: number, char: string) {
  return [...map(range(0, num), _ => char)].join('');
}

function printTimeline(len: number, stat: TimeStats, start: number, end: number) {
  const dt = (end - start) / len;
  const pre = (start - stat.start) / dt;
  const proc = (stat.end - stat.start) / dt;
  const post = (end - stat.end) / dt;
  return "|" + repeat(int(pre), ' ') + repeat(int(proc), '=') + repeat(int(post), ' ') + '|';
}

export class DefaultLifecycleListener implements LifecycleListener {
  private stats: Map<Dependency<any>, TimeStats> = new Map();

  constructor(private timer: Timer, private logger: Logger) { }

  async start<T>(dep: Dependency<T>, promise: Promise<T>): Promise<T> {
    try {
      const start = this.timer()
      const result = await promise;
      const end = this.timer();
      this.stats.set(dep, { start, end });
      return result;
    } catch (e) {
      this.logger('ERROR', `${dep.name} failed to start. Error: ${e.message}`)
      throw e;
    }
  }

  private printStart() {
    const labelMax = iter(this.stats.keys()).map(d => d.name.length).reduce(Math.max, 20);
    const maxEnd = iter(this.stats.values()).map(s => s.end).reduce(Math.max, 0);
    const minStart = iter(this.stats.values()).map(s => s.start).reduce(Math.min, this.timer());
    const maxw = 80;
    const timeline = maxw - labelMax - 1;
    for (const [d, s] of this.stats) {
      this.logger('INFO', `${d.name}${repeat(labelMax - d.name.length, ' ')} ${printTimeline(timeline, s, minStart, maxEnd)}`);
    }
  }

  async stop<T>(dep: Dependency<T>, promise: Promise<void>): Promise<void> {
    try {
      await promise;
    } catch (e) {
      this.logger('ERROR', `${dep.name} failed to stop. Error: ${e.message}`)
      throw e;
    }
  }
}