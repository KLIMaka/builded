import { ArtInfo } from "build/formats/art";
import { mat4, vec4 } from "gl-matrix";
import { nextpow2 } from "utils/mathutils";
import { Texture } from "../../../../utils/gl/drawstruct";
import { DrawCallConsumer } from "../../../apis/renderable";
import { BuildBuffer, createBufferFactory } from "../buffers";
import { BuildGl } from "../buildgl";
import { GlContext } from "../gl-context";
import { BufferRenderable, BufferSetup, GridSetup, PointSpriteSetup, SolidSetup, WireframeSetup } from "./builders/setups";
import { match } from "ts-pattern";

export interface BuildersFactory {
  solid(hint: string): SolidBuilder;
  grid(hint: string): GridBuilder;
  flat(hint: string): FlatBuilder;
  pointSprite(hint: string): PointSpriteBuilder;
  wireframe(hint: string): WireframeBuilder;
}

export function createBuildersFactory(buildgl: BuildGl, glContext: GlContext): BuildersFactory {
  const bufferFactory = createBufferFactory(glContext)
  const solidSetup = () => new SolidSetup(buildgl.state);
  const gridSetup = () => new GridSetup(buildgl.state);
  const bufferSetup = () => new BufferSetup(buildgl.state);
  const pointspriteSetup = () => new PointSpriteSetup(buildgl.state);
  const wireframeSetup = () => new WireframeSetup(buildgl.state);

  return {
    solid: (hint: string) => new SolidBuilder(solidSetup(), bufferFactory.get('solid-' + hint)),
    grid: (hint: string) => new GridBuilder(gridSetup()),
    flat: (hint: string) => new FlatBuilder(bufferSetup()),
    pointSprite: (hint: string) => new PointSpriteBuilder(pointspriteSetup(), bufferFactory.get('pointsprite-' + hint)),
    wireframe: (hint: string) => new WireframeBuilder(wireframeSetup(), bufferFactory.get('wireframe-' + hint))
  }
}

export type Type = 'SURFACE' | 'SPRITE' | 'NONREPEAT' | 'VOXEL';

export class SolidBuilder extends BufferRenderable<SolidSetup> {
  public type: Type = 'SURFACE';
  public tex: Texture = null;
  public trans: number = 1;
  public parallax = false;
  public vis = 1;
  public modelMatrix = mat4.create();
  private color = vec4.create();
  private wrap = vec4.fromValues(1, 1, 0, 0);

  constructor(setup: SolidSetup, readonly buff: BuildBuffer) { super(setup) }
  protected textureHint() { return this.tex }

  protected applySetup(setup: SolidSetup) {
    setup.shader(this.selectShader())
      .base(this.tex)
      .color(vec4.set(this.color, 1, 1, 1, this.trans))
      .wrap(this.wrap)
      .vis(this.vis)
      .modelMat(this.modelMatrix);
  }

  texture(tex: Texture, info: ArtInfo) {
    this.tex = tex;
    const wrapy = nextpow2(info.h) / info.h;
    vec4.set(this.wrap, 1, wrapy, 0, 0);
  }

  private selectShader(): string {
    if (this.parallax) return 'parallax';
    return match(this.type)
      .with('SURFACE', () => 'baseShader')
      .with('SPRITE', () => 'spriteShader')
      .with('NONREPEAT', () => 'baseNonrepeatShader')
      .with('VOXEL', () => 'voxelShader')
      .exhaustive()
  }


  reset() {
    this.buff.deallocate();
    this.type = 'SURFACE';
    this.trans = 1;
    vec4.set(this.color, 1, 1, 1, 1);
    this.parallax = false;
    this.tex = null;
    vec4.set(this.wrap, 1, 1, 0, 0);
    this.vis = 1;
    mat4.identity(this.modelMatrix);
  }
}

export class GridBuilder extends BufferRenderable<GridSetup> {
  public solid: SolidBuilder;
  public gridTexMat = mat4.create();
  public range = 4.0;
  private gridSettings = vec4.create();

  public get buff() { return this.solid.buff }
  public reset() { mat4.identity(this.gridTexMat) }
  protected textureHint() { return null }

  protected applySetup(setup: GridSetup) {
    setup.shader('grid')
      .grid(this.gridTexMat)
      .gridSettings(vec4.set(this.gridSettings, 1024, this.range, 0, 0));
  }

  public drawCall(consumer: DrawCallConsumer): void {
    this.needToRebuild();
    super.drawCall(consumer);
  }
}

export class FlatBuilder extends BufferRenderable<BufferSetup> {
  public solid: SolidBuilder;

  public get buff() { return this.solid.buff }
  public reset() { }
  protected textureHint() { return null }
  protected applySetup(setup: BufferSetup) { setup.shader('baseFlatShader') }

  public drawCall(consumer: DrawCallConsumer): void {
    this.needToRebuild();
    super.drawCall(consumer);
  }
}

export class PointSpriteBuilder extends BufferRenderable<PointSpriteSetup> {
  public tex: Texture;
  public color = vec4.fromValues(1, 1, 1, 1);

  constructor(setup: PointSpriteSetup, readonly buff: BuildBuffer) { super(setup) }

  protected applySetup(setup: PointSpriteSetup) {
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
  public type: Type = 'SURFACE';
  public color = vec4.fromValues(1, 1, 1, 1);
  public mode: number = WebGLRenderingContext.LINES;

  constructor(setup: WireframeSetup, readonly buff: BuildBuffer) { super(setup) }

  protected applySetup(setup: WireframeSetup) {
    setup.shader(this.type === 'SURFACE' ? 'baseFlatShader' : 'spriteFlatShader')
      .color(this.color);
  }

  protected textureHint() { return null }
  public clr(r: number, g: number, b: number, a: number) { vec4.set(this.color, r, g, b, a); return this }

  public reset() {
    this.buff.deallocate();
    this.type = 'SURFACE';
    this.mode = WebGLRenderingContext.LINES;
    vec4.set(this.color, 1, 1, 1, 1);
  }
}