import { BloodBoard } from 'build/blood/structs';
import { Board } from 'build/board/structs';
import { mat4, Mat4Array, vec3, Vec3Array, vec4 } from '../../../libs_js/glmatrix';
import { Shader, Texture } from '../../../utils/gl/drawstruct';
import { createShader } from '../../../utils/gl/shaders';
import { Profile, State } from '../../../utils/gl/stategl';
import { Dependency, getInstances, lifecycle } from '../../../utils/injector';
import { Profiler, PROFILER } from '../../../utils/profiler';
import { BOARD, BoardProvider, Logger, LOGGER } from '../../apis/app';
import { Renderable } from '../../apis/renderable';
import { GL } from '../buildartprovider';

export const PAL_TEXTURE = new Dependency<Texture>('PAL Texture');
export const PLU_TEXTURE = new Dependency<Texture>('PLU Texture');
export const TRANS_TEXTURE = new Dependency<Texture>('Trans Texture');
export const SHADOWSTEPS = new Dependency<number>('Shadowsteps');
export const PALSWAPS = new Dependency<number>('Palswaps');
export const BUILD_GL = new Dependency<BuildGl>('BuildGL');

export const BuildGlConstructor = lifecycle(async (injector, lifecycle) => {
  const [gl, pal, plus, trans, palswaps, shadowsteps, profiler, logger, board] =
    await getInstances(injector, GL, PAL_TEXTURE, PLU_TEXTURE, TRANS_TEXTURE, PALSWAPS, SHADOWSTEPS, PROFILER, LOGGER, BOARD);
  const defs = ['PALSWAPS (' + palswaps + '.0)', 'SHADOWSTEPS (' + shadowsteps + '.0)', 'PAL_LIGHTING'];
  const SHADER_NAME = 'resources/shaders/build';
  const state = new State()
  const shaderCleaner = async (s: Shader) => s.destroy(gl);
  state.registerShader('baseShader', lifecycle(await createShader(gl, SHADER_NAME, [...defs]), shaderCleaner));
  state.registerShader('spriteShader', lifecycle(await createShader(gl, SHADER_NAME, [...defs, 'SPRITE']), shaderCleaner));
  state.registerShader('baseFlatShader', lifecycle(await createShader(gl, SHADER_NAME, [...defs, 'FLAT']), shaderCleaner));
  state.registerShader('spriteFlatShader', lifecycle(await createShader(gl, SHADER_NAME, [...defs, 'SPRITE', 'FLAT']), shaderCleaner));
  state.registerShader('parallax', lifecycle(await createShader(gl, SHADER_NAME, [...defs, 'PARALLAX']), shaderCleaner));
  state.registerShader('grid', lifecycle(await createShader(gl, SHADER_NAME, [...defs, 'GRID']), shaderCleaner));
  state.registerShader('spriteFaceShader', lifecycle(await createShader(gl, SHADER_NAME, [...defs, 'SPRITE_FACE']), shaderCleaner));
  state.setTexture('pal', pal);
  state.setTexture('plu', plus);
  if (state.isTextureEnabled('trans')) state.setTexture('trans', trans);
  return new BuildGl(state, gl, profiler, logger, board);
});

const inv = mat4.create();
const pos = vec3.create();
const clipPlane = vec4.create();

export class BuildGl {
  constructor(
    readonly state: State,
    readonly gl: WebGLRenderingContext,
    private profiler: Profiler,
    private logger: Logger,
    private board: BoardProvider) {
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  public setProjectionMatrix(proj: Mat4Array) { this.state.setUniform('P', proj) }
  public setPosition(pos: Vec3Array) { this.state.setUniform('eyepos', pos) }

  public setViewMatrix(view: Mat4Array) {
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

  public newFrame() {
    this.updateProfile(this.state.profile);
    this.gl.clearColor(0.2, 0.2, 0.2, 1.0);
    this.gl.clearStencil(0);
    this.gl.clearDepth(1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT | this.gl.STENCIL_BUFFER_BIT);
    this.state.setUniform('sys', [performance.now(), this.gl.drawingBufferWidth, this.gl.drawingBufferHeight, (<BloodBoard>this.board()).visibility]);
    this.modulation(1, 1, 1, 1);
  }

  public modulation(r: number, g: number, b: number, a: number) {
    if (this.state.isUniformEnabled('modulation')) this.state.setUniform('modulation', [r, g, b, a]);
  }

  private updateProfile(profile: Profile) {
    const p = this.profiler.frame();
    p.counter('drawsRequested').set(profile.drawsRequested);
    p.counter('drawsMerged').set(profile.drawsMerged);
    p.counter('shaderChanges').set(profile.shaderChanges);
    p.counter('uniformChanges').set(profile.uniformChanges);
    p.counter('textureChanges').set(profile.textureChanges);
    p.counter('bufferChanges').set(profile.bufferChanges);
    profile.reset();
  }

  public printInfo() {
    this.logger('INFO', this.state.profile + '');
  }

  public flush() {
    this.state.flush(this.gl);
  }
}
