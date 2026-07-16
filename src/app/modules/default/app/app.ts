import { iter } from "ts-utils/iter";
import { DefaultScheduler, Scheduler } from "ts-utils/scheduler";
import { Consumer, Fn, nil, notUndefined } from "ts-utils/types";
import { App, BatchTask, Cache, DebouncedTask, DelayedTask, FrameTask, PeriodicTask, Timer } from "../../../apis/app";
import { DefaultLogger } from "./logger";
import { DefaultStorages } from "./storage";
import { Plugin, provider } from "ts-utils/injector";
import { VALUES } from "app/apis/values";

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

function debounced(task: Consumer<void>, delayMs: number): DebouncedTask {
  let timeoutId: number | undefined;
  const runTask = () => {
    task();
    timeoutId = undefined;
  }
  const run = () => {
    if (timeoutId) window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(runTask, delayMs);
  }
  const dispose = async () => {
    if (timeoutId !== undefined) task();
    window.clearTimeout(timeoutId);
  }
  return { run, dispose }
}

function onFrame(task: Consumer<number>): FrameTask {
  let lastTime = now();
  let taskId = 0;
  let minDtMsImpl = 0;
  let errorConsumer: Consumer<any> | undefined = undefined;
  const taskImpl = () => {
    const dt = now() - lastTime;
    if (minDtMsImpl <= dt) {
      lastTime = now();
      try {
        task(dt);
      } catch (e) {
        errorConsumer?.(e);
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

function createTimer(): Timer {
  return {
    now,
    periodic,
    delayed,
    debounced,
    onFrame,
    microtask,
    batchRunner,
  }
}

function createCache(): Cache {
  const map = new Map<string, WeakRef<any>>();
  const get = <T>(name: string) => map.get(name)?.deref() as T | undefined;
  const getOrCreate = (name: string, factory: Fn<string, any>) => {
    const value = map.get(name);
    if (value === undefined || value.deref() === undefined) {
      const nvalue = factory(name);
      map.set(name, new WeakRef(nvalue));
      return nvalue;
    }
    return value;
  }
  const dispose = () => iter(map.values())
    .map(v => v.deref()?.dispose)
    .filter(v => v !== undefined)
    .map(v => notUndefined(v)())
    .await_()
    .then(nil());

  return { get, getOrCreate, dispose }
}

export function DefaultAppConstructor(appName: string): Plugin<App> {
  return provider(async injector => {
    const values = await injector.getInstance(VALUES);
    const logger = DefaultLogger();
    const timer = createTimer();
    const storages = DefaultStorages(appName);
    const schedulerImpl = DefaultScheduler(requestAnimationFrame, timer.now, values.create('scheduler'));
    const scheduler: Scheduler = {
      tasks: schedulerImpl.tasks,
      exec(task, name) {
        const ctl = schedulerImpl.exec(task, name)
        ctl.end().then(r => r.onErr(e => logger.log('ERROR', e)));
        return ctl;
      },
    }
    const cache = createCache();
    const dispose = async () => { };
    return { logger, timer, storages, scheduler, cache, dispose }
  });
}