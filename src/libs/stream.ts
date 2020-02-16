export class Stream {
  private view: DataView;
  private offset: number;
  private littleEndian: boolean;
  private currentBit = 7;
  private currentByte = 0;

  constructor(buf: ArrayBuffer, isLE: boolean) {
    this.view = new DataView(buf);
    this.offset = 0;
    this.littleEndian = isLE;
  }

  private checkBitAlignment() {
    if (this.currentBit != 7)
      throw new Error('Unaligned read');
  }

  public buffer(): ArrayBuffer {
    return this.view.buffer;
  }

  public eoi(): boolean {
    return this.offset >= this.view.byteLength;
  }

  public skip(n: number) {
    this.checkBitAlignment();
    this.offset += n;
  }

  public setOffset(off: number): void {
    this.checkBitAlignment();
    this.offset = off;
  }

  public mark(): number {
    this.checkBitAlignment();
    return this.offset;
  }

  public readByte(): number {
    this.checkBitAlignment();
    return this.view.getInt8(this.offset++);
  }

  public writeByte(byte: number): void {
    this.checkBitAlignment();
    this.view.setInt8(this.offset++, byte);
  }

  public readUByte(): number {
    this.checkBitAlignment();
    return this.view.getUint8(this.offset++);
  }

  public writeUByte(byte: number): void {
    this.checkBitAlignment();
    this.view.setUint8(this.offset++, byte);
  }

  public readShort(): number {
    this.checkBitAlignment();
    const ret = this.view.getInt16(this.offset, this.littleEndian);
    this.offset += 2;
    return ret;
  }

  public writeShort(short: number): void {
    this.checkBitAlignment();
    this.view.setInt16(this.offset, short, this.littleEndian);
    this.offset += 2;
  }

  public readUShort(): number {
    this.checkBitAlignment();
    const ret = this.view.getUint16(this.offset, this.littleEndian);
    this.offset += 2;
    return ret;
  }

  public writeUShort(short: number): void {
    this.checkBitAlignment();
    this.view.setUint16(this.offset, short, this.littleEndian);
    this.offset += 2;
  }

  public readInt(): number {
    this.checkBitAlignment();
    const ret = this.view.getInt32(this.offset, this.littleEndian);
    this.offset += 4;
    return ret;
  }

  public writeInt(int: number): void {
    this.checkBitAlignment();
    this.view.setInt32(this.offset, int, this.littleEndian);
    this.offset += 4;
  }

  public readUInt(): number {
    this.checkBitAlignment();
    const ret = this.view.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return ret;
  }

  public writeUInt(int: number): void {
    this.checkBitAlignment();
    this.view.setUint32(this.offset, int, this.littleEndian);
    this.offset += 4;
  }

  public readFloat(): number {
    this.checkBitAlignment();
    const ret = this.view.getFloat32(this.offset += 4, this.littleEndian);
    this.offset += 4;
    return ret;
  }

  public writeFloat(float: number): void {
    this.checkBitAlignment();
    this.view.setFloat32(this.offset, float, this.littleEndian);
    this.offset += 4;
  }

  public readByteString(len: number): string {
    this.checkBitAlignment();
    let str = new Array<string>(len);
    for (let i = 0; i < len; i++) {
      let c = this.readByte();
      if (c == 0) {
        this.skip(len - i - 1);
        break;
      }
      str.push(String.fromCharCode(c));
    }
    return str.join('');
  }

  public writeByteString(len: number, str: string): void {
    this.checkBitAlignment();
    for (const c of str) this.writeByte(c.charCodeAt(0));
    for (let i = 0; i < len - str.length; i++) this.writeByte(0);
  }

  public subView(): Stream {
    this.checkBitAlignment();
    const ret = new Stream(this.view.buffer, this.littleEndian);
    ret.setOffset(this.offset);
    return ret;
  }

  public readArrayBuffer(bytes: number): ArrayBuffer {
    this.checkBitAlignment();
    const slice = this.view.buffer.slice(this.offset, this.offset + bytes);
    this.offset += bytes;
    return slice;
  }

  public writeArrayBuffer(buffer: ArrayBuffer): void {
    const dst = new Uint8Array(this.view.buffer, this.offset);
    dst.set(new Uint8Array(buffer));
    this.offset += buffer.byteLength;
  }

  public readBit(): number {
    if (this.currentBit > 6) {
      this.currentByte = this.readUByte();
      this.currentBit = 0;
    } else {
      this.currentBit++;
    }

    return ((this.currentByte >> (this.currentBit)) & 1);
  }

  public writeBit(bit: boolean): void {
    if (this.currentBit == 0) {
      this.writeUByte(this.currentByte);
      this.currentByte = 0;
      this.currentBit = 7;
    } else {
      this.currentBit--;
    }

    if (bit) this.currentByte |= (1 << this.currentByte)
    else this.currentByte &= (~(1 << this.currentByte) & 0xff);
  }

  public readBits(bits: number): number {
    let value = 0;
    const signed = bits < 0;
    bits = signed ? -bits : bits;
    for (let i = 0; i < bits; i++) {
      let b = this.readBit();
      value = value | (b << i);
    }
    return signed ? toSigned(value, bits) : value;
  }

  public writeBits(count: number, value: number): void {

  }
}

function toSigned(value: number, bits: number) {
  return value & (1 << (bits - 1))
    ? -(~value & ((1 << bits) - 1)) - 1
    : value
}

type ScalarReader<T> = (s: Stream) => T;

export interface Reader<T> {
  readonly read: ScalarReader<T>;
  readonly size: number;
}

type AtomicArrayConstructor<T> = { new(buffer: ArrayBuffer, byteOffset: number, length: number): T };

export interface AtomicReader<T, AT> extends Reader<T> {
  readonly atomicArrayConstructor: AtomicArrayConstructor<AT>;
}

function reader<T>(read: ScalarReader<T>, size: number): Reader<T> {
  return { read, size };
}

function atomicReader<T, AT>(read: ScalarReader<T>, size: number, atomicArrayConstructor: AtomicArrayConstructor<AT>): AtomicReader<T, AT> {
  return { read, size, atomicArrayConstructor };
}

export const byte = atomicReader(s => s.readByte(), 1, Int8Array);
export const ubyte = atomicReader(s => s.readUByte(), 1, Uint8Array);
export const short = atomicReader(s => s.readShort(), 2, Int16Array);
export const ushort = atomicReader(s => s.readUShort(), 2, Uint16Array);
export const int = atomicReader(s => s.readInt(), 4, Int32Array);
export const uint = atomicReader(s => s.readUInt(), 4, Uint32Array);
export const float = atomicReader(s => s.readFloat(), 4, Float32Array);
export const string = (len: number) => reader(s => s.readByteString(len), len);
export const bits = (len: number) => reader(s => s.readBits(len), Math.abs(len) / 8);
export const array = <T>(type: Reader<T>, len: number) => reader(s => readArray(s, type, len), type.size * len);
export const atomic_array = <T>(type: AtomicReader<any, T>, len: number) => reader(s => readAtomicArray(s, type, len), type.size * len);
export const struct = <T>(type: Constructor<T>) => new StructBuilder(type);

const readArray = <T>(s: Stream, type: Reader<T>, len: number): Array<T> => {
  const arr = new Array<T>();
  for (let i = 0; i < len; i++)
    arr[i] = type.read(s);
  return arr;
}

const readAtomicArray = <T>(s: Stream, type: AtomicReader<any, T>, len: number) => {
  const ctr = type.atomicArrayConstructor;
  const buffer = s.readArrayBuffer(len * type.size);
  return new ctr(buffer, 0, len * type.size);
}

type Constructor<T> = { new(): T };
type Field<T> = [T, Reader<any>];

class StructBuilder<T, K extends keyof T> implements Reader<T> {
  private fields: Field<K>[] = [];
  public size = 0;
  constructor(private ctr: Constructor<T>) { }

  field(f: K, r: Reader<any>) {
    this.fields.push([f, r]);
    this.size += r.size;
    return this;
  }

  read(s: Stream) {
    const struct = new this.ctr();
    for (let i = 0; i < this.fields.length; i++) {
      const [name, reader] = this.fields[i];
      struct[name] = reader.read(s);
    }
    return struct;
  }
}

