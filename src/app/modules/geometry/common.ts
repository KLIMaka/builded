import { Mat4Array, vec4 } from "../../../libs_js/glmatrix";
import { Texture } from "../../../utils/gl/drawstruct";
import { State } from "../../../utils/gl/stategl";
import { Dependency, Injector } from "../../../utils/injector";
import { BuildContext } from "../../apis/app";
import { BUFFER_FACTORY, BuildBuffer } from "../gl/buffers";
import { BufferRenderable, GRID, GridSetup, PointSpriteSetup, POINT_SPRITE, SOLID, SolidSetup, WIREFRAME, WireframeSetup } from "./builders/setups";

export interface BuildersFactory {
  solid(hint: string): SolidBuilder;
  grid(hint: string): GridBuilder;
  pointSprite(hint: string): PointSpriteBuilder;
  wireframe(hint: string): WireframeBuilder;
}
export const BUILDERS_FACTORY = new Dependency<BuildersFactory>('Builder Factory');

export async function DefaultBuildersFactory(injector: Injector) {
  const bufferFactory = await injector.getInstance(BUFFER_FACTORY);
  return {
    solid: (hint: string) => new SolidBuilder(bufferFactory.get('solid-' + hint)),
    grid: (hint: string) => new GridBuilder(),
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

  constructor(readonly buff: BuildBuffer) { super(SOLID) }
  protected textureHint() { return this.tex }

  public setup(ctx: BuildContext, setup: SolidSetup) {
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
  public gridTexMatProvider: (scale: number) => Mat4Array;

  constructor() { super(GRID) }

  public get buff() { return this.solid.buff }
  public reset() { }
  protected textureHint() { return null }

  public setup(ctx: BuildContext, setup: GridSetup) {
    setup.shader('grid')
      .grid(this.gridTexMatProvider(ctx.gridScale));
  }

  public draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void {
    this.needToRebuild();
    super.draw(ctx, gl, state);
  }
}

export class PointSpriteBuilder extends BufferRenderable<PointSpriteSetup> {
  public tex: Texture;
  public color = vec4.fromValues(1, 1, 1, 1);

  constructor(readonly buff: BuildBuffer) { super(POINT_SPRITE) }

  public setup(ctx: BuildContext, setup: PointSpriteSetup) {
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

  constructor(readonly buff: BuildBuffer) { super(WIREFRAME) }

  public setup(ctx: BuildContext, setup: WireframeSetup) {
    setup.shader(this.type == Type.SURFACE ? 'baseFlatShader' : 'spriteFlatShader')
      .color(this.color);
  }

  protected textureHint() { return null }

  public reset() {
    this.buff.deallocate();
    this.type = Type.SURFACE;
    this.mode = WebGLRenderingContext.LINES;
    vec4.set(this.color, 1, 1, 1, 1);
  }
}