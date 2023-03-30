import { loadString } from "../../../utils/getter"
import { Dependency, Plugin, getInstances, provider } from "../../../utils/injector"
import { LOGGER } from "../../apis/app"
import { InputConsumer, loadBinds } from "../../input/keymap"
import { messageParser } from "../../input/messageparser"


export interface Input {
  get(ctx: string): InputConsumer;
}
export const INPUT = new Dependency<Input>('Input');


// const MOUSE = new Mouse(0, 0);

export const DefaultInputConstructor: Plugin<Input> = provider(async injector => {
  const [logger] = await getInstances(injector, LOGGER);
  const keybinds = await loadString('builded_binds.txt');
  const consumers = loadBinds(keybinds, messageParser, logger);
  return {
    get: (ctx: string) => consumers.get(ctx)
  }
});

// export function InputModule(module: Module) {
//   module.bind(plugin('Input'), lifecycle(async (injector, lifecycle) => {

    // const kbe = (handler: (key: string) => void) => (e: KeyboardEvent) => {
    //   if (e.target != document.body) return true;
    //   handler(e.key.toLowerCase());
    //   e.preventDefault();
    //   return false;
    // }
    // const keyup = kbe(key => bus.handle(new Key(key, false)));
    // const keydown = kbe(key => bus.handle(new Key(key, true)));
    // document.addEventListener('keyup', keyup);
    // document.addEventListener('keydown', keydown);
    // document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); return false; }, { passive: false });
    // window.addEventListener('blur', () => consumer.reset(state));

//     const queue = new Deck<Key>();

//     lifecycle(bus.connect(new class extends MessageHandlerReflective {
//       Key(msg: Key) { queue.push(msg) }

//       PreFrame(msg: PreFrame) {
//         bus.handle(MOUSE);
//         forEach(queue, e =>
//           forEach(consumer.consume(e, state), m =>
//             bus.handle(m)));
//         queue.clear();
//       }
//     }), busDisconnector(bus));
//   }));
// }