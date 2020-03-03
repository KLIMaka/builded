import { HintRenderable, RenderableConsumer } from "../apis/renderable";
import { Message } from "../apis/handler";
import { Entity } from "../../build/hitscan";
import { Board } from "../../build/structs";

export class NamedMessage implements Message { constructor(public name: string) { } }
export class LoadBoard implements Message { constructor(public board: Board) { } }
export class StartMove implements Message { }
export class Move implements Message { constructor(public dx: number, public dy: number, public dz: number) { } }
export class EndMove implements Message { }
export class Rotate implements Message { constructor(public da: number) { } };
export class Highlight implements Message { constructor(public set: Set<number> = new Set()) { } }
export class Render implements Message { constructor(public consumer: RenderableConsumer<HintRenderable>) { } }
export class SetPicnum implements Message { constructor(public picnum: number) { } }
export class Shade implements Message { constructor(public value: number, public absolute = false) { } }
export class PanRepeat implements Message { constructor(public xpan: number, public ypan: number, public xrepeat: number, public yrepeat: number, public absolute = false) { } }
export class ResetPanRepeat implements Message { }
export class Palette implements Message { constructor(public value: number, public max: number, public absolute = false) { } }
export class Flip implements Message { constructor() { } }
export class SpriteMode implements Message { }
export class Frame implements Message { constructor(public dt: number) { } }
export class BoardInvalidate implements Message { constructor(public ent: Entity) { } }
export class PostFrame implements Message { }
export class Mouse implements Message { constructor(public x: number, public y: number) { } }
export class SetWallCstat implements Message { constructor(public name: string, public value = false, public toggle = true) { } }
export class SetSectorCstat implements Message { constructor(public name: string, public value = false, public toggle = true) { } }
export class SetSpriteCstat implements Message { constructor(public name: string, public value = false, public toggle = true) { } }

export const COMMIT = new NamedMessage('commit');
export const INVALIDATE_ALL = new BoardInvalidate(null);