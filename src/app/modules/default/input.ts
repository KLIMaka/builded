import { BUS } from "app/apis/handler"
import { Key } from "app/edit/messages"
import { loadString } from "../../../utils/getter"
import { Dependency, Plugin, getInstances, lifecycle } from "../../../utils/injector"
import { LOGGER, STATE } from "../../apis/app"
import { Input, loadBinds } from "../../input/keymap"
import { messageParser } from "../../input/messageparser"


export const INPUT = new Dependency<Input>('Input');


function addEventListeners(target: HTMLElement, input: Input) {
  const mousedown = (e: MouseEvent) => input.handle(new Key(`mouse${e.button}`, true));
  const mousesp = (e: MouseEvent) => input.handle(new Key(`mouse${e.button}`, false));
  const wheel = (e: WheelEvent) => {
    const key = e.deltaY > 0 ? "wheelup" : "wheeldown";
    input.handle(new Key(key, true));
    input.handle(new Key(key, false));
  }
  const kbe = (handler: (key: string) => void) => (e: KeyboardEvent) => {
    handler(e.key.toLowerCase());
    e.preventDefault();
    return false;
  }
  const keyup = kbe(key => input.handle(new Key(key, false)));
  const keydown = kbe(key => input.handle(new Key(key, true)));
  target.addEventListener('keyup', keyup);
  target.addEventListener('keydown', keydown);
  target.addEventListener('wheel', e => { wheel(e); if (e.ctrlKey) e.preventDefault(); return false; }, { passive: false });
  target.addEventListener('mouseup', mousesp);
  target.addEventListener('mousedown', mousedown);
}

export const DefaultInputConstructor: Plugin<Input> = lifecycle(async (injector, lifecycle) => {
  const [logger, state] = await getInstances(injector, LOGGER, STATE);
  const keybinds = await loadString('builded_binds.txt');
  const input = loadBinds(keybinds, messageParser, logger, state);
  addEventListeners(document.body, input);
  return input;
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
//       Key(msg: Key) { input.handle(msg) }

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