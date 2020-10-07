import { Dependency, Module } from "../../utils/injector"
import { GL } from "../../app/modules/buildartprovider"
import { bind, get, InputState, postFrame } from "../../utils/input"
import { Binder, loadBinds } from "../../app/input/keymap"
import { messageParser } from "../../app/input/messageparser"
import { BUS, MessageHandlerReflective } from "../apis/handler"
import { Mouse, PostFrame } from "../edit/messages"
import { STATE } from "../apis/app"

export const KEYBINDS = new Dependency<string>('KeymapConfig');
const MOUSE = new Mouse(0, 0);

export function InputModule(module: Module) {
  module.execute(async injector => {
    const gl = await injector.getInstance(GL);
    const keybinds = await injector.getInstance(KEYBINDS);
    const bus = await injector.getInstance(BUS);
    const state = await injector.getInstance(STATE);
    const binder = new Binder();
    loadBinds(keybinds, binder, messageParser);
    bind(<HTMLCanvasElement>gl.canvas);

    bus.connect(new class extends MessageHandlerReflective {
      private mouseMove(input: InputState) {
        if (MOUSE.x == input.mouseX && MOUSE.y == input.mouseY) return;
        MOUSE.x = input.mouseX;
        MOUSE.y = input.mouseY;
        bus.handle(MOUSE);
      }

      PostFrame(msg: PostFrame) {
        const inputState = get()
        this.mouseMove(inputState);
        binder.updateState(inputState, state);
        for (const m of binder.poolEvents(inputState)) bus.handle(m);
        postFrame();
      }
    });
  });
}