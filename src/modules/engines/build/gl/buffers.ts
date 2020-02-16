import { Buffer, BufferBuilder, Pointer } from '../../../buffergl';
import { VertexBuffer, IndexBuffer } from '../../../drawstruct';

const buffers: Buffer[] = [];
let ctx: WebGLRenderingContext;

const POSITION = 0;
const NORMAL = 1;
const TEXCOORDS = 2;

function createNewBuffer() {
  let buffer = new Buffer(ctx, new BufferBuilder()
    .addVertexBuffer(ctx, ctx.FLOAT, 3)
    .addVertexBuffer(ctx, ctx.FLOAT, 3)
    .addVertexBuffer(ctx, ctx.FLOAT, 2));
  buffers.push(buffer);
  return buffer;
}

export function init(gl: WebGLRenderingContext) {
  ctx = gl;
  createNewBuffer();
}

function allocate(vtxSize: number, idxSize: number): Pointer {
  for (let i = 0; i < buffers.length; i++) {
    let ptr = buffers[i].allocate(vtxSize, idxSize);
    if (ptr != null) return ptr;
  }
  return createNewBuffer().allocate(vtxSize, idxSize);
}

function remove(ptr: Pointer) {
  ptr.buffer.deallocate(ptr);
}

function writePos(ptr: Pointer, off: number, x: number, y: number, z: number): number {
  ptr.buffer.writeVertex(ptr, POSITION, off, [x, y, z]);
  return off + 1;
}

function writeNormal(ptr: Pointer, off: number, x: number, y: number, z: number): number {
  ptr.buffer.writeVertex(ptr, NORMAL, off, [x, y, z]);
  return off + 1;
}

function writeTc(ptr: Pointer, off: number, u: number, v: number): number {
  ptr.buffer.writeVertex(ptr, TEXCOORDS, off, [u, v]);
  return off + 1;
}

function writeTriangle(ptr: Pointer, off: number, a: number, b: number, c: number): number {
  ptr.buffer.writeIndex(ptr, off, [a, b, c]);
  return off + 3;
}

function writeQuad(ptr: Pointer, off: number, a: number, b: number, c: number, d: number): number {
  ptr.buffer.writeIndex(ptr, off, [a, c, b, a, d, c]);
  return off + 6;
}

function writeLine(ptr: Pointer, off: number, a: number, b: number): number {
  ptr.buffer.writeIndex(ptr, off, [a, b]);
  return off + 2;
}

export class BuildBuffer {
  private ptr: Pointer;
  private size = 0;

  public get(): Pointer { return this.ptr }
  public getSize() { return this.size }

  public allocate(vtxCount: number, triIndexCount: number) {
    if (this.ptr != null) {
      if (this.ptr.vtx.size >= vtxCount && this.ptr.idx.size >= triIndexCount) {
        this.size = triIndexCount;
        return;
      }
      remove(this.ptr);
    }
    this.ptr = allocate(vtxCount, triIndexCount);
    this.size = this.ptr.idx.size;
  }

  public deallocate() {
    if (this.ptr != null) {
      remove(this.ptr);
      this.ptr = null;
      this.size = 0;
    }
  }

  public writePos(off: number, x: number, y: number, z: number): number {
    return writePos(this.ptr, off, x, y, z);
  }

  public writeNormal(off: number, x: number, y: number, z: number): number {
    return writeNormal(this.ptr, off, x, y, z);
  }

  public writeTc(off: number, u: number, v: number): number {
    return writeTc(this.ptr, off, u, v);
  }

  public writeTriangle(off: number, a: number, b: number, c: number): number {
    return writeTriangle(this.ptr, off, a, b, c);
  }

  public writeQuad(off: number, a: number, b: number, c: number, d: number): number {
    return writeQuad(this.ptr, off, a, b, c, d);
  }

  public writeLine(off: number, a: number, b: number) {
    return writeLine(this.ptr, off, a, b);
  }

  public getPosBuffer(): VertexBuffer {
    return this.ptr.buffer.getVertexBuffer(POSITION);
  }

  public getNormBuffer(): VertexBuffer {
    return this.ptr.buffer.getVertexBuffer(NORMAL);
  }

  public getTexCoordBuffer(): VertexBuffer {
    return this.ptr.buffer.getVertexBuffer(TEXCOORDS);
  }

  public getIdxBuffer(): IndexBuffer {
    return this.ptr.buffer.getIndexBuffer();
  }
}