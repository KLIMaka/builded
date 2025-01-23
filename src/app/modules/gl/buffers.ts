import { getOrCreate, groups } from '@utils/collections';
import { iter } from '@utils/iter';
import { sum } from '@utils/mathutils';
import { VoxelData } from 'build/formats/kvx';
import { Buffer, BufferBuilder, Pointer } from '../../../utils/gl/buffergl';
import { IndexBuffer, VertexBuffer } from '../../../utils/gl/drawstruct';
import { GlContext } from './gl-context';
import { Sprite } from 'build/board/structs';
import { Disposable } from '@utils/callbacks';

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
  writeNormal(off: number, x: number, y: number, z: number, w?: number): number;
  writeTcLighting(off: number, u: number, v: number, pal?: number, shade?: number): number;
  writeLightmap(off: number, x: number, y: number, z?: number, w?: number): number;
  getNormBuffer(): VertexBuffer;
  getTexCoordBuffer(): VertexBuffer;
  getLightmapBuffer(): VertexBuffer;
}

export interface BuildBufferFactory extends Disposable {
  get(hint: string): BuildBuffer;
}

export function createBufferFactory(glContext: GlContext): BuildBufferFactory {
  const { gl } = glContext;
  return new BuildBufferFactoryImpl(gl);
}

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

  segment(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
    const idx1 = this.addVtx(x1, y1, z1);
    const idx2 = this.addVtx(x2, y2, z2);
    this.addLine(idx1, idx2);
  }

  rect(
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

  build(buff: GenericBuildBuffer) {
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
    if (idx === undefined) {
      idx = this.vtxs.length;
      this.vtxIndex.set(key, idx);
      this.vtxs.push([x, y, z]);
    }
    return idx;
  }

  private addLine(idx1: number, idx2: number) {
    if (idx1 === idx2) return;
    const key = `${idx1},${idx2}`;
    this.linesIndex.has(key);
    if (!this.linesIndex.has(key)) {
      this.linesIndex.add(key);
      this.lines.push([idx1, idx2]);
    }
  }
}

type Vertex = { x: number, y: number, z: number }
type VoxelElement = { color: number, vtxs: Vertex[], idxs: number[] }
class VoxelElementBuilder {
  private vtxsMap = new Map<number, number>();
  readonly vtxs: Vertex[] = [];
  readonly idxs: number[] = [];

  constructor(
    private cx: number,
    private cy: number,
    private cz: number,
    private hxscale: number,
    private hyscale: number,
    private hzscale: number,
  ) { }

  private vertex(vtxId: number): Vertex {
    switch (vtxId) {
      case 1: return { x: this.cx - this.hxscale, y: this.cy - this.hyscale, z: this.cz + this.hzscale };
      case 2: return { x: this.cx + this.hxscale, y: this.cy - this.hyscale, z: this.cz + this.hzscale };
      case 3: return { x: this.cx + this.hxscale, y: this.cy + this.hyscale, z: this.cz + this.hzscale };
      case 4: return { x: this.cx - this.hxscale, y: this.cy + this.hyscale, z: this.cz + this.hzscale };
      case 5: return { x: this.cx - this.hxscale, y: this.cy - this.hyscale, z: this.cz - this.hzscale };
      case 6: return { x: this.cx + this.hxscale, y: this.cy - this.hyscale, z: this.cz - this.hzscale };
      case 7: return { x: this.cx + this.hxscale, y: this.cy + this.hyscale, z: this.cz - this.hzscale };
      case 8: return { x: this.cx - this.hxscale, y: this.cy + this.hyscale, z: this.cz - this.hzscale };
      default: throw new Error();
    }
  }

  private insertVertex(vtxId: number): number {
    const id = this.vtxs.length;
    this.vtxs.push(this.vertex(vtxId));
    return id;
  }

  private createVertex(vtxId: number) {
    return getOrCreate(this.vtxsMap, vtxId, _ => this.insertVertex(vtxId));
  }

  zPlane(front: boolean) {
    if (front) this.idxs.push(this.createVertex(1), this.createVertex(2), this.createVertex(3), this.createVertex(4))
    else this.idxs.push(this.createVertex(8), this.createVertex(7), this.createVertex(6), this.createVertex(5))
  }

  xPlane(front: boolean) {
    if (front) this.idxs.push(this.createVertex(5), this.createVertex(1), this.createVertex(4), this.createVertex(8))
    else this.idxs.push(this.createVertex(7), this.createVertex(3), this.createVertex(2), this.createVertex(6))
  }

  yPlane(front: boolean) {
    if (front) this.idxs.push(this.createVertex(6), this.createVertex(2), this.createVertex(1), this.createVertex(5))
    else this.idxs.push(this.createVertex(8), this.createVertex(4), this.createVertex(3), this.createVertex(7))
  }

  isEmpty() {
    return this.idxs.length === 0;
  }

  build(color: number): VoxelElement {
    return { color, idxs: this.idxs, vtxs: this.vtxs };
  }
}

export function buildVoxel(spr: Sprite, data: VoxelData, buff: BuildBuffer, xscale: number, yscale: number, zscale: number, pal: number, shade: number) {
  const xoff = -data.xpivot * xscale;
  const yoff = -data.ypivot * yscale;
  const zoff = spr.cstat.realCenter ? -data.zpivot * zscale : 0;
  const elements: VoxelElement[] = [];
  const top = data.zsize * zscale;
  const hxscale = xscale / 2;
  const hyscale = yscale / 2;
  const hzscale = zscale / 2;
  for (let z = 0; z < data.zsize; z++) {
    for (let y = 0; y < data.ysize; y++) {
      for (let x = 0; x < data.xsize; x++) {
        const c = data.get(x, y, z);
        if (c === 255) continue;
        const cx = x * xscale + xoff + hxscale;
        const cy = y * yscale + yoff + hyscale;
        const cz = top - z * zscale + zoff - hzscale;
        const color = c / 255;
        const builder = new VoxelElementBuilder(cx, cy, cz, hxscale, hyscale, hzscale);
        if (data.get(x, y, z - 1) === 255) builder.zPlane(true);
        if (data.get(x, y, z + 1) === 255) builder.zPlane(false);
        if (data.get(x - 1, y, z) === 255) builder.xPlane(true);
        if (data.get(x + 1, y, z) === 255) builder.xPlane(false);
        if (data.get(x, y - 1, z) === 255) builder.yPlane(true);
        if (data.get(x, y + 1, z) === 255) builder.yPlane(false);
        if (!builder.isEmpty()) elements.push(builder.build(color));
      }
    }
  }
  const vtxs = iter(elements).map(e => e.vtxs.length).reduce(sum, 0);
  const idxs = iter(elements).map(e => e.idxs.length).reduce(sum, 0) * (6 / 4);
  buff.allocate(vtxs, idxs);
  let vtxoff = 0;
  let idxoff = 0;
  elements.forEach(elem => {
    for (let i = 0; i < elem.vtxs.length; i++) {
      const v = elem.vtxs[i];
      buff.writePos(vtxoff + i, v.x, v.z, v.y)
      buff.writeTcLighting(vtxoff + i, elem.color, 0, pal, shade)
    }
    iter(groups(elem.idxs, 4)).enumerate().forEach(([[a, b, c, d], i]) =>
      buff.writeQuad(idxoff + i * 6, vtxoff + a, vtxoff + b, vtxoff + c, vtxoff + d))
    vtxoff += elem.vtxs.length;
    idxoff += elem.idxs.length * (6 / 4);
  })
}

const POSITION = 0;
const NORMAL = 1;
const TEX_SHADING = 2;
const LIGHTMAP = 3;

class BuildBufferFactoryImpl implements BuildBufferFactory {
  private buffers = new Map<string, Buffer[]>();

  constructor(private gl: WebGL2RenderingContext) { }

  private getBuffers(hint: string): Buffer[] {
    return getOrCreate(this.buffers, hint, _ => [])
  }

  private addNewBuffer(hint: string) {
    const buffer = new Buffer(this.gl, new BufferBuilder(1024 * 1024)
      .addVertexBuffer(this.gl, this.gl.FLOAT, 3)
      .addVertexBuffer(this.gl, this.gl.FLOAT, 4)
      .addVertexBuffer(this.gl, this.gl.FLOAT, 4)
      .addVertexBuffer(this.gl, this.gl.FLOAT, 4)
    );
    this.getBuffers(hint).push(buffer);
    return buffer;
  }

  get(hint: string): BuildBuffer {
    return new BuildBufferImpl(this, hint);
  }

  allocate(hint: string, vtxSize: number, idxSize: number): Pointer {
    for (const buff of this.getBuffers(hint)) {
      const ptr = buff.allocate(vtxSize, idxSize);
      if (ptr != null) return ptr;
    }
    return this.addNewBuffer(hint).allocate(vtxSize, idxSize);
  }

  async dispose(): Promise<void> {
    this.buffers.values().forEach(b => b.forEach(b => b.destroy(this.gl)));
  }
}

export class BuildBufferImpl implements BuildBuffer {
  private ptr: Pointer;
  private size = 0;

  constructor(private factory: BuildBufferFactoryImpl, private hint: string) { }

  get(): Pointer { return this.ptr }
  getSize() { return this.size }

  private remove() {
    this.ptr.buffer.deallocate(this.ptr)
  }

  allocate(vtxCount: number, triIndexCount: number) {
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

  deallocate() {
    if (this.ptr != null) {
      this.remove();
      this.ptr = null;
      this.size = 0;
    }
  }

  writePos(off: number, x: number, y: number, z: number): number {
    this.ptr.buffer.writeVertex(this.ptr, POSITION, off, [x, y, z]);
    return off + 1;
  }

  writeNormal(off: number, x: number, y: number, z: number, w: number = 0): number {
    this.ptr.buffer.writeVertex(this.ptr, NORMAL, off, [x, y, z, w]);
    return off + 1;
  }

  writeTcLighting(off: number, u: number, v: number, pal: number = 0, shade: number = 0): number {
    this.ptr.buffer.writeVertex(this.ptr, TEX_SHADING, off, [u, v, pal, shade]);
    return off + 1;
  }

  writeLightmap(off: number, x: number, y: number, z: number = 0, w: number = 0): number {
    this.ptr.buffer.writeVertex(this.ptr, LIGHTMAP, off, [x, y, z, w]);
    return off + 1;
  }

  writeTriangle(off: number, a: number, b: number, c: number): number {
    this.ptr.buffer.writeIndex(this.ptr, off, [a, b, c]);
    return off + 3;
  }

  writeQuad(off: number, a: number, b: number, c: number, d: number): number {
    this.ptr.buffer.writeIndex(this.ptr, off, [a, c, b, a, d, c]);
    return off + 6;
  }

  writeLine(off: number, a: number, b: number): number {
    this.ptr.buffer.writeIndex(this.ptr, off, [a, b]);
    return off + 2;
  }

  getPosBuffer(): VertexBuffer {
    return this.ptr.buffer.getVertexBuffer(POSITION);
  }

  getNormBuffer(): VertexBuffer {
    return this.ptr.buffer.getVertexBuffer(NORMAL);
  }

  getTexCoordBuffer(): VertexBuffer {
    return this.ptr.buffer.getVertexBuffer(TEX_SHADING);
  }

  getLightmapBuffer(): VertexBuffer {
    return this.ptr.buffer.getVertexBuffer(LIGHTMAP);
  }

  getIdxBuffer(): IndexBuffer {
    return this.ptr.buffer.getIndexBuffer();
  }
}