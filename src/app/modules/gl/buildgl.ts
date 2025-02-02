import { Disposable } from '@utils/callbacks';
import { BoardContext, EngineContext } from 'app/apis/engine';
import { mat4, vec3, vec4 } from 'gl-matrix';
import { createShader } from '../../../utils/gl/shaders';
import { State } from '../../../utils/gl/stategl';
import { Renderable } from '../../apis/renderable';
import { createRenderablesCache, RenderablesCache } from './geometry/cache';
import { BuildersFactory, createBuildersFactory } from './geometry/common';
import { createEngineTextures, EngineTextures } from './gl-context';
import { GlContext } from '@utils/gl/drawstruct';

export class BuildGlEngineContext implements Disposable {
  private textures_: EngineTextures;
  private bgl_: Promise<BuildGl>;
  private builders_: Promise<BuildersFactory>;
  private toDispose = new Set<Disposable>();

  constructor(
    readonly engine: EngineContext,
    readonly glContext: GlContext
  ) { }

  private addToDispose<T extends Disposable>(value: T): T {
    this.toDispose.add(value);
    return value;
  }

  textures(): EngineTextures {
    if (this.textures_) return this.textures_;
    this.textures_ = this.addToDispose(createEngineTextures(this.engine, this.glContext));
    return this.textures_;
  }

  bgl(): Promise<BuildGl> {
    if (this.bgl_) return this.bgl_;
    this.bgl_ = createBuildGl(this.engine, this.textures(), this.glContext);
    return this.bgl_;
  }

  builders(): Promise<BuildersFactory> {
    if (this.builders_) return this.builders_;
    this.builders_ = this.bgl().then(bgl => createBuildersFactory(bgl, this.glContext)).then(t => this.addToDispose(t));
    return this.builders_;
  }

  async cache(ctx: BoardContext): Promise<RenderablesCache> {
    return Promise.all([this.textures(), this.builders(), this.engine.spriteVoxelSwap])
      .then(([textures, builders, voxels]) => createRenderablesCache(ctx, textures, builders, this.engine.settings, voxels)).then(t => this.addToDispose(t));
  }

  async dispose() {
    await Promise.all(this.toDispose.values().map(d => d.dispose()));
  }
}

export async function createBuildGl(engine: EngineContext<any>, textures: EngineTextures, glCtx: GlContext): Promise<BuildGl> {
  const palswaps = engine.maxPluId.get() + 1;
  const shadowsteps = engine.shadowsteps.get();
  const defs = ['PALSWAPS (' + palswaps + '.0)', 'SHADOWSTEPS (' + shadowsteps + '.0)', 'PAL_LIGHTING'];
  const SHADER_NAME = 'resources/shaders/build';
  const state = new State()
  const { gl } = glCtx;
  state.registerShader('baseShader', await createShader(glCtx, SHADER_NAME, [...defs]));
  state.registerShader('baseNonrepeatShader', await createShader(glCtx, SHADER_NAME, [...defs, 'NONREPEAT', 'ADD_DEPTH']));
  state.registerShader('spriteShader', await createShader(glCtx, SHADER_NAME, [...defs, 'SPRITE', 'ADD_DEPTH']));
  state.registerShader('baseFlatShader', await createShader(glCtx, SHADER_NAME, [...defs, 'FLAT']));
  state.registerShader('spriteFlatShader', await createShader(glCtx, SHADER_NAME, [...defs, 'SPRITE', 'FLAT']));
  state.registerShader('parallax', await createShader(glCtx, SHADER_NAME, [...defs, 'PARALLAX']));
  state.registerShader('grid', await createShader(glCtx, SHADER_NAME, [...defs, 'GRID']));
  state.registerShader('spriteFaceShader', await createShader(glCtx, SHADER_NAME, [...defs, 'SPRITE_FACE']));
  state.registerShader('voxelShader', await createShader(glCtx, SHADER_NAME, [...defs, 'VOXEL']));
  state.setTexture('pal', textures.pal.get());
  state.setTexture('plu', textures.plu.get());
  if (state.isTextureEnabled('trans')) state.setTexture('trans', textures.trans.get());
  return new BuildGl(state, gl);
}

const inv = mat4.create();
const pos = vec3.create();
const clipPlane = vec4.create();

export class BuildGl {
  constructor(
    readonly state: State,
    readonly gl: WebGL2RenderingContext,
    private visibility = 512,
    private shadowOffset = 0,
  ) {
  }

  public setProjectionMatrix(proj: mat4) { this.state.setUniform('P', proj) }
  public setPosition(pos: vec3) { this.state.setUniform('eyepos', pos) }

  public setViewMatrix(view: mat4) {
    this.state.setUniform('V', view);
    if (this.state.isUniformEnabled('IV')) this.state.setUniform('IV', mat4.invert(inv, view));
  }

  public setCursorPosiotion(x: number, y: number, z: number) {
    vec3.set(pos, x, y, z);
    this.state.setUniform('curpos', pos);
  }

  public setClipPlane(x: number, y: number, z: number, w: number) {
    vec4.set(clipPlane, x, y, z, w);
    this.state.setUniform('clipPlane', clipPlane);
  }

  public draw(renderable: Renderable) {
    if (renderable == null) return;
    renderable.drawCall(dc => this.state.run(this.gl, dc));
  }

  public newFrame(width: number, height: number) {
    this.state.start();
    this.gl.viewport(0, 0, width, height);
    this.gl.clearColor(0.2, 0.2, 0.2, 1.0);
    this.gl.clearStencil(0);
    this.gl.clearDepth(1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT | this.gl.STENCIL_BUFFER_BIT);
    this.state.setUniform('sys', [performance.now(), width, height, this.visibility]);
    this.state.setUniform('sys1', [this.shadowOffset, 0, 0, 0]);
    this.modulation(1, 1, 1, 1);
  }

  public setVisibility(vis: number) {
    this.visibility = vis;
  }

  public setShadowOffset(off: number) {
    this.shadowOffset = off;
  }


  public modulation(r: number, g: number, b: number, a: number) {
    if (this.state.isUniformEnabled('modulation'))
      this.state.setUniform('modulation', [r, g, b, a]);
  }

  public flush() {
    this.state.flush(this.gl);
  }
}
