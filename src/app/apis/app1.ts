import Optional from "optional-js";

// General
export type Handle = { remove: () => void };


// Logger
export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'TRACE' | 'DEBUG';
export type LogHandler = (level: LogLevel, ...msg: any[]) => void;

export interface Logger {
  log(level: LogLevel, ...msg: any[]): void;
  addHandler(handler: LogHandler): Handle;
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
  stop(): void,
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