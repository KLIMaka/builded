import { Board } from "../../build/board/structs";
import { Entity } from "../../build/hitscan";
import { Message, MessageHandler } from "../apis/handler";
import { Renderable } from "../apis/renderable";

export class NamedMessage implements Message { constructor(public name: string) { } }
export class LoadBoard implements Message { constructor(public board: Board) { } }
export class StartMove implements Message { }
export class Move implements Message { constructor(public dx: number, public dy: number, public dz: number) { } }
export class EndMove implements Message { }
export class Rotate implements Message { constructor(public da: number, public absolute = false) { } };
export class Highlight implements Message { constructor(public set: Set<number> = new Set()) { } }
export class Render implements Message { constructor(public consumer: (r: Renderable) => void) { } }
export class SetPicnum implements Message { constructor(public picnum: number) { } }
export class Shade implements Message { constructor(public value: number, public absolute = false) { } }
export class PanRepeat implements Message { constructor(public xpan: number, public ypan: number, public xrepeat: number, public yrepeat: number, public absolute = false) { } }
export class ResetPanRepeat implements Message { }
export class Palette implements Message { constructor(public value: number, public max: number, public absolute = false) { } }
export class Flip implements Message { constructor() { } }
export class SpriteMode implements Message { }
export class Frame implements Message { constructor(public dt: number) { } }
export class BoardInvalidate implements Message { constructor(public ent: Entity) { } }
export class PreFrame implements Message { }
export class PostFrame implements Message { }
export class Mouse implements Message { constructor(public x: number, public y: number) { } }
export class Key implements Message { constructor(public key: string, public down: boolean) { } }
export class SetWallCstat implements Message { constructor(public name: string, public value = false, public toggle = true) { } }
export class SetSectorCstat implements Message { constructor(public name: string, public value = false, public toggle = true) { } }
export class SetSpriteCstat implements Message { constructor(public name: string, public value = false, public toggle = true) { } }
export class Commit implements Message { constructor(public tag: string, public merge = false) { } };

export const INVALIDATE_ALL = new BoardInvalidate(null);

export function namedMessageHandler(name: string, handler: () => void): MessageHandler {
  return { handle: (msg: Message) => { if (msg instanceof NamedMessage && msg.name == name) handler() } }
}