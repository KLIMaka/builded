import { Buffer, BufferBuilder, Pointer } from '../../../utils/gl/buffergl';
import { IndexBuffer, VertexBuffer } from '../../../utils/gl/drawstruct';
import { Dependency, Injector } from '../../../utils/injector';
import { GL } from '../buildartprovider';

export interface GenericBuildBuffer {
  get(): Pointer;
  getSize(): number;
  allocate(vtxCount: number, triIndexCount: number): void;
  deallocate(): void;
  writePos(off: number, x: number, y: number, z: number): number;
  getIdxBuffer(): IndexBuffer;
  getPosBuffer(): VertexBuffer;
  writeTriangle(off: number, a: number, b: number, c: number): number;
  writeQuad(off: number, a: number, b: number, c: number, d: number): number;
  writeLine(off: number, a: number, b: number): number;
}

export interface BuildBuffer extends GenericBuildBuffer {
  writeNormal(off: number, x: number, y: number, z: number): number;
  writeTcLighting(off: number, u: number, v: number, pal?: number, shade?: number): number;
  getNormBuffer(): VertexBuffer;
  getTexCoordBuffer(): VertexBuffer;
}

export interface BuildBufferFactory {
  get(hint: string): BuildBuffer;
}
export const BUFFER_FACTORY = new Dependency<BuildBufferFactory>('Build Buffer Factory');

export async function DefaultBufferFactory(injector: Injector) {
  const gl = await injector.getInstance(GL);
  return new BuildBufferFactoryImpl(gl);
}

const POSITION = 0;
const NORMAL = 1;
const TEX_SHADING = 2;

class BuildBufferFactoryImpl implements BuildBufferFactory {
  private buffers = new Map<string, Buffer[]>();

  constructor(private gl: WebGLRenderingContext) { }

  private addNewBuffer(hint: string) {
    const buffer = new Buffer(this.gl, new BufferBuilder()
      .addVertexBuffer(this.gl, this.gl.FLOAT, 3)
      .addVertexBuffer(this.gl, this.gl.FLOAT, 3)
      .addVertexBuffer(this.gl, this.gl.FLOAT, 4));
    let buffers = this.buffers.get(hint);
    buffers.push(buffer);
    return buffer;
  }

  public get(hint: string): BuildBuffer {
    let buffers = this.buffers.get(hint);
    if (buffers == undefined) {
      buffers = [];
      this.buffers.set(hint, buffers);
    }
    return new BuildBufferImpl(this, hint);
  }

  public allocate(hint: string, vtxSize: number, idxSize: number): Pointer {
    for (const buff of this.buffers.get(hint)) {
      const ptr = buff.allocate(vtxSize, idxSize);
      if (ptr != null) return ptr;
    }
    return this.addNewBuffer(hint).allocate(vtxSize, idxSize);
  }
}

export class BuildBufferImpl implements BuildBuffer {
  private ptr: Pointer;
  private size = 0;

  constructor(private factory: BuildBufferFactoryImpl, private hint: string) { }

  public get(): Pointer { return this.ptr }
  public getSize() { return this.size }
  private remove() { this.ptr.buffer.deallocate(this.ptr) }

  public allocate(vtxCount: number, triIndexCount: number) {
    if (this.ptr != null) {
      if (this.ptr.vtx.size >= vtxCount && this.ptr.idx.size >= triIndexCount) {
        this.size = triIndexCount;
        return;
      }
      this.remove();
    }
    this.ptr = this.factory.allocate(this.hint, vtxCount, triIndexCount);
    this.size = this.ptr.idx.size;
  }

  public deallocate() {
    if (this.ptr != null) {
      this.remove();
      this.ptr = null;
      this.size = 0;
    }
  }

  public writePos(off: number, x: number, y: number, z: number): number {
    this.ptr.buffer.writeVertex(this.ptr, POSITION, off, [x, y, z]);
    return off + 1;
  }

  public writeNormal(off: number, x: number, y: number, z: number): number {
    this.ptr.buffer.writeVertex(this.ptr, NORMAL, off, [x, y, z]);
    return off + 1;
  }

  public writeTcLighting(off: number, u: number, v: number, pal: number = 0, shade: number = 0): number {
    this.ptr.buffer.writeVertex(this.ptr, TEX_SHADING, off, [u, v, pal, shade]);
    return off + 1;
  }

  public writeTriangle(off: number, a: number, b: number, c: number): number {
    this.ptr.buffer.writeIndex(this.ptr, off, [a, b, c]);
    return off + 3;
  }

  public writeQuad(off: number, a: number, b: number, c: number, d: number): number {
    this.ptr.buffer.writeIndex(this.ptr, off, [a, c, b, a, d, c]);
    return off + 6;
  }

  public writeLine(off: number, a: number, b: number): number {
    this.ptr.buffer.writeIndex(this.ptr, off, [a, b]);
    return off + 2;
  }

  public getPosBuffer(): VertexBuffer {
    return this.ptr.buffer.getVertexBuffer(POSITION);
  }

  public getNormBuffer(): VertexBuffer {
    return this.ptr.buffer.getVertexBuffer(NORMAL);
  }

  public getTexCoordBuffer(): VertexBuffer {
    return this.ptr.buffer.getVertexBuffer(TEX_SHADING);
  }

  public getIdxBuffer(): IndexBuffer {
    return this.ptr.buffer.getIndexBuffer();
  }
}