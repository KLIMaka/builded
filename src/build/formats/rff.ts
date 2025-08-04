import { getOrCreate } from "ts-utils/collections";
import Optional from "optional-js";
import { struct, string, uint, array, byte, ubyte, Stream, atomic_array } from "ts-utils/stream";

type Header = {
  sign: string;
  version: number;
  offFat: number;
  numFiles: number;
}

type FatRecord = {
  unk1: number[];
  unk2: number;
  offset: number;
  size: number;
  time: number;
  flags: number;
  filename: string;
  fileId: number;
}

const headerStruct = struct<Header>()
  .field('sign', string(4))
  .field('version', uint)
  .field('offFat', uint)
  .field('numFiles', uint);

const fatRecord = struct<FatRecord>()
  .field('unk1', array(byte, 16))
  .field('offset', uint)
  .field('size', uint)
  .field('unk2', uint)
  .field('time', uint)
  .field('flags', ubyte)
  .field('filename', string(11))
  .field('fileId', uint);

export class RffFile {
  private data: Stream;
  private header: Header;
  private namesTable = new Map<string, FatRecord>();
  private fileIdMap = new Map<string, Map<number, FatRecord>>();
  readonly fat: FatRecord[];

  constructor(buf: ArrayBuffer) {
    this.data = new Stream(buf);
    this.header = headerStruct.read(this.data);
    this.data.setOffset(this.header.offFat);
    const len = this.header.numFiles * fatRecord.size;
    const fat = atomic_array(ubyte, len).read(this.data);
    this.decodeFat(fat);
    const fatBuffer = new Stream(fat.buffer);
    fatBuffer.setOffset(fat.byteOffset);
    this.fat = this.loadFat(fatBuffer, this.header.numFiles);
  }

  private loadFat(stream: Stream, numFiles: number): FatRecord[] {
    const fat = array(fatRecord, numFiles).read(stream);
    fat.forEach(r => {
      const [fname, ext] = [r.filename.substring(3), r.filename.substring(0, 3)];
      r.filename = `${fname}.${ext}`;
      const idMap = getOrCreate(this.fileIdMap, ext.toLowerCase(), _ => new Map());
      idMap.set(r.fileId, r);
      this.namesTable.set(r.filename.toLowerCase(), r);
    });
    return fat;
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

  get(rec: FatRecord): ArrayBuffer {
    this.data.setOffset(rec.offset);
    const arr = atomic_array(ubyte, rec.size).read(this.data);
    if (rec.flags & 0x10)
      for (let i = 0; i < 256; i++)
        arr[i] ^= (i >> 1);
    return arr.buffer;
  }

  getByName(fname: string): ArrayBuffer {
    const record = this.getRecord(fname);
    return record ? this.get(record) : null;
  }

  getRecord(fname: string): FatRecord {
    return this.namesTable.get(fname.toLowerCase());
  }

  getRecordById(ext: string, fid: number): FatRecord {
    return Optional.ofNullable(this.fileIdMap.get(ext.toLowerCase()))
      .map(m => m.get(fid))
      .orElse(null)
  }
}

export function create(buf: ArrayBuffer): RffFile {
  return new RffFile(buf);
}