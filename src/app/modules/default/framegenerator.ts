import { getInstances, Module, plugin, provider } from "../../../utils/injector";
import { TIMER } from "../../apis/app";
import { BUS } from "../../apis/handler";
import { Frame, PostFrame, PreFrame } from "../../edit/messages";

const FRAME = new Frame(0);
const PREFRAME = new PreFrame();
const POSTFRAME = new PostFrame();

export function FramegeneratorModule(module: Module) {
  module.bind(plugin("FrameGenerator"), provider(async injector => {
    const [bus, timer] = await getInstances(injector, BUS, TIMER);
    let time = timer();
    const frame = () => {
      bus.handle(PREFRAME);
      const now = timer();
      FRAME.dt = now - time;
      time = now;
      bus.handle(FRAME);
      bus.handle(POSTFRAME);
      requestAnimationFrame(frame);
    };
    frame();
  }));
}