import { WorkplaneContext } from "@ui/commons";
import { Disposable, Source, ValuesContainer } from "@utils/callbacks";
import { Controller2D } from "@utils/camera/controller2d";
import { Buffer, BufferBuilder } from "@utils/gl/buffergl";
import { Shader, Texture } from "@utils/gl/drawstruct";
import { createShader } from "@utils/gl/shaders";
import { State } from "@utils/gl/stategl";
import { GlContext } from "app/modules/gl/gl-context";
import { mat3, vec4 } from "gl-matrix";
import Optional from "optional-js";

export class RectifierRenderer implements Disposable {
  private ctl: Controller2D;
  private stateGl = new State();
  private buffer: Buffer;
  private shader: Shader;

  constructor(
    private glCtx: GlContext,
    private image: Source<Optional<Texture>>,
    values: ValuesContainer,
  ) {
    this.ctl = new Controller2D(values);
  }

  async init() {
    const { gl } = this.glCtx;
    const buffer = new Buffer(gl, new BufferBuilder()
      .addVertexBuffer(gl, gl.FLOAT, 3)
    );
    this.buffer = buffer;

    const ptr = buffer.allocate(4, 6);
    buffer.writeVertex(ptr, 0, 0, [0, 0, 0]);
    buffer.writeVertex(ptr, 0, 1, [0, 0, 1]);
    buffer.writeVertex(ptr, 0, 2, [1, 0, 1]);
    buffer.writeVertex(ptr, 0, 3, [1, 0, 0]);
    buffer.writeQuad(ptr, 0, 3, 2, 1, 0);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.shader = await createShader(gl, 'resources/shaders/rectifier');
    this.stateGl.registerShader('rectifier', this.shader);
    this.stateGl.setIndexBuffer(buffer.getIndexBuffer());
    this.stateGl.setVertexBuffer('aPos', buffer.getVertexBuffer(0));
    this.stateGl.setShader('rectifier');
  }

  draw(canvas: HTMLCanvasElement, ctx: Pick<WorkplaneContext, 'xoff' | 'yoff' | 'scale'>, homo: mat3, iw: number, ih: number) {
    if (!this.image.get().isPresent()) return;

    const image = this.image.get().get();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const scale = 1 / ctx.scale;

    this.ctl.setSize(w, h);
    this.ctl.setUnitsPerPixel(scale);
    this.ctl.setPosition((w / 2 - ctx.xoff) * scale, (h / 2 - ctx.yoff) * scale, 0);

    const { gl, offscreen } = this.glCtx;
    const stateGl = this.stateGl;
    offscreen.width = w;
    offscreen.height = h;
    gl.viewport(0, 0, w, h);

    gl.clearColor(0, 0, 0, 1.0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    stateGl.start();
    stateGl.setTexture('tex', image);
    stateGl.setUniform('size', vec4.fromValues(iw, ih, image.getWidth(), image.getHeight()))
    stateGl.setUniform('homo', homo)
    stateGl.setUniform('P', this.ctl.getProjectionMatrix());
    stateGl.setUniform('V', this.ctl.getTransformMatrix());
    stateGl.draw(gl, this.buffer, 0, 6);
    stateGl.flush(gl);

    canvas.getContext('bitmaprenderer')
      .transferFromImageBitmap(offscreen.transferToImageBitmap());
  }

  dispose(): void {
    const { gl } = this.glCtx;
    this.shader.destroy(gl);
    this.buffer.destroy(gl);
  }
}