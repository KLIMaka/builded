import { DisposableResource, GlContext, Texture } from './drawstruct';

export class TextureImpl implements Texture {
  private id: DisposableResource<WebGLTexture>;
  private width: number;
  private height: number;
  private format: number;
  private type: number;

  constructor({ gl, resource }: GlContext, width: number, height: number, img: Uint8Array, format: number = WebGL2RenderingContext.RGBA, bpp: number = 4) {
    this.id = resource('texture', gl.createTexture(), t => gl.deleteTexture(t));
    this.width = width;
    this.height = height;
    this.format = format;
    this.type = gl.UNSIGNED_BYTE;
    gl.bindTexture(gl.TEXTURE_2D, this.id.value);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.format, width, height, 0, this.format, this.type, img);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  get(): WebGLTexture {
    return this.id.value;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  async dispose() {
    this.id.dispose();
  }
}

export function createTexture(glCtx: GlContext, width: number, height: number, img: Uint8Array, format: number = WebGL2RenderingContext.RGBA, bpp: number = 4) {
  return new TextureImpl(glCtx, width, height, img, format, bpp);
}
