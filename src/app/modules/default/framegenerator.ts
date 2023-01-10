import { Dependency, getInstances, Injector, Module, plugin, provider } from "../../../utils/injector";
import { Timer, TIMER } from "../../apis/app";
import { BUS, MessageBus } from "../../apis/handler";
import { Frame, PostFrame, PreFrame } from "../../edit/messages";

export function FramegeneratorModule(module: Module) {
  module.bind(plugin("FrameGenerator"), provider(async injector => {
    const [bus, timer] = await getInstances(injector, BUS, TIMER);
    let time = timer();
    let started = true;
    const frame = () => {
      if (!started) return;
      bus.handle(PREFRAME);
      const now = timer();
      FRAME.dt = now - time;
      time = now;
      bus.handle(FRAME);
      bus.handle(POSTFRAME);
      if (started) requestAnimationFrame(frame);
    };

    const start = () => { started = true; time = timer(); requestAnimationFrame(frame) }
    const stop = () => { started = false }
    start();
  }));
}

export type FrameGenerator = {
  start(): void;
  stop(): void;
}

export const FRAME_GENERATOR = new Dependency<FrameGenerator>("FrameGenerator");

export const DefaultFrameGenerator = (() => {
  let instance: FrameGenerator = null;
  return {
    async start(injector: Injector) {
      const [bus, timer] = await getInstances(injector, BUS, TIMER);
      instance = createFrameGenerator(bus, timer);
      return instance;
    },

    async stop(injector: Injector) {
      instance.stop();
    }
  }
})();

const FRAME = new Frame(0);
const PREFRAME = new PreFrame();
const POSTFRAME = new PostFrame();

function createFrameGenerator(bus: MessageBus, timer: Timer): FrameGenerator {
  let time = timer();
  let started = false;
  const frame = () => {
    if (!started) return;
    bus.handle(PREFRAME);
    const now = timer();
    FRAME.dt = now - time;
    time = now;
    bus.handle(FRAME);
    bus.handle(POSTFRAME);
    if (started) requestAnimationFrame(frame);
  };

  const start = () => { if (started) return; started = true; time = timer(); requestAnimationFrame(frame) }
  const stop = () => { started = false }
  start();
  return { start, stop };
}