import { Mat4Array, Vec4Array } from "../../../../libs_js/glmatrix";
import { Deck } from "../../../../utils/collections";
import { Buffer } from "../../../../utils/gl/buffergl";
import { Texture } from "../../../../utils/gl/drawstruct";
import { DrawCall, State } from "../../../../utils/gl/stategl";
import { Builder } from "../../../apis/builder";
import { DrawCallConsumer } from "../../../apis/renderable";
import { BuildBuffer, GenericBuildBuffer } from "../../gl/buffers";

export interface StateSetup {
  createDrawCall(kind: number): DrawCall;
}

export class GenericBufferSetup implements StateSetup {
  protected values = new Deck<any>();
  protected buff: Buffer;
  protected offset: number;
  protected size: number;
  protected mode: number;
  protected shaderIdx: number;
  protected aIndexIdx: number;
  protected aPosIdx: number;

  constructor(state: State) {
    this.shaderIdx = this.register('shader', state);
    this.aIndexIdx = this.register('aIndex', state);
    this.aPosIdx = this.register('aPos', state);
  }

  protected register(name: string, state: State): number {
    this.values.push(state.getState(name));
    const valueIdx = this.values.length();
    this.values.push(null);
    return valueIdx;
  }

  createDrawCall(kind: number): DrawCall {
    const hint = hash(this.values[this.shaderIdx], this.buff, this.textureHint(), this.offset);
    return new DrawCall([...this.values], this.buff, this.offset, this.size, this.mode, hint, kind);
  }


  textureHint() { return null }
  public shader(shader: string) { this.values.set(this.shaderIdx, shader); return this }
  public drawMode(mode: number) { this.mode = mode; return this }

  public buffer(buffer: GenericBuildBuffer) {
    this.values.set(this.aIndexIdx, buffer.getIdxBuffer());
    this.values.set(this.aPosIdx, buffer.getPosBuffer());
    const pointer = buffer.get();
    this.buff = pointer.buffer;
    this.offset = pointer.idx.offset;
    this.size = buffer.getSize();
    return this;
  }
}

export class BufferSetup extends GenericBufferSetup {
  protected aNormIdx: number;
  protected aTcps: number;

  constructor(state: State) {
    super(state);
    this.aNormIdx = this.register('aNorm', state);
    this.aTcps = this.register('aTcps', state);
  }

  public buffer(buffer: BuildBuffer) {
    super.buffer(buffer);
    this.values.set(this.aNormIdx, buffer.getNormBuffer())
    this.values.set(this.aTcps, buffer.getTexCoordBuffer())
    return this;
  }
}

export class SolidSetup extends BufferSetup {
  protected baseIdx: number;
  protected colorIdx: number;

  constructor(state: State) {
    super(state);
    this.baseIdx = this.register('base', state);
    this.colorIdx = this.register('color', state);
  }

  public base(tex: Texture) { this.values.set(this.baseIdx, tex); return this }
  public color(color: Vec4Array) { this.values.set(this.colorIdx, color); return this }
  textureHint() { return this.values.get(this.baseIdx) }
}

export class GridSetup extends BufferSetup {
  protected GTIdx: number;
  protected gridIdx: number;

  constructor(state: State) {
    super(state);
    this.GTIdx = this.register('GT', state);
    this.gridIdx = this.register('grid', state);
  }

  public grid(grid: Mat4Array) { this.values.set(this.GTIdx, grid); return this }
  public gridSettings(settings: Vec4Array) { this.values.set(this.gridIdx, settings); return this }
}

export class WireframeSetup extends BufferSetup {
  protected colorIdx: number;

  constructor(state: State) {
    super(state);
    this.colorIdx = this.register('color', state);
  }

  public color(color: Vec4Array) { this.values.set(this.colorIdx, color); return this }
}

export class PointSpriteSetup extends BufferSetup {
  protected baseIdx: number;
  protected colorIdx: number;

  constructor(state: State) {
    super(state);
    this.baseIdx = this.register('base', state);
    this.colorIdx = this.register('color', state);
  }

  public base(tex: Texture) { this.values.set(this.baseIdx, tex); return this }
  public color(color: Vec4Array) { this.values.set(this.colorIdx, color); return this }
  textureHint() { return this.values.get(this.baseIdx) }
}

export abstract class BufferRenderable<T extends BufferSetup> implements Builder {
  declare abstract readonly buff: BuildBuffer;
  public mode: number = WebGLRenderingContext.TRIANGLES;
  private cachedDrawCall: DrawCall;
  public kind = 0;

  constructor(private setup: T) { }

  drawCall(consumer: DrawCallConsumer): void {
    if (this.buff.getSize() == 0) return;
    if (this.cachedDrawCall == null) {
      this.setup.buffer(this.buff).drawMode(this.mode);
      this.applySetup(this.setup);
      this.cachedDrawCall = this.setup.createDrawCall(this.kind);
    }
    consumer(this.cachedDrawCall);
  }

  public needToRebuild() { this.cachedDrawCall = null }
  public knd(kind: number) { this.kind = kind; return this }

  abstract applySetup(setup: T): void;
  abstract reset(): void;
  protected abstract textureHint(): Texture;

  public get() { return this }
}

const textureMap = new Map<Texture, number>();
const bufferMap = new Map<Buffer, number>();
const shaderMap = new Map<String, number>();

function getId<T>(map: Map<T, number>, value: T) {
  let t = map.get(value);
  if (t == undefined) {
    t = map.size;
    map.set(value, t);
  }
  return t;
}

export function hash(sh: String, buff: Buffer, tex: Texture, offset: number) {
  const shader = getId(shaderMap, sh);
  const texture = getId(textureMap, tex);
  const buffer = getId(bufferMap, buff);
  return offset + (texture << 16) + (buffer << 24) + (shader << 28);
}
