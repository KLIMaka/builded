import { WorkplaneContext } from "@ui/commons";
import { Disposable, ValuesContainer } from "@utils/callbacks";
import { Controller2D } from "@utils/camera/controller2d";
import { Buffer, BufferBuilder } from "@utils/gl/buffergl";
import { Shader } from "@utils/gl/drawstruct";
import { createShader } from "@utils/gl/shaders";
import { State } from "@utils/gl/stategl";
import { vec4 } from "gl-matrix";
import { EngineTextures, GlContext } from "../gl/gl-context";
import { RenderInfo } from "./arteditor-model";

export class PreviewRenderer implements Disposable {
  private ctl: Controller2D;
  private stateGl = new State();
  private buffer: Buffer;
  private shader: Shader;

  constructor(
    values: ValuesContainer,
    private glCtx: GlContext,
    private textures: EngineTextures,
    private shadowsteps: number,
    private palswaps: number,
  ) {
    this.ctl = new Controller2D(values);
  }

  async init() {
    const { gl } = this.glCtx;
    const buffer = new Buffer(gl, new BufferBuilder()
      .addVertexBuffer(gl, gl.FLOAT, 3)
      .addVertexBuffer(gl, gl.FLOAT, 2)
    );
    this.buffer = buffer;

    const ptr = buffer.allocate(4, 6);
    buffer.writeVertex(ptr, 0, 0, [-0.5, 0, -0.5]);
    buffer.writeVertex(ptr, 0, 1, [-0.5, 0, 0.5]);
    buffer.writeVertex(ptr, 0, 2, [0.5, 0, 0.5]);
    buffer.writeVertex(ptr, 0, 3, [0.5, 0, -0.5]);
    buffer.writeVertex(ptr, 1, 0, [0, 0]);
    buffer.writeVertex(ptr, 1, 1, [0, 1]);
    buffer.writeVertex(ptr, 1, 2, [1, 1]);
    buffer.writeVertex(ptr, 1, 3, [1, 0]);
    buffer.writeQuad(ptr, 0, 3, 2, 1, 0);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    const defs = ['PALSWAPS (' + this.palswaps + '.0)', 'SHADOWSTEPS (' + this.shadowsteps + '.0)'];
    this.shader = await createShader(gl, 'resources/shaders/art-preview', defs);
    this.stateGl.registerShader('art-preview', this.shader);
    this.stateGl.setIndexBuffer(buffer.getIndexBuffer());
    this.stateGl.setVertexBuffer('aPos', buffer.getVertexBuffer(0));
    this.stateGl.setVertexBuffer('aTc', buffer.getVertexBuffer(1));
    this.stateGl.setShader('art-preview');
  }

  draw(canvas: HTMLCanvasElement, ctx: Pick<WorkplaneContext, 'scale' | 'xoff' | 'yoff'>, ri: RenderInfo, plu: number, superSample: number, repeat: boolean) {
    const { info, picnum } = ri;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const hw = w / 2;
    const hh = h / 2;
    const scale = 1 / ctx.scale;
    this.ctl.setSize(w, h);
    this.ctl.setUnitsPerPixel(scale);
    this.ctl.setPosition((hw - ctx.xoff) * scale, (hh - ctx.yoff) * scale, 0);

    const { gl, offscreen } = this.glCtx;
    const stateGl = this.stateGl;
    offscreen.width = w;
    offscreen.height = h;
    gl.viewport(0, 0, w, h);

    gl.clearColor(0, 0, 0, 1.0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    stateGl.start();
    stateGl.setUniform('options', vec4.fromValues(superSample, plu, repeat ? 5 : 1, 0));
    stateGl.setUniform('size', vec4.fromValues(info.w, info.h, info.attrs.xoff, info.attrs.yoff))
    stateGl.setUniform('P', this.ctl.getProjectionMatrix());
    stateGl.setUniform('V', this.ctl.getTransformMatrix());

    stateGl.setTexture('tex', this.textures.get(picnum).get());
    stateGl.setTexture('pal', this.textures.pal.get());
    stateGl.setTexture('plu', this.textures.plu.get());
    stateGl.setTexture('trans', this.textures.trans.get());
    stateGl.draw(gl, this.buffer, 0, 6);
    stateGl.flush(gl);

    canvas.getContext('bitmaprenderer')
      .transferFromImageBitmap(offscreen.transferToImageBitmap());
  }

  async dispose(): Promise<void> {
    const { gl } = this.glCtx;
    this.shader.destroy(gl);
  }
}