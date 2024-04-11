import { Dependency } from "@utils/injector";
import { Consumer } from "@utils/types";
import Optional from "optional-js";

export class TaskInerruptedError extends Error {
  constructor() {
    super('Task Interrupted');
  }
};

// General
export type Disconnector = Consumer<void>;
export class HandleProvider<T> implements Iterable<T> {
  constructor(private handles = new Set<T>) { }
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
export type Callback<T> = (arg: T) => void;
export type EventLoop = (cb: Callback<number>) => void;

export interface TaskHandle {
  wait(): Promise<void>;
  waitFor<T>(promise: Promise<T>): Promise<T>;
}

export interface TaskController {
  pause(): void;
  unpause(): void;
  stop(): Promise<void>;
  end(): Promise<void>;
}

export type Task = (handle: TaskHandle) => Promise<void>;

export interface Scheduler {
  exec(task: Task): TaskController;
}


export interface App {
  readonly logger: Logger;
  readonly timer: Timer;
  readonly scheduler: Scheduler;
  readonly storages: Storages;
}

export const APP = new Dependency<App>("App");