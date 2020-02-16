import { LayeredRenderable, RenderableConsumer } from "../gl/builders/renderable";
import { Message } from "../handlerapi";
import { Entity } from "../hitscan";

export interface Mover { readonly dx: number; readonly dy: number; readonly dz: number; }

export class NamedMessage implements Message { constructor(public name: string) { } }
export class StartMove implements Message { }
export class Move implements Message { constructor(public dx: number, public dy: number, public dz: number) { } }
export class EndMove implements Message { }
export class Highlight implements Message { constructor(public set: Set<number> = new Set()) { } }
export class Render implements Message { constructor(public consumer: RenderableConsumer<LayeredRenderable>) { } }
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