import { Mat4Array, Vec4Array } from "../../../../libs_js/glmatrix";
import { Deck } from "../../../../utils/collections";
import { Buffer } from "../../../../utils/gl/buffergl";
import { Texture } from "../../../../utils/gl/drawstruct";
import { DrawCall, State } from "../../../../utils/gl/stategl";
import { Builder } from "../../../apis/builder";
import { HintRenderable, RenderableConsumer } from "../../../apis/renderable";
import { BuildBuffer, GenericBuildBuffer } from "../../gl/buffers";

export interface StateSetup {
  createDrawCall(): DrawCall;
}

export class GenericBufferSetup implements StateSetup {
  protected values = new Deck<any>();
  protected buff: Buffer;
  protected offset: number;
  protected size: number;
  protected mode: number;

  constructor(state: State) {
    this.register('shader', state);
    this.register('aIndex', state);
    this.register('aPos', state);
  }

  protected register(name: string, state: State) {
    this.values.push(state.getState(name));
    this.values.push(null);
  }

  createDrawCall(): DrawCall {
    return new DrawCall([...this.values], this.buff, this.offset, this.size, this.mode);
  }

  public shader(shader: string) { this.values.set(1, shader); return this }
  public drawMode(mode: number) { this.mode = mode; return this }

  public buffer(buffer: GenericBuildBuffer) {
    this.values.set(3, buffer.getIdxBuffer());
    this.values.set(5, buffer.getPosBuffer());
    const pointer = buffer.get();
    this.buff = pointer.buffer;
    this.offset = pointer.idx.offset;
    this.size = buffer.getSize();
    return this;
  }
}

export class BufferSetup extends GenericBufferSetup {
  constructor(state: State) {
    super(state);
    this.register('aNorm', state);
    this.register('aTcps', state);
  }

  public buffer(buffer: BuildBuffer) {
    super.buffer(buffer);
    this.values.set(7, buffer.getNormBuffer())
    this.values.set(9, buffer.getTexCoordBuffer())
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
    // this.register('GT', state);
  }

  // public grid(grid: Mat4Array) { this.values.set(11, grid); return this }
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

export abstract class BufferRenderable<T extends BufferSetup> implements Builder, HintRenderable {
  abstract readonly buff: BuildBuffer;
  public mode: number = WebGLRenderingContext.TRIANGLES;
  protected drawCall: DrawCall;
  public hint: number;
  public kind = 0;

  constructor(private getSetup: (state: State) => T) { }

  draw(gl: WebGLRenderingContext, state: State): void {
    if (this.buff.getSize() == 0) return;
    if (this.drawCall == null) {
      const setup = this.getSetup(state);
      setup.buffer(this.buff).drawMode(this.mode);
      this.setup(setup);
      this.drawCall = setup.createDrawCall();
      this.hint = hash(this.drawCall.values[1], this.buff.get().buffer, this.textureHint(), this.buff.get().idx.offset);
    }
    state.run(gl, this.drawCall);
  }

  public needToRebuild() { this.drawCall = null }
  public knd(kind: number) { this.kind = kind; return this }

  abstract setup(setup: T): void;
  abstract reset(): void;
  protected abstract textureHint(): Texture;

  public get() { return this }
  public accept(consumer: RenderableConsumer<HintRenderable>) { if (this.buff.getSize() != 0) consumer(this) }
}

export function lazySingletonTransformer<I, O>(trans: (i: I) => O) {
  let instance: O = null;
  return (i: I) => {
    if (instance == null) instance = trans(i);
    return instance;
  }
}

export const SOLID_SETUP = lazySingletonTransformer((state: State) => new SolidSetup(state));
export const GRID_SETUP = lazySingletonTransformer((state: State) => new GridSetup(state));
export const POINT_SPRITE_SETUP = lazySingletonTransformer((state: State) => new PointSpriteSetup(state));
export const WIREFRAME_SETUP = lazySingletonTransformer((state: State) => new WireframeSetup(state));

const textureMap = new Map<Texture, number>();
const bufferMap = new Map<Buffer, number>();
const shaderMap = new Map<String, number>();
export function hash(sh: String, buff: Buffer, tex: Texture, offset: number) {
  let shader = shaderMap.get(sh);
  if (shader == undefined) {
    shader = shaderMap.size;
    shaderMap.set(sh, shader);
  }
  let texture = textureMap.get(tex);
  if (texture == undefined) {
    texture = textureMap.size;
    textureMap.set(tex, texture);
  }
  let buffer = bufferMap.get(buff);
  if (buffer == undefined) {
    buffer = bufferMap.size;
    bufferMap.set(buff, buffer);
  }
  return offset + (texture << 16) + (buffer << 24) + (shader << 28);
}
