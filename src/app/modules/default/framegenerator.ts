import { PROFILER } from "utils/profiler";
import { getInstances, Module, plugin, provider } from "../../../utils/injector";
import { TIMER } from "../../apis/app";
import { BUS } from "../../apis/handler";
import { Frame, PostFrame, PreFrame } from "../../edit/messages";

const FRAME = new Frame(0);
const PREFRAME = new PreFrame();
const POSTFRAME = new PostFrame();

export function FramegeneratorModule(module: Module) {
  module.bind(plugin("FrameGenerator"), provider(async injector => {
    const [bus, timer, profiler] = await getInstances(injector, BUS, TIMER, PROFILER);
    let time = timer();
    const frame = () => {
      bus.handle(PREFRAME);
      const now = timer();
      FRAME.dt = now - time;
      time = now;
      profiler.frameStart();
      profiler.frame().timer('Frame').start();
      bus.handle(FRAME);
      bus.handle(POSTFRAME);
      requestAnimationFrame(frame);
    };
    frame();
  }));
}