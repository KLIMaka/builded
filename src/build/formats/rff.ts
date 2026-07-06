import { getOrCreate } from "ts-utils/collections";
import Optional from "optional-js";
import { string, uint, array, byte, ubyte, Stream, atomic_array, builder, AccessorType } from "ts-utils/stream";

const headerStruct = builder()
  .field('sign', string(4))
  .field('version', uint)
  .field('offFat', uint)
  .field('numFiles', uint)
  .build();

const fatRecord = builder()
  .field('unk1', array(byte, 16))
  .field('offset', uint)
  .field('size', uint)
  .field('unk2', uint)
  .field('time', uint)
  .field('flags', ubyte)
  .field('filename', string(11))
  .field('fileId', uint)
  .build();

export type FatRecord = AccessorType<typeof fatRecord>
export type RffFileType = {
  get(rec: FatRecord): ArrayBuffer,
  getByName(fname: string): Optional<ArrayBuffer>,
  getRecord(fname: string): Optional<FatRecord>,
  getRecordById(ext: string, fid: number): Optional<FatRecord>,
  getTypeRecords(ext: string): FatRecord[],
  getFat(): FatRecord[],
}

export const EMPTY_RFF_FILE: RffFileType = {
  get(rec: FatRecord) { throw new Error('Empty RFF file') },
  getByName(fname: string) { return Optional.empty() },
  getRecord(fname: string) { return Optional.empty() },
  getRecordById(ext: string, fid: number) { return Optional.empty() },
  getTypeRecords(ext: string) { return [] },
  getFat() { return [] }
}

export class RffFile implements RffFileType {
  private data: Stream;
  private header: AccessorType<typeof headerStruct>;
  private namesTable = new Map<string, FatRecord>();
  private fileIdMap = new Map<string, Map<number, FatRecord>>();
  readonly fat: FatRecord[];

  constructor(buf: ArrayBuffer) {
    this.data = new Stream(buf);
    this.header = headerStruct.read(this.data);
    this.data.setOffset(this.header.offFat);
    const fat = atomic_array(ubyte, this.header.numFiles * fatRecord.size).read(this.data);
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

  getByName(fname: string): Optional<ArrayBuffer> {
    return this.getRecord(fname).map(r => this.get(r));
  }

  getRecord(fname: string): Optional<FatRecord> {
    return Optional.ofNullable(this.namesTable.get(fname.toLowerCase()));
  }

  getRecordById(ext: string, fid: number): Optional<FatRecord> {
    return Optional.ofNullable(this.fileIdMap.get(ext.toLowerCase()))
      .map(m => m.get(fid))
  }

  getTypeRecords(ext: string): FatRecord[] {
    return [...this.fileIdMap.get(ext.toLowerCase())?.values() ?? []]
  }

  getFat(): FatRecord[] {
    return this.fat;
  }
}

export function create(buf: ArrayBuffer): RffFile {
  return new RffFile(buf);
}