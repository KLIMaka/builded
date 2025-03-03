import { rect, Ring } from "@utils/collections";
import { atomic_array, int, Stream, ubyte, uint, ushort } from "@utils/stream";

export enum VoxelSide { ZM, ZP, XM, XP, YM, YP };
export const VOXEL_SIDES = [VoxelSide.ZM, VoxelSide.ZP, VoxelSide.XM, VoxelSide.XP, VoxelSide.YM, VoxelSide.YP];

function packVoxelSideImpl(zm: boolean, zp: boolean, xm: boolean, xp: boolean, ym: boolean, yp: boolean): number {
  return (zm ? (1 << VoxelSide.ZM) : 0)
    | (zp ? (1 << VoxelSide.ZP) : 0)
    | (xm ? (1 << VoxelSide.XM) : 0)
    | (xp ? (1 << VoxelSide.XP) : 0)
    | (ym ? (1 << VoxelSide.YM) : 0)
    | (yp ? (1 << VoxelSide.YP) : 0);
}

export function packVoxelSide(sides: VoxelSide[]): number {
  return sides.reduce((acc, side) => acc | (1 << side), 0);
}

export function unpackVoxelSides(sides: number): VoxelSide[] {
  return VOXEL_SIDES.filter(side => (sides & (1 << side)) !== 0);
}

export type VoxelListItem = {
  x: number,
  y: number,
  z: number,
  color: number,
  sides: number,
};

export class VoxelData {
  private data: Uint8Array;

  constructor(
    readonly xsize: number,
    readonly ysize: number,
    readonly zsize: number,
    readonly xpivot: number,
    readonly ypivot: number,
    readonly zpivot: number,
  ) {
    this.data = new Uint8Array(xsize * ysize * zsize).fill(255);
  }

  private off(x: number, y: number, z: number): number {
    if (x < 0 || x >= this.xsize || y < 0 || y >= this.ysize || z < 0 || z >= this.zsize)
      throw new Error(`Invalid Voxel Cube position [${x} ${y} ${z}] size is [${this.xsize} ${this.ysize} ${this.zsize}]`);
    return x + y * (this.xsize) + z * (this.xsize * this.ysize);
  }

  set(x: number, y: number, z: number, value: number) {
    this.data[this.off(x, y, z)] = value;
  }

  private getImpl(x: number, y: number, z: number, data: Uint8Array) {
    if (x < 0 || x >= this.xsize || y < 0 || y >= this.ysize || z < 0 || z >= this.zsize) return 255;
    return data[this.off(x, y, z)];
  }

  get(x: number, y: number, z: number) {
    return this.getImpl(x, y, z, this.data);
  }

  fill() {
    const copy = this.data.map(e => e === 255 ? 0 : 1);
    const queue = new Ring<[number, number, number]>(this.xsize * this.ysize * 2 + this.xsize * this.zsize * 2 + this.ysize * this.zsize * 2);
    rect(this.xsize, this.ysize).forEach(([x, y]) => { queue.push([x, y, -1]); queue.push([x, y, this.zsize]) });
    rect(this.xsize, this.zsize).forEach(([x, z]) => { queue.push([x, -1, z]); queue.push([x, this.ysize, z]) });
    rect(this.ysize, this.zsize).forEach(([y, z]) => { queue.push([-1, y, z]); queue.push([this.xsize, y, z]) });

    while (queue.length() !== 0) {
      const [x, y, z] = queue.popHead();
      if (this.getImpl(x + 1, y, z, copy) === 0) { copy[this.off(x + 1, y, z)] = 1; queue.push([x + 1, y, z]) };
      if (this.getImpl(x - 1, y, z, copy) === 0) { copy[this.off(x - 1, y, z)] = 1; queue.push([x - 1, y, z]) };
      if (this.getImpl(x, y + 1, z, copy) === 0) { copy[this.off(x, y + 1, z)] = 1; queue.push([x, y + 1, z]) };
      if (this.getImpl(x, y - 1, z, copy) === 0) { copy[this.off(x, y - 1, z)] = 1; queue.push([x, y - 1, z]) };
      if (this.getImpl(x, y, z + 1, copy) === 0) { copy[this.off(x, y, z + 1)] = 1; queue.push([x, y, z + 1]) };
      if (this.getImpl(x, y, z - 1, copy) === 0) { copy[this.off(x, y, z - 1)] = 1; queue.push([x, y, z - 1]) };
    }

    for (let z = 0; z < this.zsize; z++)
      for (let y = 0; y < this.ysize; y++)
        for (let x = 0; x < this.xsize; x++)
          if (this.getImpl(x, y, z, copy) === 0) this.set(x, y, z, 0)
  }

  list(): VoxelListItem[] {
    const voxels: VoxelListItem[] = [];
    for (let z = 0; z < this.zsize; z++) {
      for (let y = 0; y < this.ysize; y++) {
        for (let x = 0; x < this.xsize; x++) {
          const color = this.get(x, y, z);
          if (color === 255) continue;
          const sides = packVoxelSideImpl(
            this.get(x, y, z - 1) === 255,
            this.get(x, y, z + 1) === 255,
            this.get(x - 1, y, z) === 255,
            this.get(x + 1, y, z) === 255,
            this.get(x, y - 1, z) === 255,
            this.get(x, y + 1, z) === 255);
          if (sides === 0) continue;
          voxels.push({ x, y, z: this.zsize - z, color, sides });
        }
      }
    }
    return voxels;
  }
}

export function readKvx(stream: Stream): VoxelData {
  const numbytes = uint.read(stream);
  const xsize = uint.read(stream);
  const ysize = uint.read(stream);
  const zsize = uint.read(stream);
  const xpivot = int.read(stream);
  const ypivot = int.read(stream);
  const zpivot = int.read(stream);
  const off = stream.mark();
  const xoffset = atomic_array(uint, xsize + 1).read(stream);
  const xyoffset = atomic_array(ushort, xsize * (ysize + 1)).read(stream);
  const cube = new VoxelData(xsize, ysize, zsize, xpivot, ypivot, zpivot);
  for (const [x, y] of rect(xsize, ysize)) {
    const start = off + xoffset[x] + xyoffset[x * (ysize + 1) + y];
    const end = off + xoffset[x] + xyoffset[x * (ysize + 1) + y + 1];
    stream.setOffset(start);
    while (stream.mark() < end) {
      const slabztop = ubyte.read(stream);
      const slabzleng = ubyte.read(stream);
      const backfaceInfo = ubyte.read(stream);
      const column = atomic_array(ubyte, slabzleng).read(stream);
      column.forEach((c, i) => cube.set(x, y, slabztop + i, c));
    }
  }
  cube.fill();
  return cube;
}