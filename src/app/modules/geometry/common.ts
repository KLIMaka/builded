import { mat4, vec4 } from "../../../libs_js/glmatrix";
import { Texture } from "../../../utils/gl/drawstruct";
import { Dependency, Injector, provider } from "../../../utils/injector";
import { GRID, GridController } from "../../apis/app";
import { DrawCallConsumer } from "../../apis/renderable";
import { BUFFER_FACTORY, BuildBuffer } from "../gl/buffers";
import { BUILD_GL } from "../gl/buildgl";
import { BufferRenderable, BufferSetup, GridSetup, PointSpriteSetup, SolidSetup, WireframeSetup } from "./builders/setups";

export interface BuildersFactory {
  solid(hint: string): SolidBuilder;
  grid(hint: string): GridBuilder;
  flat(hint: string): FlatBuilder;
  pointSprite(hint: string): PointSpriteBuilder;
  wireframe(hint: string): WireframeBuilder;
}
export const BUILDERS_FACTORY = new Dependency<BuildersFactory>('Builder Factory');

export const DefaultBuildersFactory = provider(async (injector: Injector) => {
  const bufferFactory = await injector.getInstance(BUFFER_FACTORY);
  const buildgl = await injector.getInstance(BUILD_GL);
  const grid = await injector.getInstance(GRID);

  const solidSetup = () => new SolidSetup(buildgl.state);
  const gridSetup = () => new GridSetup(buildgl.state);
  const bufferSetup = () => new BufferSetup(buildgl.state);
  const pointspriteSetup = () => new PointSpriteSetup(buildgl.state);
  const wireframeSetup = () => new WireframeSetup(buildgl.state);

  return {
    solid: (hint: string) => new SolidBuilder(solidSetup(), bufferFactory.get('solid-' + hint)),
    grid: (hint: string) => new GridBuilder(gridSetup(), grid),
    flat: (hint: string) => new FlatBuilder(bufferSetup()),
    pointSprite: (hint: string) => new PointSpriteBuilder(pointspriteSetup(), bufferFactory.get('pointsprite-' + hint)),
    wireframe: (hint: string) => new WireframeBuilder(wireframeSetup(), bufferFactory.get('wireframe-' + hint))
  }
});

export enum Type {
  SURFACE,
  FACE
}

export class SolidBuilder extends BufferRenderable<SolidSetup> {
  public type: Type = Type.SURFACE;
  public tex: Texture;
  public trans: number = 1;
  public parallax: number = 0;
  private color = vec4.create();

  constructor(setup: SolidSetup, readonly buff: BuildBuffer) { super(setup) }
  protected textureHint() { return this.tex }

  public applySetup(setup: SolidSetup) {
    setup.shader(this.type == Type.SURFACE ? (this.parallax ? 'parallax' : 'baseShader') : 'spriteShader')
      .base(this.tex)
      .color(vec4.set(this.color, 1, 1, 1, this.trans))
  }

  public reset() {
    this.buff.deallocate();
    this.type = Type.SURFACE;
    this.trans = 1;
    vec4.set(this.color, 1, 1, 1, 1);
    this.parallax = 0;
    this.tex = null;
  }
}

export class GridBuilder extends BufferRenderable<GridSetup> {
  public solid: SolidBuilder;
  public gridTexMat = mat4.create();
  public range = 4.0;
  private gridSettings = vec4.create();

  constructor(setup: GridSetup, private grid: GridController) {
    super(setup)
  }

  public get buff() { return this.solid.buff }
  public reset() { mat4.identity(this.gridTexMat) }
  protected textureHint() { return null }

  public applySetup(setup: GridSetup) {
    setup.shader('grid')
      .grid(this.gridTexMat)
      .gridSettings(vec4.set(this.gridSettings, this.grid.getGridSize(), this.range, 0, 0));
  }

  public drawCall(consumer: DrawCallConsumer): void {
    this.needToRebuild();
    super.drawCall(consumer);
  }
}

export class FlatBuilder extends BufferRenderable<BufferSetup> {
  public solid: SolidBuilder;

  constructor(setup: BufferSetup) { super(setup) }

  public get buff() { return this.solid.buff }
  public reset() { }
  protected textureHint() { return null }
  public applySetup(setup: BufferSetup) { setup.shader('baseFlatShader') }

  public drawCall(consumer: DrawCallConsumer): void {
    this.needToRebuild();
    super.drawCall(consumer);
  }
}

export class PointSpriteBuilder extends BufferRenderable<PointSpriteSetup> {
  public tex: Texture;
  public color = vec4.fromValues(1, 1, 1, 1);

  constructor(setup: PointSpriteSetup, readonly buff: BuildBuffer) { super(setup) }

  public applySetup(setup: PointSpriteSetup) {
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

  constructor(setup: WireframeSetup, readonly buff: BuildBuffer) { super(setup) }

  public applySetup(setup: WireframeSetup) {
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