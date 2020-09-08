import { mat4, Mat4Array, vec3, Vec3Array, vec4 } from '../../../libs_js/glmatrix';
import { Texture } from '../../../utils/gl/drawstruct';
import { createShader } from '../../../utils/gl/shaders';
import { Profile, State } from '../../../utils/gl/stategl';
import { Dependency, Injector } from '../../../utils/injector';
import { info } from '../../../utils/logger';
import * as PROFILER from '../../../utils/profiler';
import { Renderable } from '../../apis/renderable';
import { GL } from '../buildartprovider';

export const PAL_TEXTURE = new Dependency<Texture>('PAL Texture');
export const PLU_TEXTURE = new Dependency<Texture>('PLU Texture');
export const SHADOWSTEPS = new Dependency<number>('Shadowsteps');
export const PALSWAPS = new Dependency<number>('Palswaps');
export const BUILD_GL = new Dependency<BuildGl>('BuildGL');

export function BuildGlConstructor(injector: Injector): Promise<BuildGl> {
  return new Promise(resolve => Promise.all([
    injector.getInstance(GL),
    injector.getInstance(PAL_TEXTURE),
    injector.getInstance(PLU_TEXTURE),
    injector.getInstance(PALSWAPS),
    injector.getInstance(SHADOWSTEPS),
  ]).then(([gl, pal, plus, plaswaps, shadowsteps]) => {
    const buildgl = new BuildGl(plaswaps, shadowsteps, gl, pal, plus, () => resolve(buildgl))
  }));
}

const SHADER_NAME = 'resources/shaders/build';
const inv = mat4.create();
const pos = vec3.create();
const clipPlane = vec4.create();

export class BuildGl {
  private state = new State();

  constructor(palswaps: number, shadowsteps: number, gl: WebGLRenderingContext, pal: Texture, plus: Texture, cb: () => void) {
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const defs = ['PALSWAPS (' + palswaps + '.0)', 'SHADOWSTEPS (' + shadowsteps + '.0)', 'PAL_LIGHTING'/*, 'DITHERING'*/]
    Promise.all([
      createShader(gl, SHADER_NAME, [...defs]).then(shader => this.state.registerShader('baseShader', shader)),
      createShader(gl, SHADER_NAME, [...defs, 'SPRITE']).then(shader => this.state.registerShader('spriteShader', shader)),
      createShader(gl, SHADER_NAME, [...defs, 'FLAT']).then(shader => this.state.registerShader('baseFlatShader', shader)),
      createShader(gl, SHADER_NAME, [...defs, 'SPRITE', 'FLAT']).then(shader => this.state.registerShader('spriteFlatShader', shader)),
      createShader(gl, SHADER_NAME, [...defs, 'PARALLAX']).then(shader => this.state.registerShader('parallax', shader)),
      createShader(gl, SHADER_NAME, [...defs, 'GRID']).then(shader => this.state.registerShader('grid', shader)),
      createShader(gl, SHADER_NAME, [...defs, 'SPRITE_FACE']).then(shader => this.state.registerShader('spriteFaceShader', shader))
    ]).then(r => {
      this.state.setTexture('pal', pal);
      this.state.setTexture('plu', plus);
      cb()
    });
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

  public draw(gl: WebGLRenderingContext, renderable: Renderable) {
    if (renderable == null) return;
    renderable.draw(gl, this.state);
  }

  public newFrame(gl: WebGLRenderingContext) {
    this.updateProfile(this.state.profile);
    gl.clearColor(0.2, 0.2, 0.2, 1.0);
    gl.clearStencil(0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    this.state.setUniform('sys', [performance.now(), gl.drawingBufferWidth, gl.drawingBufferHeight, 0]);
    this.modulation(1, 1, 1, 1);
  }

  public modulation(r: number, g: number, b: number, a: number) {
    if (this.state.isUniformEnabled('modulation')) this.state.setUniform('modulation', [r, g, b, a]);
  }

  private updateProfile(profile: Profile) {
    const p = PROFILER.get(null);
    p.set('drawsRequested', profile.drawsRequested);
    p.set('drawsMerged', profile.drawsMerged);
    p.set('shaderChanges', profile.shaderChanges);
    p.set('uniformChanges', profile.uniformChanges);
    p.set('textureChanges', profile.textureChanges);
    p.set('bufferChanges', profile.bufferChanges);
    profile.reset();
  }

  public printInfo() {
    info(this.state.profile);
  }

  public flush(gl: WebGLRenderingContext) {
    this.state.flush(gl);
  }
}
