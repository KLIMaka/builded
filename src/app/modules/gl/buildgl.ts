import * as GLM from '../../../libs_js/glmatrix';
import { Texture } from '../../../utils/gl/drawstruct';
import { createShader } from '../../../utils/gl/shaders';
import { State } from '../../../utils/gl/stategl';
import { Dependency, Injector } from '../../../utils/injector';
import { BuildContext } from '../../apis/app';
import { Renderable } from '../../apis/renderable';
import { GL, UtilityTextures_ } from '../buildartprovider';

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
    injector.getInstance(UtilityTextures_),
  ]).then(([gl, pal, plus, plaswaps, shadowsteps, util]) => {
    const buildgl = new BuildGl(plaswaps, shadowsteps, gl, pal, plus, util[-3], () => resolve(buildgl))
  }));
}

const SHADER_NAME = 'resources/shaders/build';
const inv = GLM.mat4.create();
const pos = GLM.vec3.create();
const clipPlane = GLM.vec4.create();

export class BuildGl {
  private state = new State();

  constructor(palswaps: number, shadowsteps: number, gl: WebGLRenderingContext, pal: Texture, plus: Texture, grid: Texture, cb: () => void) {
    const defs = ['PALSWAPS (' + palswaps + '.0)', 'SHADOWSTEPS (' + shadowsteps + '.0)']
    Promise.all([
      createShader(gl, SHADER_NAME, [...defs, 'PAL_LIGHTING']).then(shader => this.state.registerShader('baseShader', shader)),
      createShader(gl, SHADER_NAME, [...defs, 'SPRITE', 'PAL_LIGHTING']).then(shader => this.state.registerShader('spriteShader', shader)),
      createShader(gl, SHADER_NAME, [...defs, 'FLAT']).then(shader => this.state.registerShader('baseFlatShader', shader)),
      createShader(gl, SHADER_NAME, [...defs, 'SPRITE', 'FLAT']).then(shader => this.state.registerShader('spriteFlatShader', shader)),
      createShader(gl, SHADER_NAME, [...defs, 'PARALLAX']).then(shader => this.state.registerShader('parallax', shader)),
      createShader(gl, SHADER_NAME, [...defs, 'GRID']).then(shader => this.state.registerShader('grid', shader)),
      createShader(gl, SHADER_NAME, [...defs, 'SPRITE_FACE']).then(shader => this.state.registerShader('spriteFaceShader', shader))
    ]).then(r => {
      this.state.setTexture('pal', pal);
      this.state.setTexture('plu', plus);
      this.state.setTexture('grid', grid);
      cb()
    });
  }

  public setProjectionMatrix(proj: GLM.Mat4Array) { this.state.setUniform('P', proj) }
  public setPosition(pos: GLM.Vec3Array) { this.state.setUniform('eyepos', pos) }

  public setViewMatrix(view: GLM.Mat4Array) {
    this.state.setUniform('V', view);
    if (this.state.isUniformEnabled('IV')) this.state.setUniform('IV', GLM.mat4.invert(inv, view));
  }

  public setCursorPosiotion(x: number, y: number, z: number) {
    GLM.vec3.set(pos, x, y, z);
    this.state.setUniform('curpos', pos);
  }

  public setClipPlane(x: number, y: number, z: number, w: number) {
    GLM.vec4.set(clipPlane, x, y, z, w);
    this.state.setUniform('clipPlane', clipPlane);
  }

  public draw(ctx: BuildContext, gl: WebGLRenderingContext, renderable: Renderable) {
    if (renderable == null) return;
    renderable.draw(ctx, gl, this.state);
  }

  public newFrame(gl: WebGLRenderingContext) {
    gl.clearColor(0.2, 0.2, 0.2, 1.0);
    gl.clearStencil(0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    this.state.setUniform('sys', [performance.now(), 2 / gl.drawingBufferWidth, 2 / gl.drawingBufferHeight, 0]);
  }

  public flush(gl: WebGLRenderingContext) {
    this.state.flush(gl);
  }
}
