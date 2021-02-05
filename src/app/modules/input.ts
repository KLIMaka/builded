import { Binder, loadBinds } from "../../app/input/keymap"
import { messageParser } from "../../app/input/messageparser"
import { GL } from "../../app/modules/buildartprovider"
import { loadString } from "../../utils/getter"
import { getInstances, lifecycle, Module, plugin } from "../../utils/injector"
import { bind, get, InputState, postFrame } from "../../utils/input"
import { STATE } from "../apis/app"
import { BUS, busDisconnector, MessageHandlerReflective } from "../apis/handler"
import { Mouse, PostFrame, PreFrame } from "../edit/messages"

const MOUSE = new Mouse(0, 0);

export function InputModule(module: Module) {
  module.bind(plugin('Input'), lifecycle(async (injector, lifecycle) => {
    const [gl, bus, state] = await getInstances(injector, GL, BUS, STATE);
    const keybinds = await loadString('builded_binds.txt');
    const binder = new Binder();
    loadBinds(keybinds, binder, messageParser);
    bind(<HTMLCanvasElement>gl.canvas);

    lifecycle(bus.connect(new class extends MessageHandlerReflective {
      private mouseMove(input: InputState) {
        if (MOUSE.x == input.mouseX && MOUSE.y == input.mouseY) return;
        MOUSE.x = input.mouseX;
        MOUSE.y = input.mouseY;
        bus.handle(MOUSE);
      }

      PreFrame(msg: PreFrame) {
        const inputState = get()
        this.mouseMove(inputState);
        binder.updateState(inputState, state, 'view3d');
        for (const m of binder.poolEvents(inputState, 'view3d')) bus.handle(m);
      }

      PostFrame(msg: PostFrame) {
        postFrame();
      }
    }), busDisconnector(bus));
  }));
}