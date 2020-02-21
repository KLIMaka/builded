import { Mat4Array, Vec4Array } from "../../../../libs_js/glmatrix";
import { Deck } from "../../../../utils/collections";
import { Buffer } from "../../../../utils/gl/buffergl";
import { Texture } from "../../../../utils/gl/drawstruct";
import { DrawCall, State } from "../../../../utils/gl/stategl";
import { BuildContext } from "../../../apis/app";
import { Builder } from "../../../apis/builder";
import { LayeredRenderable, RenderableConsumer } from "../../../apis/renderable";
import { BuildBuffer } from "../../gl/buffers";

export interface StateSetup {
  createDrawCall(): DrawCall;
}

export class BufferSetup implements StateSetup {
  protected values = new Deck<any>();
  protected buff: Buffer;
  protected offset: number;
  protected size: number;
  protected _mode: number;

  constructor(state: State) {
    this.register('shader', state);
    this.register('aIndex', state);
    this.register('aPos', state);
    this.register('aNorm', state);
    this.register('aTcps', state);
  }

  public createDrawCall() {
    return new DrawCall([...this.values], this.buff, this.offset, this.size, this._mode);
  }

  protected register(name: string, state: State) {
    this.values.push(state.getState(name));
    this.values.push(null);
  }

  public shader(shader: string) { this.values.set(1, shader); return this }
  public mode(mode: number) { this._mode = mode; return this }

  public buffer(buffer: BuildBuffer) {
    this.values.set(3, buffer.getIdxBuffer());
    this.values.set(5, buffer.getPosBuffer());
    this.values.set(7, buffer.getNormBuffer());
    this.values.set(9, buffer.getTexCoordBuffer());
    const pointer = buffer.get();
    this.buff = pointer.buffer;
    this.offset = pointer.idx.offset;
    this.size = buffer.getSize();
    return this;
  }
}

export class SolidSetup extends BufferSetup {
  constructor(state: State) {
    super(state);
    this.register('base', state);
    this.register('color', state);
  }

  public base(tex: Texture) { this.values.set(11, tex); return this }
  public color(color: Vec4Array) { this.values.set(13, color); return this }
}

export class GridSetup extends BufferSetup {
  constructor(state: State) {
    super(state);
    this.register('GT', state);
  }

  public grid(grid: Mat4Array) { this.values.set(11, grid); return this }
}

export class WireframeSetup extends BufferSetup {
  constructor(state: State) {
    super(state);
    this.register('color', state);
  }

  public color(color: Vec4Array) { this.values.set(11, color); return this }
}

export class PointSpriteSetup extends BufferSetup {
  constructor(state: State) {
    super(state);
    this.register('base', state);
    this.register('color', state);
  }

  public base(tex: Texture) { this.values.set(11, tex); return this }
  public color(color: Vec4Array) { this.values.set(13, color); return this }
}

export abstract class BufferRenderable<T extends BufferSetup> implements Builder, LayeredRenderable {
  abstract readonly buff: BuildBuffer;
  abstract readonly layer: number;
  public mode: number = WebGLRenderingContext.TRIANGLES;
  protected drawCall: DrawCall;

  constructor(private getSetup: (state: State) => T) { }


  draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void {
    if (this.buff.getSize() == 0) return;
    if (this.drawCall == null) {
      const setup = this.getSetup(state);
      setup.buffer(this.buff).mode(this.mode);
      this.setup(ctx, setup);
      this.drawCall = setup.createDrawCall();
    }
    state.run(gl, this.drawCall);
  }

  abstract setup(ctx: BuildContext, setup: T): void;
  abstract reset(): void;

  public get() { return this }
  public accept(consumer: RenderableConsumer<LayeredRenderable>) { if (this.buff.getSize() != 0) consumer(this) }
}

export function lazySingletonTransformer<I, O>(trans: (i: I) => O) {
  let instance: O = null;
  return (i: I) => {
    if (instance == null) instance = trans(i);
    return instance;
  }
}

export const SOLID = lazySingletonTransformer((state: State) => new SolidSetup(state));
export const GRID = lazySingletonTransformer((state: State) => new GridSetup(state));
export const POINT_SPRITE = lazySingletonTransformer((state: State) => new PointSpriteSetup(state));
export const WIREFRAME = lazySingletonTransformer((state: State) => new WireframeSetup(state));