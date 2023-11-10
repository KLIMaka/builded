import { Timer } from "../app/apis/app1";

const MS_IN_SEC = 1000;
const MS_IN_MIN = MS_IN_SEC * 60;

export function printTime(t: number) {
  if (t <= MS_IN_SEC * 0.5) return t.toFixed(2) + 'ms';
  if (t <= MS_IN_MIN * 0.5) return (t / MS_IN_SEC).toFixed(2) + 'sec'
  return (t / MS_IN_MIN).toFixed(2) + 'min';
}

export function measure<T>(f: () => T, timer: Timer): [T, number] {
  const start = timer();
  const result = f();
  return [result, timer() - start];
}

export class StopWatch {
  private time = 0;
  private startTime = -1;

  constructor(private timer: Timer) { };

  get() {
    return this.startTime != -1
      ? this.timer() - this.startTime
      : this.time
  }

  start() {
    if (this.startTime == -1) this.startTime = this.timer();
    return this;
  }

  restart() {
    this.startTime = this.timer();
    return this;
  }

  stop() {
    if (this.startTime != -1) {
      this.time = this.timer() - this.startTime;
      this.startTime = -1;
    }
    return this;
  }

  print() {
    return printTime(this.get());
  }
}