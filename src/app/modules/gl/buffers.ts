import { Buffer, BufferBuilder, Pointer } from '../../../utils/gl/buffergl';
import { IndexBuffer, VertexBuffer } from '../../../utils/gl/drawstruct';
import { Dependency, Injector, provider } from '../../../utils/injector';
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

export const DefaultBufferFactory = provider(async (injector: Injector) => {
  const gl = await injector.getInstance(GL);
  return new BuildBufferFactoryImpl(gl);
});

export class PointSpritesBuilder {
  private sprites: [number, number, number][] = [];

  public add(x: number, y: number, z: number) {
    this.sprites.push([x, y, z]);
  }

  public build(buff: BuildBuffer, d: number) {
    const size = this.sprites.length;
    buff.allocate(size * 4, size * 6);
    for (let i = 0; i < size; i++) {
      const off = i * 4;
      const [x, y, z] = this.sprites[i];
      buff.writePos(off + 0, x, y, z);
      buff.writePos(off + 1, x, y, z);
      buff.writePos(off + 2, x, y, z);
      buff.writePos(off + 3, x, y, z);
      buff.writeTcLighting(off + 0, 0, 0);
      buff.writeTcLighting(off + 1, 1, 0);
      buff.writeTcLighting(off + 2, 1, 1);
      buff.writeTcLighting(off + 3, 0, 1);
      buff.writeNormal(off + 0, -d, d, 0);
      buff.writeNormal(off + 1, d, d, 0);
      buff.writeNormal(off + 2, d, -d, 0);
      buff.writeNormal(off + 3, -d, -d, 0);
      buff.writeQuad(i * 6, off, off + 1, off + 2, off + 3);
    }
  }
}

export class LineBuilder {
  private vtxIndex: Map<string, number> = new Map();
  private linesIndex: Set<string> = new Set();
  private vtxs: [number, number, number][] = [];
  private lines: [number, number][] = [];

  public segment(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
    const idx1 = this.addVtx(x1, y1, z1);
    const idx2 = this.addVtx(x2, y2, z2);
    this.addLine(idx1, idx2);
  }

  public rect(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    x3: number, y3: number, z3: number,
    x4: number, y4: number, z4: number
  ) {
    this.segment(x1, y1, z1, x2, y2, z2);
    this.segment(x2, y2, z2, x3, y3, z3);
    this.segment(x3, y3, z3, x4, y4, z4);
    this.segment(x4, y4, z4, x1, y1, z1);
  }

  public build(buff: GenericBuildBuffer) {
    buff.allocate(this.vtxs.length, this.lines.length * 2);
    for (let i = 0; i < this.vtxs.length; i++) {
      const vtx = this.vtxs[i];
      buff.writePos(i, vtx[0], vtx[1], vtx[2]);
    }
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      buff.writeLine(i * 2, line[0], line[1]);
    }
  }

  private addVtx(x: number, y: number, z: number): number {
    const key = `${x},${y},${z}`;
    let idx = this.vtxIndex.get(key);
    if (idx == undefined) {
      idx = this.vtxs.length;
      this.vtxIndex.set(key, idx);
      this.vtxs.push([x, y, z]);
    }
    return idx;
  }

  private addLine(idx1: number, idx2: number) {
    if (idx1 == idx2) return;
    const key = `${idx1},${idx2}`;
    this.linesIndex.has(key);
    if (!this.linesIndex.has(key)) {
      this.linesIndex.add(key);
      this.lines.push([idx1, idx2]);
    }
  }
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