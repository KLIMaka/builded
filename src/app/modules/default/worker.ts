import { Worker } from "app/apis/worker";
import { ValuesContainer } from "ts-utils/callbacks";
import { Plugin, provider } from "ts-utils/injector";

export const DefaultWorkerConstructor: Plugin<Worker> = provider(async injector => {
  const worker = new Worker('worker.js');
  worker.onmessage(e => {

  })
  const call = () => {
    const { promise, reject, resolve } = Promise.withResolvers();

  }
  return { create, root }
});
