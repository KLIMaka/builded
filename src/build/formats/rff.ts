import { struct, string, uint, array, byte, ubyte, Stream, atomic_array } from "../../utils/stream";

class Header {
  public sign: string;
  public version: number;
  public offFat: number;
  public numFiles: number;
}

class FatRecord {
  public unk: any;
  public offset: number;
  public size: number;
  public time: number;
  public flags: number;
  public filename: string;
}

let headerStruct = struct(Header)
  .field('sign', string(4))
  .field('version', uint)
  .field('offFat', uint)
  .field('numFiles', uint);

let fatRecord = struct(FatRecord)
  .field('unk', array(byte, 16))
  .field('offset', uint)
  .field('size', uint)
  .field('unk', uint)
  .field('time', uint)
  .field('flags', ubyte)
  .field('filename', string(11))
  .field('unk', uint);

export class RffFile {
  private data: Stream;
  private header: Header;
  public fat: FatRecord[];
  private namesTable: { [index: string]: number } = {};

  constructor(buf: ArrayBuffer) {
    this.data = new Stream(buf);
    this.header = headerStruct.read(this.data);
    this.data.setOffset(this.header.offFat);
    const len = this.header.numFiles * 48;
    const fat = atomic_array(ubyte, len).read(this.data);
    this.decodeFat(fat);
    const fatBuffer = new Stream(fat.buffer);
    fatBuffer.setOffset(fat.byteOffset);
    this.loadFat(fatBuffer, this.header.numFiles);
  }

  private loadFat(stream: Stream, numFiles: number): void {
    this.fat = array(fatRecord, numFiles).read(stream);
    for (let i = 0; i < this.fat.length; i++) {
      const r = this.fat[i];
      r.filename = this.convertFname(r.filename).toLowerCase();
      this.namesTable[r.filename] = i;
    }
  }

  private decodeFat(fat: Uint8Array) {
    if (this.header.version >= 0x301) {
      let key = this.header.offFat & 0xff;
      for (let i = 0; i < fat.length; i += 2) {
        fat[i] ^= key;
        fat[i + 1] ^= key;
        key = (key + 1) % 256;
      }
    }
  }

  private convertFname(name: string): string {
    return name.substr(3) + '.' + name.substr(0, 3);
  }

  public get(fname: string): Uint8Array {
    const idx = this.namesTable[fname.toLowerCase()];
    if (idx == undefined) return null;
    const record = this.fat[idx];
    this.data.setOffset(record.offset);
    const arr = atomic_array(ubyte, record.size).read(this.data);
    if (record.flags & 0x10)
      for (let i = 0; i < 256; i++)
        arr[i] ^= (i >> 1);
    return arr;
  }
}

export function create(buf: ArrayBuffer): RffFile {
  return new RffFile(buf);
}