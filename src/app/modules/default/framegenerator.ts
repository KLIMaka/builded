import { Injector, Plugin } from "../../../utils/injector"
import { BUS, MessageBus } from "../../apis/handler";
import { Frame, PostFrame, PreFrame } from "../../edit/messages";

export type FrameGenerator = {
  start(): void;
  stop(): void;
}

export function DefaultFrameGenerator(): Plugin<FrameGenerator> {
  let instance: FrameGenerator = null;
  return {
    async start(injector: Injector) {
      const bus = await injector.getInstance(BUS);
      instance = createFrameGenerator(bus);
      return instance;
    },

    async stop(injector: Injector) {
      instance.stop();
    }
  }
}

const FRAME = new Frame(0);
const PREFRAME = new PreFrame();
const POSTFRAME = new PostFrame();

function createFrameGenerator(bus: MessageBus): FrameGenerator {
  let time = window.performance.now();
  let started = false;
  const frame = () => {
    if (!started) return;
    bus.handle(PREFRAME);
    const now = window.performance.now();
    FRAME.dt = now - time;
    time = now;
    bus.handle(FRAME);
    bus.handle(POSTFRAME);
    if (started) requestAnimationFrame(frame);
  };

  const start = () => { started = true; time = window.performance.now(); requestAnimationFrame(frame) }
  const stop = () => { started = false }
  return { start, stop };
}