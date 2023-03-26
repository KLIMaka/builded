import { loadBinds } from "../../input/keymap"
import { messageParser } from "../../input/messageparser"
import { GL } from "../buildartprovider"
import { Deck, forEach } from "../../../utils/collections"
import { loadString } from "../../../utils/getter"
import { getInstances, lifecycle, Module, plugin } from "../../../utils/injector"
import { LOGGER, STATE } from "../../apis/app"
import { BUS, busDisconnector, MessageHandlerReflective } from "../../apis/handler"
import { Key, Mouse, PreFrame } from "../../edit/messages"

const MOUSE = new Mouse(0, 0);

export function InputModule(module: Module) {
  module.bind(plugin('Input'), lifecycle(async (injector, lifecycle) => {
    const [bus, state, logger] = await getInstances(injector, BUS, STATE, LOGGER);
    const keybinds = await loadString('builded_binds.txt');
    const consumer = loadBinds(keybinds, messageParser, logger);
    const kbe = (handler: (key: string) => void) => (e: KeyboardEvent) => { if (e.target != document.body) return true; handler(e.key.toLowerCase()); e.preventDefault(); return false; }
    const keyup = kbe(key => bus.handle(new Key(key, false)));
    const keydown = kbe(key => bus.handle(new Key(key, true)));
    document.addEventListener('keyup', keyup);
    document.addEventListener('keydown', keydown);
    document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); return false; }, { passive: false });
    window.addEventListener('blur', () => consumer.reset(state));

    const queue = new Deck<Key>();

    lifecycle(bus.connect(new class extends MessageHandlerReflective {
      Key(msg: Key) { queue.push(msg) }

      PreFrame(msg: PreFrame) {
        bus.handle(MOUSE);
        forEach(queue, e =>
          forEach(consumer.consume(e, state), m =>
            bus.handle(m)));
        queue.clear();
      }
    }), busDisconnector(bus));
  }));
}