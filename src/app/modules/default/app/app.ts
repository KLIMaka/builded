import { Consumer } from "ts-utils/types";
import { App, BatchTask, DelayedTask, FrameTask, Logger, PeriodicTask, Timer } from "../../../apis/app1";
import { DefaultScheduler } from "ts-utils/scheduler";
import { DefaultLogger } from "./logger";
import { DefaultStorages } from "./storage";

function now(): number {
  return performance.now();
}

function periodic(task: Consumer<void>): PeriodicTask {
  let id = -1;
  const start = (periodMs: number) => id = window.setInterval(task, periodMs);
  const stop = () => window.clearInterval(id);
  const dispose = async () => stop();
  return { start, stop, dispose }
}

function delayed(task: Consumer<void>, delayMs?: number): DelayedTask {
  const id = window.setTimeout(task, delayMs);
  const cancel = () => window.clearTimeout(id);
  const dispose = async () => cancel();
  return { cancel, dispose };
}

function onFrame(task: Consumer<number>): FrameTask {
  let lastTime = now();
  let taskId = 0;
  let minDtMsImpl = 0;
  let errorConsumer: Consumer<Error> = undefined;
  const taskImpl = () => {
    const dt = now() - lastTime;
    if (minDtMsImpl <= dt) {
      lastTime = now();
      try {
        task(dt);
      } catch (e) {
        errorConsumer(e);
      }
    }
    taskId = requestAnimationFrame(taskImpl);
  }
  const stop = () => cancelAnimationFrame(taskId);
  const start = (minDtMs = 0) => { minDtMsImpl = minDtMs; stop(); taskImpl() };
  const dispose = async () => stop();
  const onError = (c: Consumer<Error>) => errorConsumer = c;
  return { start, stop, dispose, onError };
}

function microtask(task: Consumer<void>) {
  window.queueMicrotask(task);
}

function batchRunner(batch: Consumer<void>[], maxTimeMs = 10): BatchTask {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  let finished = false;
  let paused = false;
  let timerId: number;
  let taskInBatch = 0;
  const execBatch = () => {
    if (finished || paused) return;
    const start = now();
    while (taskInBatch < batch.length) {
      const task = batch[taskInBatch++];
      try {
        task();
      } catch (e) {
        reject(e);
        finished = true;
        return;
      }
      const dt = now() - start;
      if (dt >= maxTimeMs) {
        timerId = window.setTimeout(execBatch);
        return;
      }
    }
    finished = true;
    resolve();
  }
  const schedule = () => { timerId = window.setTimeout(execBatch) }
  const stop = async () => {
    if (timerId !== undefined) window.clearTimeout(timerId);
    finished = true;
    resolve();
  }
  const pause = () => {
    if (paused) return;
    paused = true;
    if (timerId !== undefined) window.clearTimeout(timerId);
  }
  const unpause = () => {
    if (!paused) return;
    paused = false;
    schedule();
  }

  schedule();
  return { end: () => promise, stop, pause, unpause, dispose: stop };
}

function createTimer(logger: Logger): Timer {
  return {
    now,
    periodic,
    delayed,
    onFrame,
    microtask,
    batchRunner,
  }
}

export function DefaultApp(appName: string): App {
  const logger = DefaultLogger();
  const timer = createTimer(logger);
  const storages = DefaultStorages(appName);
  const scheduler = DefaultScheduler(requestAnimationFrame, timer.now, err => logger.log('ERROR', err));
  return { logger, timer, storages, scheduler };
}