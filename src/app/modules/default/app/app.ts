import { takeFirst } from "@utils/collections";
import { Consumer } from "@utils/types";
import { App, BatchTaskRunner, DelayedTask, FrameTask, PeriodicTask, Timer } from "../../../apis/app1";
import { DefaultScheduler } from "../../scheduler/scheduler";
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
  const taskImpl = () => {
    const dt = now() - lastTime;
    if (minDtMsImpl <= dt) {
      lastTime = now();
      task(dt);
    }
    taskId = requestAnimationFrame(taskImpl);
  }
  const stop = () => cancelAnimationFrame(taskId);
  const start = (minDtMs = 0) => { minDtMsImpl = minDtMs; stop(); taskImpl() };
  const dispose = async () => stop();
  return { start, stop, dispose };
}

function microtask(task: Consumer<void>) {
  window.queueMicrotask(task);
}

function batchRunner(maxTimeMs = 10): BatchTaskRunner {
  let timerId: number;
  const tasks = new Set<Consumer<void>>();
  const execBatch = () => {
    if (tasks.size === 0) return;
    const start = now();
    while (tasks.size > 0) {
      const task = takeFirst(tasks).get();
      task();
      tasks.delete(task);
      const dt = now() - start;
      if (dt >= maxTimeMs) {
        timerId = window.setTimeout(execBatch);
        break;
      }
    }
    if (tasks.size === 0) timerId = undefined;
  }
  const run = (task: Consumer<void>) => {
    tasks.add(task);
    if (timerId === undefined) window.setTimeout(execBatch);
    return () => tasks.delete(task);
  }
  const dispose = async () => { if (timerId !== undefined) window.clearTimeout(timerId) }
  return { run, dispose };
}

function createTimer(): Timer {
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
  const timer = createTimer();
  const storages = DefaultStorages(appName);
  const scheduler = DefaultScheduler(requestAnimationFrame);
  return { logger, timer, storages, scheduler };
}