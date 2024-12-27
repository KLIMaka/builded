import { rect, Ring } from "@utils/collections";
import { iter } from "@utils/iter";
import { atomic_array, int, Stream, ubyte, uint, ushort } from "@utils/stream";


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
}

export function readKvx(stream: Stream): VoxelData {
  const numbytes = uint.read(stream);
  const xsize = uint.read(stream);
  const ysize = uint.read(stream);
  const zsize = uint.read(stream);
  const xpivot = int.read(stream) / 256;
  const ypivot = int.read(stream) / 256;
  const zpivot = int.read(stream) / 256;
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
      iter(column).enumerate().forEach(([c, i]) => cube.set(x, y, slabztop + i, c));
    }
  }
  cube.fill();
  return cube;
}