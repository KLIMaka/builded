import { Stream, atomic_array, ubyte } from "../../utils/stream";

export class GrpFile {
  private data: Stream;
  private count: number;
  readonly files: { [index: string]: number } = {};

  constructor(buf: ArrayBuffer) {
    this.data = new Stream(buf, true);
    this.loadFiles();
  }

  private loadFiles() {
    const d = this.data;
    d.setOffset(12);
    this.count = d.readUInt();
    let offset = this.count * 16 + 16;
    for (let i = 0; i < this.count; i++) {
      const fname = d.readByteString(12);
      const size = d.readUInt();
      this.files[fname.toLowerCase()] = offset;
      offset += size;
    }
  }

  public get(fname: string): Stream {
    const off = this.files[fname.toLowerCase()];
    if (off == undefined) return null;
    this.data.setOffset(off);
    return this.data.subView();
  }
}

export function create(buf: ArrayBuffer): GrpFile {
  return new GrpFile(buf);
}

export function createPalette(stream: Stream): Uint8Array {
  const pal = new Uint8Array(768);
  for (let i = 0; i < 256; i++) {
    pal[i * 3 + 0] = stream.readUByte() * 4;
    pal[i * 3 + 1] = stream.readUByte() * 4;
    pal[i * 3 + 2] = stream.readUByte() * 4;
  }
  return pal;
}

export function loadShadeTables(stream: Stream): Uint8Array[] {
  stream.skip(0x300);
  const size = stream.readUShort();
  const table = atomic_array(ubyte, 256);
  const result = [];
  for (let i = 0; i < size; i++) result.push(table.read(stream));
  return result;
}

export function loadPlus(stream: Stream): Uint8Array[] {
  const size = stream.readUByte();
  const table = atomic_array(ubyte, 256);
  const plus = [];
  const refPlu = new Uint8Array(256);
  for (let i = 0; i < 256; i++) refPlu[i] = i;
  plus[0] = refPlu;
  for (let i = 0; i < size; i++) {
    const idx = stream.readUByte();
    const plu = table.read(stream);
    plus[idx] = plu;
  }
  return plus;
}