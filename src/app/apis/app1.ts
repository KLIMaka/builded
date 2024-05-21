import { Source } from "@utils/callbacks";
import { Dependency } from "@utils/injector";
import { Consumer, Function } from "@utils/types";
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
export type Timer = () => number;

// Storage
export interface Storage {
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

  percents(percents: number, count?: number): number;
  inc(dp: number): void;
}

export interface TaskHandle {
  wait(info: string, dp: number): Promise<void>;
  waitFor<T>(promise: Promise<T>, info: string, dp: number): Promise<T>;
  waitForParallel<T>(items: T[], mapper: Function<T, Promise<void>>, doneInfo: Function<T, string>, progress?: number): Promise<void>;
}


export type TaskDone<T> = { type: "done", result: T };
export type TaskError = { type: "error", error: Error };
export type TaskResult<T> = TaskDone<T> | TaskError;

export interface TaskController<T> {
  readonly paused: Source<boolean>;
  readonly result: Source<Optional<TaskResult<T>>>;
  readonly info: Source<string>;
  readonly progress: Source<number>;

  pause(): void;
  unpause(): void;
  stop(): Promise<void>;
  end(): Promise<TaskResult<T>>;
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