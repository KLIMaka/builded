import { loadBinds1 } from "../../app/input/keymap"
import { messageParser } from "../../app/input/messageparser"
import { GL } from "../../app/modules/buildartprovider"
import { Deck, forEach } from "../../utils/collections"
import { loadString } from "../../utils/getter"
import { getInstances, lifecycle, Module, plugin } from "../../utils/injector"
import { ACTIVITY, STATE } from "../apis/app"
import { BUS, busDisconnector, Message, MessageHandlerReflective } from "../apis/handler"
import { Key, Mouse, PreFrame } from "../edit/messages"

const MOUSE = new Mouse(0, 0);

function parseKey(key: string): string {
  if (key == ' ') return 'space';
  return key.toLowerCase();
}

export function InputModule(module: Module) {
  module.bind(plugin('Input'), lifecycle(async (injector, lifecycle) => {
    const [gl, bus, state, activity] = await getInstances(injector, GL, BUS, STATE, ACTIVITY);
    const keybinds = await loadString('builded_binds.txt');
    const consumer = loadBinds1(keybinds, messageParser);
    const keyup = (e: KeyboardEvent) => { if (e.target != document.body) return true; bus.handle(new Key(parseKey(e.key), false)); e.preventDefault(); return false; }
    const keydown = (e: KeyboardEvent) => { if (e.target != document.body) return true; bus.handle(new Key(parseKey(e.key), true)); e.preventDefault(); return false; }
    const mousedown = (e: MouseEvent) => bus.handle(new Key(`mouse${e.button}`, true));
    const mousesp = (e: MouseEvent) => bus.handle(new Key(`mouse${e.button}`, false));
    const musemove = (e: MouseEvent) => {
      MOUSE.x = e.offsetX;
      MOUSE.y = e.offsetY;
    }
    const wheel = (e: WheelEvent) => {
      const key = e.deltaY > 0 ? "wheelup" : "wheeldown";
      bus.handle(new Key(key, true));
      bus.handle(new Key(key, false));
    }

    gl.canvas.addEventListener('mousemove', musemove);
    gl.canvas.addEventListener('mouseup', mousesp);
    gl.canvas.addEventListener('mousedown', mousedown);
    gl.canvas.addEventListener('wheel', wheel);
    document.addEventListener('keyup', keyup);
    document.addEventListener('keydown', keydown);

    const queue = new Deck<Key>();

    lifecycle(bus.connect(new class extends MessageHandlerReflective {
      Key(msg: Key) { queue.push(msg) }

      PreFrame(msg: PreFrame) {
        bus.handle(MOUSE);
        forEach(queue, e => forEach(consumer.consume(e, state), m => bus.handle(m)));
        queue.clear();
      }
    }), busDisconnector(bus));
  }));
}