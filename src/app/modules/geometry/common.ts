import { vec4, Mat4Array } from "../../../libs_js/glmatrix";
import { BufferRenderable, SolidSetup, SOLID, GridSetup, GRID, PointSpriteSetup, POINT_SPRITE, WireframeSetup, WIREFRAME } from "./builders/setups";
import { Texture } from "../../../utils/gl/drawstruct";
import { PARALLAX, BASE, SPRITE, GRID1, SCREEN } from "../../apis/renderable"
import { BuildBuffer, BUFFER_FACTORY } from "../gl/buffers";
import { BuildContext } from "../../apis/app";
import { Injector, Dependency } from "../../../utils/injector";
import { State } from "../../../utils/gl/stategl";

export interface BuildersFactory {
  solid(): SolidBuilder;
  grid(): GridBuilder;
  pointSprite(): PointSpriteBuilder;
  wireframe(): WireframeBuilder;
}
export const BUILDERS_FACTORY = new Dependency<BuildersFactory>('Builder Factory');

export async function DefaultBuildersFactory(injector: Injector) {
  const bufferFactory = await injector.getInstance(BUFFER_FACTORY);
  return {
    solid: () => new SolidBuilder(bufferFactory.get()),
    grid: () => new GridBuilder(),
    pointSprite: () => new PointSpriteBuilder(bufferFactory.get()),
    wireframe: () => new WireframeBuilder(bufferFactory.get())
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
  get hint() { return this.type == Type.SURFACE ? (this.parallax ? PARALLAX : BASE) : SPRITE }

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
  readonly hint = GRID1;
  public solid: SolidBuilder;
  public gridTexMatProvider: (scale: number) => Mat4Array;

  constructor() { super(GRID) }

  public get buff() { return this.solid.buff }
  public reset() { }

  public setup(ctx: BuildContext, setup: GridSetup) {
    setup.shader('grid')
      .grid(this.gridTexMatProvider(ctx.gridScale));
  }

  public draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void {
    super.draw(ctx, gl, state);
    this.drawCall = null;
  }
}

export class PointSpriteBuilder extends BufferRenderable<PointSpriteSetup> {
  readonly hint = SCREEN;
  public tex: Texture;
  public color = vec4.fromValues(1, 1, 1, 1);

  constructor(readonly buff: BuildBuffer) { super(POINT_SPRITE) }

  public setup(ctx: BuildContext, setup: PointSpriteSetup) {
    setup.shader('spriteFaceShader')
      .base(this.tex)
      .color(this.color);
  }

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
  get hint() { return this.type == Type.SURFACE ? BASE : SPRITE }

  public setup(ctx: BuildContext, setup: WireframeSetup) {
    setup.shader(this.type == Type.SURFACE ? 'baseFlatShader' : 'spriteFlatShader')
      .color(this.color);
  }

  public reset() {
    this.buff.deallocate();
    this.type = Type.SURFACE;
    this.mode = WebGLRenderingContext.LINES;
    vec4.set(this.color, 1, 1, 1, 1);
  }
}