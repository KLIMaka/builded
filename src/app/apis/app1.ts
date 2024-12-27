import { Disposable, Source } from "@utils/callbacks";
import { Dependency } from "@utils/injector";
import { Consumer, Function, Result, Union } from "@utils/types";
import Optional from "optional-js";

// General
export type Disconnector = Consumer<void>;
export class HandleProvider<T> implements Iterable<T> {
  constructor(private handles = new Set<T>()) { }
  add(handle: T): Disconnector { this.handles.add(handle); return () => this.handles.delete(handle) }
  get(): Set<T> { return this.handles }
  [Symbol.iterator](): Iterator<T, any, undefined> { return this.handles[Symbol.iterator](); }
}

// Logger
export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'TRACE' | 'DEBUG';
export type LogHandler = (level: LogLevel, ...msg: any[]) => void;

export interface Logger {
  log(level: LogLevel, ...msg: any[]): void;
  addHandler(handler: LogHandler): Disconnector;
}

// Timer
export type PeriodicTask = {
  start(periodMs: number): void;
  stop(): void;
} & Disposable;

export type DelayedTask = {
  cancel(): void;
} & Disposable;

export type FrameTask = {
  start(minDtMs?: number): void;
  stop(): void;
} & Disposable;

export type BatchTaskRunner = {
  run(task: Consumer<void>): Disconnector
} & Disposable;

export type Timer = {
  now(): number,
  periodic(task: Consumer<void>): PeriodicTask;
  delayed(task: Consumer<void>, delayMs?: number): DelayedTask;
  onFrame(task: Consumer<number>): FrameTask;
  microtask(task: Consumer<void>): void;
  batchRunner(maxTimeMs?: number): BatchTaskRunner;
}

// Storage
export interface Storage extends Disposable {
  get<T>(key: string): Promise<Optional<T>>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  getAll<T>(): Promise<T[]>;
}

export type Storages = (name: string) => Promise<Storage>;

// Scheduler
export class TaskInerruptedError extends Error {
  constructor() {
    super('Task Interrupted');
  }
};

export type EventLoop = Consumer<Consumer<number>>;

export type ProgressInfo = {
  readonly progress: Source<number>;
  readonly info: Source<string>;
}

export interface SubtaskHandle {
  waitFor<T>(promise: Promise<T>, info: string, dp: number): Promise<T>;
}

export interface TaskHandle {
  plan(count: number): void;
  incProgress(inc: number): void;
  wait(info?: string, count?: number): Promise<void>;
  waitFor<T>(promise: Promise<T>, info?: string, count?: number): Promise<T>;
}

export const NOOP_TASK_HANDLE: TaskHandle = {
  plan: (count: number) => { },
  incProgress: (count: number) => { },
  wait: (info?: string, count?: number) => Promise.resolve(),
  waitFor: <T>(promise: Promise<T>, info?: string, count?: number) => promise,
}

export type TaskValue<T> = {
  isDone(): boolean;
  progress(): ProgressInfo;
  result(): Result<T>;
}

export function progress<T>(info: ProgressInfo): TaskValue<T> {
  return { isDone: () => false, result: () => { throw new Error() }, progress: () => info }
}

export function done<T>(result: Result<T>): TaskValue<T> {
  return { isDone: () => true, progress: () => { throw new Error() }, result: () => result }
}

export interface TaskController<T> extends ProgressInfo {
  readonly paused: Source<boolean>;
  readonly task: Source<TaskValue<T>>;

  pause(): void;
  unpause(): void;
  stop(): Promise<void>;
  end(): Promise<Result<T>>;
}

export type Task<T> = (handle: TaskHandle) => Promise<T>;

export interface Scheduler {
  exec<T>(task: Task<T>): TaskController<T>;
}

export interface App {
  readonly logger: Logger;
  readonly timer: Timer;
  readonly scheduler: Scheduler;
  readonly storages: Storages;
}

export const APP = new Dependency<App>("App");