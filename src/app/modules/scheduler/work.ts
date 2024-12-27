import { iter } from "@utils/iter";
import { BiConsumer, First, Function, first as first1 } from "@utils/types";
import { TaskHandle } from "app/apis/app1";

export type Work<I extends any[] = [], O = void> = (handle: TaskHandle, ...input: I) => Promise<O>

function work<I extends any[], O>(title: string, task: (...i: I) => Promise<O>): Work<I, O> {
  return async (handle, ...input) => await handle.waitFor(task(...input), title)
}

export function tuple<I extends any[], O>(work: Work<I, O>): Work<I, [O]> {
  return async (handle, ...input) => [await work(handle, ...input)];
}

function pass<I extends any[], O>(work: Work<I, O>): Work<I, [...I, O]> {
  return async (handle, ...input) => [...input, await work(handle, ...input)];
}

function passTuple<I extends any[], O extends any[]>(work: Work<I, O>): Work<I, [...I, ...O]> {
  return async (handle, ...input) => [...input, ...(await work(handle, ...input))];
}

function seq<I extends any[], O>(tasks: Work<any, any>[], defaultInput?: I): Work<I, O> {
  return async (handle, ...input) => {
    let result: any = input.length === 0 ? (defaultInput ?? []) : input;
    handle.plan(tasks.length);
    for (const task of tasks)
      result = await task(handle, ...result);
    return result;
  }
}

function parallel<I extends any[], O extends any[]>(tasks: Work<any, any>[]): Work<I, O> {
  return async (handle, ...input) => {
    handle.plan(tasks.length);
    return Promise.all(tasks.map(t => t(handle, ...input))) as Promise<O>;
  }
}

function mapParallel<Item, I extends any[], O>(items: Iterable<Item>, mapper: Function<Item, Work<I, O>>): Work<I, O[]> {
  return parallel(iter(items).map(mapper).collect())
}

function mapSeq<Item, IO extends any[]>(items: Iterable<Item>, mapper: Function<Item, Work<IO, IO>>): Work<IO, IO> {
  return seq(iter(items).map(mapper).collect())
}

function first<T extends any[]>(work: Work<any, T>): Work<any, First<T>> {
  return async (handle, ...input) => first1(await work(handle, ...input));
}


export class ParallelWorkBuilder<SeqInput extends any[], ParallelInput extends any[] = []> {
  tasks: Work<SeqInput, any>[] = [];

  thread<T>(title: string, task: (...i: SeqInput) => Promise<T>): ParallelWorkBuilder<SeqInput, [...ParallelInput, T]> {
    this.tasks.push(work(title, task));
    return this as any as ParallelWorkBuilder<SeqInput, [...ParallelInput, T]>
  }

  threadWork<T>(work: Work<SeqInput, T>): ParallelWorkBuilder<SeqInput, [...ParallelInput, T]> {
    this.tasks.push(work);
    return this as any as ParallelWorkBuilder<SeqInput, [...ParallelInput, T]>
  }
}

export function begin() {
  return new WorkBuilder();
}

export class WorkBuilder<SeqInput extends any[] = [], ParallelInput extends any[] = [], GlobalInput extends any[] = []> {
  private tasks: Work<any, any>[] = [];

  input<T>() {
    return this as any as WorkBuilder<[T], ParallelInput, [T]>
  }

  multiInput<T extends any[]>() {
    return this as any as WorkBuilder<T, ParallelInput, T>
  }

  append<T>(items: Iterable<T>, appender: BiConsumer<this, T>): this {
    for (const item of items) appender(this, item);
    return this;
  }

  then<T>(title: string, task: (...i: SeqInput) => Promise<T>): WorkBuilder<[T], [], GlobalInput> {
    this.tasks.push(tuple(work(title, task)));
    return this as any as WorkBuilder<[T], [], GlobalInput>
  }

  thenPass<T>(title: string, task: (...i: SeqInput) => Promise<T>): WorkBuilder<[...SeqInput, T], [], GlobalInput> {
    this.tasks.push(pass(work(title, task)));
    return this as any as WorkBuilder<[...SeqInput, T], [], GlobalInput>
  }

  thenWork<T extends any[]>(work: Work<SeqInput, T>): WorkBuilder<T, [], GlobalInput> {
    this.tasks.push(work);
    return this as any as WorkBuilder<T, [], GlobalInput>;
  }

  thenWorkPass<T extends any[]>(work: Work<SeqInput, T>): WorkBuilder<[...SeqInput, ...T], [], GlobalInput> {
    this.tasks.push(passTuple(work));
    return this as any as WorkBuilder<[...SeqInput, ...T], [], GlobalInput>;
  }

  stepSub<T extends any[]>(task: Work<SeqInput, T>): WorkBuilder<T, [], GlobalInput> {
    this.tasks.push(task);
    return this as any as WorkBuilder<T, [], GlobalInput>;
  }

  factory<T>(taskFactory: (builder: WorkBuilder, ...i: SeqInput) => Work<any, T>): WorkBuilder<[T], [], GlobalInput> {
    this.tasks.push(async (handle, ...input) => {
      const work = taskFactory(new WorkBuilder(), ...input as SeqInput);
      return work(handle);
    })
    return this as any as WorkBuilder<[T], [], GlobalInput>
  }

  fork<T extends any[]>(b: Function<ParallelWorkBuilder<SeqInput, []>, ParallelWorkBuilder<SeqInput, T>>): WorkBuilder<T, [], GlobalInput> {
    const w = parallel(b(new ParallelWorkBuilder()).tasks);
    this.tasks.push(w);
    return this as any as WorkBuilder<T, [], GlobalInput>;
  }

  forkPass<T extends any[]>(b: Function<ParallelWorkBuilder<SeqInput, []>, ParallelWorkBuilder<SeqInput, T>>): WorkBuilder<[...SeqInput, T], [], GlobalInput> {
    this.tasks.push(pass(parallel(b(new ParallelWorkBuilder()).tasks)));
    return this as any as WorkBuilder<[...SeqInput, T], [], GlobalInput>;
  }

  forkItems<I, O>(input: Iterable<I>, info: Function<I, string>, task: Function<I, Promise<O>>): WorkBuilder<[O[]], [], GlobalInput> {
    this.tasks.push(tuple(mapParallel(input, i => handle => handle.waitFor(task(i), info(i)))));
    return this as any as WorkBuilder<[O[]], [], GlobalInput>;
  }

  finish(defaultInput?: GlobalInput): Work<GlobalInput, SeqInput> {
    return seq<GlobalInput, SeqInput>(this.tasks, defaultInput);
  }

  finishUntuple(defaultInput?: GlobalInput): Work<GlobalInput, First<SeqInput>> {
    return first(seq<GlobalInput, SeqInput>(this.tasks, defaultInput));
  }
}