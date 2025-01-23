import { WorkplaneContext } from "@ui/commons";
import { Disposable, Value, ValuesContainer } from "@utils/callbacks";
import { Controller3D } from "@utils/camera/controller3d";
import { GlContext, Texture } from "@utils/gl/drawstruct";
import { createShader } from "@utils/gl/shaders";
import { AttribData, BufferAllocator, StateGl1 } from "@utils/gl/stategl1";
import { clamp, HALF_PI, int4ToFloat, PI, rad2deg } from "@utils/mathutils";
import { applyNotNull } from "@utils/objects";
import { Consumer, MultiConsumer } from "@utils/types";
import { ArtInfo } from "build/formats/art";
import { EngineTextures } from "../gl/gl-context";
import { RenderInfo } from "./arteditor-model";
import { mat4 } from "gl-matrix";

export async function createPreviewRenderer(values: ValuesContainer, glCtx: GlContext, textures: EngineTextures, shadowsteps: number, palswaps: number): Promise<PreviewRenderer> {
  const state = new StateGl1(glCtx, s => new BufferAllocator(glCtx, s, 1024, 1024));
  const defs = ['PALSWAPS (' + palswaps + '.0)', 'SHADOWSTEPS (' + shadowsteps + '.0)'];
  state.register('art-preview', await createShader(glCtx, 'resources/shaders/art-preview', defs));
  state.register('art-preview-sprite', await createShader(glCtx, 'resources/shaders/art-preview', [...defs, 'SPRITE', 'ADD_DEPTH']));
  state.register('wall-instance', await createShader(glCtx, 'resources/shaders/wall-instance', [...defs]));
  return new PreviewRenderer(values, glCtx, textures, state, shadowsteps);
}

export class PreviewRenderer implements Disposable {
  private ctl: Controller3D;
  private item: MultiConsumer<[WebGL2RenderingContext, Texture]>;
  private item1: MultiConsumer<[WebGL2RenderingContext, Texture]>;
  private base: Consumer<void>;
  private walls: Consumer<void>;
  private infoValue: Value<RenderInfo>;
  private pluValue: Value<number>;
  private itemValue: Value<AttribData>;
  private itemValue1: Value<AttribData>;

  constructor(
    private values: ValuesContainer,
    private glCtx: GlContext,
    private textures: EngineTextures,
    private stateGl: StateGl1,
    private maxShadow: number,
  ) {
    this.ctl = new Controller3D(values);
    this.infoValue = values.value('info', null);
    this.pluValue = values.value('plu', 0);
    const infoValue = values.field('info.info', this.infoValue, 'info');
    this.itemValue = values.transformedTuple('item', [infoValue, this.pluValue], ([info, plu]) => this.genItem(info, plu), { disposer: data => applyNotNull(data, d => d.bufferData.deallocate()) });
    this.itemValue1 = values.transformedTuple('item1', [infoValue, this.pluValue], ([info, plu]) => this.genItem1(info, plu), { disposer: data => applyNotNull(data, d => d.bufferData.deallocate()) });
    this.item = this.buildItem();
    this.item1 = this.buildItem1();
    this.base = this.buildBase(this.textures.get(0).get());
    this.walls = this.buildWalls(this.textures.get(0).get());

    const itemShader = this.stateGl.getShader('art-preview');
    const spriteShader = this.stateGl.getShader('art-preview-sprite');
    const wallShader = this.stateGl.getShader('wall-instance');
    const matrices = itemShader.uniformBlock('Matrices');
    const P = matrices.writer<[mat4]>('P');
    const V = matrices.writer<[mat4]>('V');
    const IV = matrices.writer<[mat4]>('IV');
    const palSet = itemShader.texture('pal');
    const palSet1 = spriteShader.texture('pal');
    const palSet2 = wallShader.texture('pal');
    const pluSet = itemShader.texture('plu');
    const pluSet1 = spriteShader.texture('plu');
    const pluSet2 = wallShader.texture('plu');
    this.values.handleStandalone([this.ctl.projection], proj => P(proj));
    this.values.handleStandalone([this.ctl.camera.transform], view => { V(view); IV(mat4.invert(mat4.create(), view)) });
    this.values.handleStandalone([this.textures.pal], pal => { palSet(pal); palSet1(pal); palSet2(pal) });
    this.values.handleStandalone([this.textures.plu], plu => { pluSet(plu); pluSet1(plu); pluSet2(plu) });
  }

  private genItem(info: ArtInfo, plu: number): AttribData {
    const shader = this.stateGl.getShader('art-preview');
    const builder = shader.builder();
    const pos = builder.vec3('aPos');
    const tc = builder.vec3('aTc');
    const params = builder.float('aParams');
    const vtx = (x: number, y: number, z: number, tc1: number, tc2: number, tc3 = 1) => {
      pos(x, y, z);
      tc(tc1, tc2, tc3);
      builder.writeVertex();
    }
    const w = info.w;
    const h = info.h;
    const hw = w >> 1;
    const wscale = 1 + (h / 64) * 0.3;

    builder.start();
    params(int4ToFloat(0, plu, 255, 0));
    vtx(-hw, 0, 0, 1, 1);
    vtx(-hw, h, 0, 1, 0);
    vtx(hw, h, 0, 0, 0);
    vtx(hw, 0, 0, 0, 1);
    builder.writeIndex(0, [3, 1, 2, 3, 0, 1]);

    params(int4ToFloat(this.maxShadow / 3, plu, 255, 0));
    vtx(-hw, 0, 0, 1, 1);
    vtx(-hw, h, 0, 1, 0);
    vtx(hw, h, 0, 0, 0);
    vtx(hw, 0, 0, 0, 1);
    builder.writeIndex(4, [1, 0, 3, 2, 1, 3]);

    params(int4ToFloat(this.maxShadow, 0, 128, 0));
    vtx(-hw, 0.1, 0, 1, 1);
    vtx(wscale * -hw, 0.1, h * 0.5, wscale, 0, wscale);
    vtx(wscale * hw, 0.1, h * 0.5, 0, 0, wscale);
    vtx(hw, 0.1, 0, 0, 1);
    builder.writeIndex(8, [3, 1, 2, 3, 0, 1]);

    return builder.build(WebGL2RenderingContext.TRIANGLES);
  }

  private buildItem() {
    const shader = this.stateGl.getShader('art-preview');
    const tex = shader.texture('tex');

    return (gl: WebGL2RenderingContext, pic: Texture) => {
      tex(pic);
      gl.enable(gl.BLEND);
      this.stateGl.draw(shader, this.itemValue.get());
      gl.disable(gl.BLEND);
    }
  }

  private genItem1(info: ArtInfo, plu: number): AttribData {
    const shader = this.stateGl.getShader('art-preview-sprite');
    const builder = shader.builder();
    const pos = builder.vec3('aPos');
    const tc = builder.vec3('aTc');
    const params = builder.float('aParams');
    const vtx = (x: number, y: number, z: number, tc1: number, tc2: number, tc3 = 1) => {
      pos(x, y, z);
      tc(tc1, tc2, tc3);
      builder.writeVertex();
    }
    const w = info.w;
    const h = info.h;
    const hw = w >> 1;
    const wscale = 1 + (h / 64) * 0.3;

    builder.start();
    params(int4ToFloat(0, plu, 255, 1));
    vtx(-hw, 0, 0, 0, 1);
    vtx(-hw, h, 0, 0, 0);
    vtx(hw, h, 0, 1, 0);
    vtx(hw, 0, 0, 1, 1);
    builder.writeIndex(0, [1, 0, 3, 2, 1, 3]);

    params(int4ToFloat(this.maxShadow, 0, 128, 1));
    vtx(-hw, 0, 0, 0, 1);
    vtx(-hw * wscale, 0, h * 0.5, 0, 0, wscale);
    vtx(hw * wscale, 0, h * 0.5, wscale, 0, wscale);
    vtx(hw, 0, 0, 1, 1);
    builder.writeIndex(4, [1, 0, 3, 2, 1, 3]);

    return builder.build(WebGL2RenderingContext.TRIANGLES);
  }

  private buildItem1() {
    const shader = this.stateGl.getShader('art-preview-sprite');
    const tex = shader.texture('tex');

    return (gl: WebGL2RenderingContext, pic: Texture) => {
      tex(pic);
      gl.enable(gl.BLEND);
      this.stateGl.draw(shader, this.itemValue1.get());
      gl.disable(gl.BLEND);
    }
  }

  private buildBase(texture: Texture) {
    const shader = this.stateGl.getShader('art-preview');
    const builder = shader.builder();
    const pos = builder.vec3('aPos');
    const tc = builder.vec3('aTc');
    const params = builder.float('aParams');
    const vtx = (x: number, y: number, z: number, tc1: number, tc2: number, tc3 = 1) => {
      pos(x, y, z);
      tc(tc1, tc2, tc3);
      builder.writeVertex();
    }
    const size = 128;
    const tcScale = 2;
    const w = texture.getWidth() / tcScale;
    const h = texture.getHeight() / tcScale;
    builder.start();
    params(int4ToFloat(0, 0, 255, 0));
    vtx(-size, 0, -size, size / w, size / h);
    vtx(-size, 0, size, size / w, 0);
    vtx(size, 0, size, 0, 0);
    vtx(size, 0, -size, 0, size / h);
    builder.writeIndex(0, [3, 1, 2, 3, 0, 1]);
    const data = builder.build(WebGL2RenderingContext.TRIANGLES);
    const tex = shader.texture('tex');

    return () => {
      tex(texture, 'REPEAT');
      this.stateGl.draw(shader, data);
    }
  }

  private buildWalls(texture: Texture) {
    const shader = this.stateGl.getShader('wall-instance');
    const builder = shader.builder();
    const startEnd = builder.vec4('aStartEnd');
    const firstWall = builder.vec4('aFirstWall');
    const heinumZ = builder.vec4('aHeinumZ');
    const params = builder.float('aPluShadowVisTrans');

    builder.start();
    firstWall(0, 0, 1, 0);
    heinumZ(0, 128, 0, 0);
    params(int4ToFloat(0, 0, 255, 0));

    startEnd(128, -128, -128, -128);
    builder.writeVertex();
    startEnd(-128, -128, -128, 128);
    builder.writeVertex();
    startEnd(-128, 128, 128, 128);
    builder.writeVertex();
    startEnd(128, 128, 128, -128);
    builder.writeVertex();


    heinumZ(0, 256, 0, 0);

    startEnd(-32, -32, 32, -32);
    builder.writeVertex();
    startEnd(32, -32, 32, 32);
    builder.writeVertex();
    startEnd(32, 32, -32, 32);
    builder.writeVertex();
    startEnd(-32, 32, -32, -32);
    builder.writeVertex();
    const data = builder.buildInstanced(WebGL2RenderingContext.TRIANGLES);
    const tex = shader.texture('tex');

    return () => {
      tex(texture, 'REPEAT');
      this.stateGl.drawInstanced(shader, data);
    }
  }


  draw(canvas: HTMLCanvasElement, ctx: Pick<WorkplaneContext, 'scale' | 'xoff1' | 'yoff1' | 'xoff2' | 'yoff2'>, ri: RenderInfo, plu: number, superSample: number, repeat: boolean) {
    const { info, picnum } = ri;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const hw = w / 2;
    const hh = h / 2;
    const scale = 1 / ctx.scale;
    const xoff = -(hw - ctx.xoff1) * scale;
    const yoff = (hh - ctx.yoff1) * scale;

    const r = scale * 400;
    const phi = PI + ctx.xoff2 * 0.01;
    const theta = clamp(ctx.yoff2 / 200, -1, 1) * HALF_PI;
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(theta);
    const z = r * Math.cos(phi) * Math.cos(theta);

    this.ctl.setSize(w, h);
    this.ctl.setPosition(-x, y, z);
    this.ctl.camera.setAngles(-rad2deg(theta), -rad2deg(phi));

    const { gl, offscreen } = this.glCtx;
    offscreen.width = w;
    offscreen.height = h;
    gl.viewport(0, 0, w, h);

    gl.clearColor(0, 0, 0, 1.0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // this.grid();
    this.pluValue.set(plu);
    this.infoValue.set(ri);
    // this.base();
    // this.item(gl, this.textures.get(picnum).get());
    // this.item1(gl, this.textures.get(picnum).get());
    this.walls();

    canvas.getContext('bitmaprenderer')
      .transferFromImageBitmap(offscreen.transferToImageBitmap());
  }

  async dispose(): Promise<void> {
    this.stateGl.dispose();
  }
}