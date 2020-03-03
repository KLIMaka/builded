import { mat4, vec4 } from "../../../libs_js/glmatrix";
import { Texture } from "../../../utils/gl/drawstruct";
import { State } from "../../../utils/gl/stategl";
import { Dependency, Injector } from "../../../utils/injector";
import { BUFFER_FACTORY, BuildBuffer } from "../gl/buffers";
import { BufferRenderable, GridSetup, GRID_SETUP, PointSpriteSetup, POINT_SPRITE_SETUP, SolidSetup, SOLID_SETUP, WireframeSetup, WIREFRAME_SETUP, BufferSetup, FLAT_SETUP } from "./builders/setups";

export interface BuildersFactory {
  solid(hint: string): SolidBuilder;
  grid(hint: string): GridBuilder;
  flat(hint: string): FlatBuilder;
  pointSprite(hint: string): PointSpriteBuilder;
  wireframe(hint: string): WireframeBuilder;
}
export const BUILDERS_FACTORY = new Dependency<BuildersFactory>('Builder Factory');

export async function DefaultBuildersFactory(injector: Injector) {
  const bufferFactory = await injector.getInstance(BUFFER_FACTORY);
  return {
    solid: (hint: string) => new SolidBuilder(bufferFactory.get('solid-' + hint)),
    grid: (hint: string) => new GridBuilder(),
    flat: (hint: string) => new FlatBuilder(),
    pointSprite: (hint: string) => new PointSpriteBuilder(bufferFactory.get('pointsprite-' + hint)),
    wireframe: (hint: string) => new WireframeBuilder(bufferFactory.get('wireframe-' + hint))
  }
}

export enum Type {
  SURFACE,
  FACE
}

let color = vec4.create();
export class SolidBuilder extends BufferRenderable<SolidSetup> {
  public type: Type = Type.SURFACE;
  public tex: Texture;
  public trans: number = 1;
  public parallax: number = 0;

  constructor(readonly buff: BuildBuffer) { super(SOLID_SETUP) }
  protected textureHint() { return this.tex }

  public setup(setup: SolidSetup) {
    setup.shader(this.type == Type.SURFACE ? (this.parallax ? 'parallax' : 'baseShader') : 'spriteShader')
      .base(this.tex)
      .color(vec4.set(color, 1, 1, 1, this.trans))
  }

  public reset() {
    this.buff.deallocate();
    this.type = Type.SURFACE;
    this.trans = 1;
    this.parallax = 0;
    this.tex = null;
  }
}

export class GridBuilder extends BufferRenderable<GridSetup> {
  public solid: SolidBuilder;
  public gridTexMat = mat4.create();

  constructor() { super(GRID_SETUP) }

  public get buff() { return this.solid.buff }
  public reset() { mat4.identity(this.gridTexMat) }
  protected textureHint() { return null }

  public setup(setup: GridSetup) {
    setup.shader('grid')
      .grid(this.gridTexMat);
  }

  public draw(gl: WebGLRenderingContext, state: State): void {
    this.needToRebuild();
    super.draw(gl, state);
  }
}

export class FlatBuilder extends BufferRenderable<BufferSetup> {
  public solid: SolidBuilder;

  constructor() { super(FLAT_SETUP) }

  public get buff() { return this.solid.buff }
  public reset() { }
  protected textureHint() { return null }
  public setup(setup: BufferSetup) { setup.shader('baseFlatShader') }

  public draw(gl: WebGLRenderingContext, state: State): void {
    this.needToRebuild();
    super.draw(gl, state);
  }
}

export class PointSpriteBuilder extends BufferRenderable<PointSpriteSetup> {
  public tex: Texture;
  public color = vec4.fromValues(1, 1, 1, 1);

  constructor(readonly buff: BuildBuffer) { super(POINT_SPRITE_SETUP) }

  public setup(setup: PointSpriteSetup) {
    setup.shader('spriteFaceShader')
      .base(this.tex)
      .color(this.color);
  }

  protected textureHint() { return this.tex }

  public reset() {
    this.buff.deallocate();
    this.tex = null;
    vec4.set(this.color, 1, 1, 1, 1);
  }
}

export class WireframeBuilder extends BufferRenderable<WireframeSetup> {
  public type: Type = Type.SURFACE;
  public color = vec4.fromValues(1, 1, 1, 1);
  public mode = WebGLRenderingContext.LINES;

  constructor(readonly buff: BuildBuffer) { super(WIREFRAME_SETUP) }

  public setup(setup: WireframeSetup) {
    setup.shader(this.type == Type.SURFACE ? 'baseFlatShader' : 'spriteFlatShader')
      .color(this.color);
  }

  protected textureHint() { return null }
  public clr(r: number, g: number, b: number, a: number) { vec4.set(this.color, r, g, b, a); return this }

  public reset() {
    this.buff.deallocate();
    this.type = Type.SURFACE;
    this.mode = WebGLRenderingContext.LINES;
    vec4.set(this.color, 1, 1, 1, 1);
  }
}