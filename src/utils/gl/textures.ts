import { int } from '@utils/mathutils';
import { DisposableResource, GlContext, Texture } from './drawstruct';
import { resizeIndexed } from '@utils/color';

export class TextureStub implements Texture {
  constructor(private w: number, private h: number) { }
  get(): WebGLTexture { return null }
  getWidth(): number { return this.w }
  getHeight(): number { return this.h }
  async dispose(): Promise<void> { }
}

export class TextureImpl implements Texture {
  private id: DisposableResource<WebGLTexture>;
  private width: number;
  private height: number;
  private format: number;
  private type: number;
  private data: Uint8Array;

  constructor({ gl, resource }: GlContext, width: number, height: number, img: Uint8Array = null, format: number = WebGL2RenderingContext.RGBA, bpp: number = 4) {
    this.id = resource('texture', gl.createTexture(), t => gl.deleteTexture(t));
    this.width = width;
    this.height = height;
    this.format = format;
    this.type = gl.UNSIGNED_BYTE;

    if (img == null) img = new Uint8Array(width * height * bpp);
    this.data = img;
    gl.bindTexture(gl.TEXTURE_2D, this.id.value);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.format, width, height, 0, this.format, this.type, this.data);
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

  reload(gl: WebGLRenderingContext): void {
    gl.bindTexture(gl.TEXTURE_2D, this.id.value);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, this.format, this.type, this.data);
  }

  mip(gl: WebGLRenderingContext, level: number, width: number, height: number, data: Uint8Array) {
    gl.bindTexture(gl.TEXTURE_2D, this.id.value);
    gl.texImage2D(gl.TEXTURE_2D, level, this.format, width, height, 0, this.format, this.type, data);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  async dispose() {
    this.id.dispose();
    this.data = null;
  }
}

export function createTexture(glCtx: GlContext, width: number, height: number, img: Uint8Array = null, format: number = WebGL2RenderingContext.RGBA, bpp: number = 4) {
  return new TextureImpl(glCtx, width, height, img, format, bpp);
}