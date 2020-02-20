import { Buffer, BufferBuilder, Pointer } from '../../../utils/gl/buffergl';
import { IndexBuffer, VertexBuffer } from '../../../utils/gl/drawstruct';
import { Dependency, Injector } from '../../../utils/injector';
import { GL } from '../buildartprovider';

export interface BuildBuffer {
  get(): Pointer;
  getSize(): number;
  allocate(vtxCount: number, triIndexCount: number): void;
  deallocate(): void;
  writePos(off: number, x: number, y: number, z: number): number;
  writeNormal(off: number, x: number, y: number, z: number): number;
  writeTc(off: number, u: number, v: number): number;
  writeTriangle(off: number, a: number, b: number, c: number): number;
  writeQuad(off: number, a: number, b: number, c: number, d: number): number;
  writeLine(off: number, a: number, b: number): number;
  getPosBuffer(): VertexBuffer;
  getNormBuffer(): VertexBuffer;
  getTexCoordBuffer(): VertexBuffer;
  getIdxBuffer(): IndexBuffer;
}

export interface BuildBufferFactory {
  get(): BuildBuffer;
}

export const BUFFER_FACTORY = new Dependency<BuildBufferFactory>('Build Buffer Factory');

export async function DefaultBufferFactory(injector: Injector) {
  const gl = await injector.getInstance(GL);
  return new BuildBufferFactoryImpl(gl);
}

const POSITION = 0;
const NORMAL = 1;
const TEXCOORDS = 2;

class BuildBufferFactoryImpl implements BuildBufferFactory {
  private buffers: Buffer[] = [];

  constructor(private gl: WebGLRenderingContext) {
    this.addNewBuffer();
  }

  private addNewBuffer() {
    const buffer = new Buffer(this.gl, new BufferBuilder()
      .addVertexBuffer(this.gl, this.gl.FLOAT, 3)
      .addVertexBuffer(this.gl, this.gl.FLOAT, 3)
      .addVertexBuffer(this.gl, this.gl.FLOAT, 2));
    this.buffers.push(buffer);
    return buffer;
  }

  public get(): BuildBuffer {
    return new BuildBufferImpl(this);
  }

  public allocate(vtxSize: number, idxSize: number): Pointer {
    for (const buff of this.buffers) {
      const ptr = buff.allocate(vtxSize, idxSize);
      if (ptr != null) return ptr;
    }
    return this.addNewBuffer().allocate(vtxSize, idxSize);
  }
}

export class BuildBufferImpl implements BuildBuffer {
  private ptr: Pointer;
  private size = 0;

  constructor(private factory: BuildBufferFactoryImpl) { }

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
    this.ptr = this.factory.allocate(vtxCount, triIndexCount);
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

  public writeTc(off: number, u: number, v: number): number {
    this.ptr.buffer.writeVertex(this.ptr, TEXCOORDS, off, [u, v]);
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
    return this.ptr.buffer.getVertexBuffer(TEXCOORDS);
  }

  public getIdxBuffer(): IndexBuffer {
    return this.ptr.buffer.getIndexBuffer();
  }
}