import * as PROFILE from '../profiler';
import { VertexBufferDynamic, createVertexBuffer, DynamicIndexBuffer, createIndexBuffer, Updatable } from './bufferimpl';
import { Place, BagController, createController } from '../bag';

export interface Pointer {
  readonly buffer: Buffer,
  readonly vtx: Place,
  readonly idx: Place
}

class Pointerimpl implements Pointer {
  constructor(
    readonly buffer: Buffer,
    readonly vtx: Place,
    readonly idx: Place
  ) { }
}

export class BufferBuilder {
  public vtxBuffers: VertexBufferDynamic[] = [];

  constructor(public size: number = 64 * 1024) { }

  public addVertexBuffer(gl: WebGLRenderingContext, type: number, spacing: number): BufferBuilder {
    this.vtxBuffers.push(createVertexBuffer(gl, type, this.size, spacing));
    return this;
  }
}

type Region = [number, number];

export class Buffer {
  private vtxBag: BagController;
  private idxBag: BagController;
  public vtxBuffers: VertexBufferDynamic[];
  private idxBuffer: DynamicIndexBuffer;
  private vtxRegions: Region[][] = [];
  private idxRegions: Region[] = [];
  private needUpdate = true;

  constructor(gl: WebGLRenderingContext, builder: BufferBuilder, readonly blockSize = 1024) {
    const vtxSize = builder.size;
    const idxSize = vtxSize * 2;
    this.vtxBuffers = builder.vtxBuffers;
    this.idxBuffer = createIndexBuffer(gl, gl.UNSIGNED_SHORT, idxSize);

    this.vtxBag = createController(vtxSize, (place: Place, noffset: number) => {
      for (const v of this.vtxBuffers) {
        const buff = <any>v.getData();
        const spacing = v.getSpacing();
        buff.set(buff.subarray(place.offset * spacing, (place.offset + place.size) * spacing), noffset * spacing);
      }
      const ptr = <Place>place.data;
      const offdiff = noffset - place.offset;
      const buff = <Uint16Array>this.idxBuffer.getData();
      for (let i = 0; i < ptr.size; i++) buff[ptr.offset + i] += offdiff;
    });

    this.idxBag = createController(idxSize, (place: Place, noffset: number) => {
      const buff = <Uint16Array>this.idxBuffer.getData();
      buff.set(buff.subarray(place.offset, place.offset + place.size), noffset);
    });

    for (let i = 0; i < this.vtxBuffers.length; i++) this.vtxRegions.push([]);
  }

  public getVertexBuffer(idx: number): VertexBufferDynamic {
    return this.vtxBuffers[idx];
  }

  public getIndexBuffer(): DynamicIndexBuffer {
    return this.idxBuffer;
  }

  public allocate(vtxs: number, idxs: number): Pointer {
    const vtx = this.vtxBag.get(vtxs);
    if (vtx == null) return null;
    const idx = this.idxBag.get(idxs);
    if (idx == null) {
      this.vtxBag.put(vtx);
      return null;
    }
    vtx.data = idx;
    return new Pointerimpl(this, vtx, idx);
  }

  public deallocate(ptr: Pointer): void {
    if (ptr.buffer != this)
      throw new Error('Invalid Buffer for this Pointer');
    this.vtxBag.put(ptr.vtx);
    this.idxBag.put(ptr.idx);
  }

  public writeVertex(ptr: Pointer, idx: number, off: number, vdata: number[]) {
    const buff = this.vtxBuffers[idx];
    const offset = (ptr.vtx.offset + off) * buff.getSpacing();
    const data = buff.getData();
    for (let i = 0; i < vdata.length; i++) data[offset + i] = vdata[i];
    this.vtxRegions[idx].push([offset / buff.getSpacing(), Math.ceil(vdata.length / buff.getSpacing())]);
    this.needUpdate = true;
  }

  public writeIndex(ptr: Pointer, off: number, idata: number[]) {
    const buff = this.idxBuffer;
    const offset = ptr.idx.offset + off;
    const vtxoff = ptr.vtx.offset;
    const data = buff.getData();
    for (let i = 0; i < idata.length; i++) data[offset + i] = idata[i] + vtxoff;
    this.idxRegions.push([offset, idata.length]);
    this.needUpdate = true;
  }


  private mergeRegions(regions: Region[], i: number): [number, Region] {
    const region = regions[i];
    for (; ;) {
      if (i + 1 >= regions.length) break;
      const currentend = region[0] + region[1];
      const nextstart = regions[i + 1][0];
      const diff = nextstart - currentend;
      if (diff < 0 || diff > this.blockSize) break;
      region[1] += regions[++i][1] + diff;
    }
    return [i, region];
  }

  private updateBuffer(gl: WebGLRenderingContext, buffer: Updatable, regions: Region[]): boolean {
    for (let i = 0; i < regions.length; i++) {
      const [ii, region] = this.mergeRegions(regions, i);
      i = ii;
      // PROFILE.get(null).inc('traffic', region[1]);
      // PROFILE.get(null).inc('updates');
      buffer.updateRegion(gl, region[0], region[1]);
    }
    return true;
  }

  public update(gl: WebGLRenderingContext) {
    if (!this.needUpdate) return;
    for (let v = 0; v < this.vtxBuffers.length; v++) {
      if (this.vtxRegions[v].length == 0) continue;
      this.updateBuffer(gl, this.vtxBuffers[v], this.vtxRegions[v]);
      this.vtxRegions[v] = [];
    }
    if (this.idxRegions.length != 0) {
      this.updateBuffer(gl, this.idxBuffer, this.idxRegions);
      this.idxRegions = [];
    }
    this.needUpdate = false;
    // PROFILE.get(null).set('buffer', this.vtxBag.freeSpace(64));
  }
}