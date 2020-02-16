import { IndexBuffer, VertexBuffer } from "./drawstruct";

export class VertexBufferImpl implements VertexBuffer {
  constructor(
    private buffer: WebGLBuffer,
    private type: number,
    private spacing: number = 3,
    private normalized: boolean = false,
    private stride: number = 0,
    private offset: number = 0
  ) { }

  getBuffer(): WebGLBuffer { return this.buffer }
  getType(): number { return this.type }
  getSpacing(): number { return this.spacing }
  getNormalized(): boolean { return this.normalized }
  getStride(): number { return this.stride }
  getOffset(): number { return this.offset }
}


class IndexBufferImpl implements IndexBuffer {
  constructor(
    private buffer: WebGLBuffer,
    private type: number
  ) { }

  getBuffer(): WebGLBuffer { return this.buffer }
  getType(): number { return this.type }
}

export function genIndexBuffer(gl: WebGLRenderingContext, count: number, pattern: number[]): IndexBuffer {
  const bufIdx = gl.createBuffer();
  const len = pattern.length;
  const size = Math.max.apply(null, pattern) + 1;
  const data = new Uint16Array(count * len);
  for (let i = 0; i < count; i++) {
    const off = i * len;
    const off1 = i * size;
    for (let j = 0; j < len; j++) {
      data[off + j] = off1 + pattern[j];
    }
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIdx);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, <ArrayBuffer>data.buffer, gl.STATIC_DRAW);
  return new IndexBufferImpl(bufIdx, gl.UNSIGNED_SHORT);
}

export function GlType2ArrayType(glType: number): any {
  switch (glType) {
    case WebGLRenderingContext.BYTE: return Int8Array;
    case WebGLRenderingContext.UNSIGNED_BYTE: return Uint8Array;
    case WebGLRenderingContext.SHORT: return Int16Array;
    case WebGLRenderingContext.UNSIGNED_SHORT: return Uint16Array;
    case WebGLRenderingContext.INT: return Int32Array;
    case WebGLRenderingContext.UNSIGNED_INT: return Uint32Array;
    case WebGLRenderingContext.FLOAT: return Float32Array;
    default: throw new Error('Unknown GL Type: ' + glType);
  }
}

export function ArrayType2GlType(arrayType: any): number {
  switch (arrayType) {
    case Int8Array: return WebGLRenderingContext.BYTE;
    case Uint8Array: return WebGLRenderingContext.UNSIGNED_BYTE;
    case Int16Array: return WebGLRenderingContext.SHORT;
    case Uint16Array: return WebGLRenderingContext.UNSIGNED_SHORT;
    case Int32Array: return WebGLRenderingContext.INT;
    case Uint32Array: return WebGLRenderingContext.UNSIGNED_INT;
    case Float32Array: return WebGLRenderingContext.FLOAT;
    default: throw new Error('Unknown Array Type: ' + arrayType);
  }
}

export interface Updatable {
  updateRegion(gl: WebGLRenderingContext, offset: number, length: number): void;
}

export class VertexBufferDynamic extends VertexBufferImpl implements Updatable {
  private data: ArrayBufferView;

  constructor(
    gl: WebGLRenderingContext,
    type: number,
    data: ArrayBufferView,
    spacing: number,
    usage: number = WebGLRenderingContext.STREAM_DRAW,
    normalized: boolean = false
  ) {
    super(gl.createBuffer(), type, spacing, normalized, 0, 0);
    this.data = data;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.getBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, this.data, usage);
  }

  public getData(): ArrayBufferView {
    return this.data;
  }

  public update(gl: WebGLRenderingContext): void {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.getBuffer());
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data);
  }

  public updateRegion(gl: WebGLRenderingContext, offset: number, length: number): void {
    var sizeof = (<any>this.data).BYTES_PER_ELEMENT * this.getSpacing();
    var region = new Uint8Array(this.data.buffer, offset * sizeof, length * sizeof);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.getBuffer());
    gl.bufferSubData(gl.ARRAY_BUFFER, offset * sizeof, region);
  }
}

export class DynamicIndexBuffer extends IndexBufferImpl implements Updatable {
  private data: ArrayBufferView;

  constructor(
    gl: WebGLRenderingContext,
    data: ArrayBufferView,
    type: number = WebGLRenderingContext.UNSIGNED_SHORT,
    usage: number = WebGLRenderingContext.STREAM_DRAW
  ) {
    super(gl.createBuffer(), type);
    this.data = data;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.getBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.data, usage);
  }

  public update(gl: WebGLRenderingContext, length: number = 0) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.getBuffer());
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, this.data);
  }

  public updateRegion(gl: WebGLRenderingContext, offset: number, length: number): void {
    var sizeof = 2;
    var region = new Uint8Array(this.data.buffer, offset * sizeof, length * sizeof);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.getBuffer());
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, offset * sizeof, region);
  }

  public getData(): ArrayBufferView { return this.data }
}
export function createVertexBuffer(gl: WebGLRenderingContext, type: number, data: any, spacing: number, usage: number = WebGLRenderingContext.STREAM_DRAW, norm: boolean = false): VertexBufferDynamic {
  var arrtype = GlType2ArrayType(type);
  if (typeof data == 'number') data = new arrtype(data * spacing)
  else if (arrtype != data.constructor) throw new Error('GL Type and ArrayBuffer is incompatible')
  return new VertexBufferDynamic(gl, type, data, spacing, usage, norm);
}

export function wrap(gl: WebGLRenderingContext, data: ArrayBufferView, spacing: number, usage: number = WebGLRenderingContext.STREAM_DRAW, norm: boolean = false): VertexBufferDynamic {
  return new VertexBufferDynamic(gl, ArrayType2GlType(data.constructor), data, spacing, usage, norm);
}


export function createIndexBuffer(gl: WebGLRenderingContext, type: number, data: any, usage: number = WebGLRenderingContext.STREAM_DRAW): DynamicIndexBuffer {
  const arrtype = GlType2ArrayType(type);
  if (typeof data == 'number') data = new arrtype(data);
  else if (arrtype != data.constructor) throw new Error('GL Type and ArrayBuffer is incompatible')
  return new DynamicIndexBuffer(gl, data, type, usage);
}

export function wrapIndexBuffer(gl: WebGLRenderingContext, data: ArrayBufferView, usage: number = WebGLRenderingContext.STREAM_DRAW): DynamicIndexBuffer {
  return new DynamicIndexBuffer(gl, data, ArrayType2GlType(data.constructor), usage);
}  