import { NOOP_TASK_HANDLE, Task, TaskHandle } from "ts-utils/scheduler";
import { Fn, MultiFn, Supplier } from "ts-utils/types";

export function taskHandleContext<T, Input extends any[] = []>(factory: Fn<Supplier<TaskHandle>, MultiFn<Input, Promise<T>>>): Task<T, Input> {
  let handle = NOOP_TASK_HANDLE;
  const fn = factory(() => handle);
  return async (h, ...args) => {
    handle = h;
    const result = fn(...args);
    handle = NOOP_TASK_HANDLE;
    return result;
  }
}