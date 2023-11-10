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
export interface TaskHandle {
  stop(): void;
  getDescription(): string;
  getProgress(): number;
  setDescription(s: string): void;
  setProgress(p: number): void;
}

export type SchedulerTask = AsyncGenerator<boolean, boolean, TaskHandle>;

export interface ScheddulerHandler {
  onTaskAdd(task: TaskHandle): void;
  onTaskStop(task: TaskHandle): void;
  onTaskUpdate(task: TaskHandle): void;
}

export interface Scheduler {
  addTask(task: SchedulerTask): TaskHandle;
  addHandler(handler: ScheddulerHandler): Handle;
  currentTasks(): Iterable<TaskHandle>;
}

// FileSystem
export interface WritableFileSystem {
  delete(name: string): Promise<void>;
  write(name: string, data: ArrayBuffer): Promise<void>;
}

export interface FileSystem {
  get(name: string): Promise<Optional<ArrayBuffer>>
  list(): Promise<string[]>;
  write(): Optional<WritableFileSystem>;
  addHandler(handler: FileSystemHandler): Handle;
}

export interface FileSystems {
  mount(name: string, fs: FileSystem): void;
  list(): string[];
  get(name: string): Optional<FileSystem>;
}

export interface FileSystemHandler {
  onFileChanged(fs: FileSystem, name: string): Promise<void>;
  onFileDeleted(fs: FileSystem, name: String): Promise<void>;
}

export interface App {
  readonly logger: Logger;
  readonly timer: Timer;
  readonly scheduler: Scheduler;
  readonly storages: Storages;
}