import * as DS from './drawstruct';

export class TextureStub implements DS.Texture {
  constructor(public w: number, public h: number) { }
  public get(): WebGLTexture { return null }
  public getWidth(): number { return this.w }
  public getHeight(): number { return this.h }
  public getFormat(): number { return null }
  public getType(): number { return null }
}

function getMagFilter(filter: number): number {
  switch (filter) {
    case WebGLRenderingContext.NEAREST:
    case WebGLRenderingContext.NEAREST_MIPMAP_LINEAR:
    case WebGLRenderingContext.NEAREST_MIPMAP_NEAREST:
      return WebGLRenderingContext.NEAREST;
    case WebGLRenderingContext.LINEAR:
    case WebGLRenderingContext.LINEAR_MIPMAP_LINEAR:
    case WebGLRenderingContext.LINEAR_MIPMAP_NEAREST:
      return WebGLRenderingContext.LINEAR;
  }
}

function isMipmapped(filter: number) {
  switch (filter) {
    case WebGLRenderingContext.LINEAR_MIPMAP_LINEAR:
    case WebGLRenderingContext.NEAREST_MIPMAP_LINEAR:
    case WebGLRenderingContext.NEAREST_MIPMAP_NEAREST:
    case WebGLRenderingContext.LINEAR_MIPMAP_NEAREST:
      return true;
  }
  return false;
}

export class TextureImpl implements DS.Texture {

  public id: WebGLTexture;
  public width: number;
  public height: number;
  private format: number;
  private type: number;
  public data: Uint8Array;

  constructor(width: number, height: number, gl: WebGLRenderingContext, options: any = {}, img: Uint8Array = null, format: number = gl.RGBA, bpp: number = 4) {
    this.id = gl.createTexture();
    this.width = width;
    this.height = height;
    this.format = format;
    this.type = gl.UNSIGNED_BYTE;

    gl.bindTexture(gl.TEXTURE_2D, this.id);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, getMagFilter(options.filter || gl.NEAREST));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, options.filter || gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, options.repeat || gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, options.repeat || gl.CLAMP_TO_EDGE);

    if (options.aniso) {
      let ext = gl.getExtension('EXT_texture_filter_anisotropic');
      let max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, max);
    }


    if (img == null)
      img = new Uint8Array(width * height * bpp);
    this.data = img;
    gl.texImage2D(gl.TEXTURE_2D, 0, this.format, width, height, 0, this.format, this.type, this.data);

    if (isMipmapped(options.filter)) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  public get(): WebGLTexture {
    return this.id;
  }

  public getWidth(): number {
    return this.width;
  }

  public getHeight(): number {
    return this.height;
  }

  public getFormat(): number {
    return this.format;
  }

  public getType(): number {
    return this.type;
  }

  public reload(gl: WebGLRenderingContext): void {
    gl.bindTexture(gl.TEXTURE_2D, this.id);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, this.getFormat(), this.getType(), this.data);
  }
}

export function createTexture(width: number, height: number, gl: WebGLRenderingContext, options: any = {}, img: Uint8Array = null, format: number = gl.RGBA, bpp: number = 4) {
  return new TextureImpl(width, height, gl, options, img, format, bpp);
}

export class DrawTexture extends TextureImpl {

  constructor(width: number, height: number, gl: WebGLRenderingContext, options: any = {}, img: Uint8Array = null, format: number = gl.RGBA, bpp: number = 4) {
    super(width, height, gl, options, img, format, bpp);
  }

  public putPixel(x: number, y: number, pixel: Uint8Array, gl: WebGLRenderingContext): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height)
      return;
    gl.bindTexture(gl.TEXTURE_2D, this.id);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, this.getFormat(), this.getType(), pixel);
  }

  public putSubImage(x: number, y: number, w: number, h: number, img: ArrayBufferView, gl: WebGLRenderingContext): void {
    gl.bindTexture(gl.TEXTURE_2D, this.id);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, this.getFormat(), this.getType(), img);
  }
}

export function createDrawTexture(width: number, height: number, gl: WebGLRenderingContext, options: any = {}, img: Uint8Array = null, format: number = gl.RGBA, bpp: number = 4) {
  return new DrawTexture(width, height, gl, options, img, format, bpp);
}

export class RenderTexture extends TextureImpl {

  private framebuffer: WebGLFramebuffer;
  private renderbuffer: WebGLRenderbuffer;

  constructor(width: number, height: number, gl: WebGLRenderingContext, options: any = {}, img: Uint8Array = null) {
    super(width, height, gl, options, img);
    this.framebuffer = gl.createFramebuffer();
    this.renderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.getWidth(), this.getHeight());
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  }

  public drawTo(gl: WebGLRenderingContext, callback: (WebGLRenderingContext) => void): Uint8Array {
    let v = gl.getParameter(gl.VIEWPORT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderbuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.id, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.renderbuffer);
    gl.viewport(0, 0, this.getWidth(), this.getHeight());

    callback(gl);

    gl.readPixels(0, 0, this.getWidth(), this.getHeight(), gl.RGBA, gl.UNSIGNED_BYTE, this.data);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.viewport(v[0], v[1], v[2], v[3]);

    return this.data;
  }
}

export function createRenderTexture(width: number, height: number, gl: WebGLRenderingContext, options: any = {}, img: Uint8Array = null) {
  return new RenderTexture(width, height, gl, options, img);
}