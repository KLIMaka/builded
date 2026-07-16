import Optional from "optional-js";
import { Disposable } from "ts-utils/callbacks";
import { Dependency } from "ts-utils/injector";
import { Scheduler } from "ts-utils/scheduler";
import { Consumer } from "ts-utils/types";

// General
export type Disconnector = Consumer<void>;

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

export type DebouncedTask = {
  run(): void;
} & Disposable;

export type FrameTask = {
  start(minDtMs?: number): void;
  stop(): void;
  onError(consumer: Consumer<Error>): void;
} & Disposable;

export type BatchTask = {
  stop(): void;
  pause(): void;
  unpause(): void;
  end(): Promise<void>;
} & Disposable;

export type Timer = {
  now(): number,
  periodic(task: Consumer<void>): PeriodicTask;
  delayed(task: Consumer<void>, delayMs?: number): DelayedTask;
  debounced(task: Consumer<void>, delayMs: number): DebouncedTask;
  onFrame(task: Consumer<number>): FrameTask;
  microtask(task: Consumer<void>): void;
  batchRunner(batch: Consumer<void>[], maxTimeMs?: number): BatchTask;
}

// Storage
export type Storage = Readonly<{
  get<T>(key: string): Promise<Optional<T>>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  getAll<T>(): Promise<T[]>;
}> & Disposable;

export type Storages = (name: string) => Promise<Storage>;

export type App = Readonly<{
  logger: Logger;
  timer: Timer;
  scheduler: Scheduler;
  storages: Storages;
}> & Disposable;

export const APP = new Dependency<App>("App");