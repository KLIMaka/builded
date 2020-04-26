import { int } from "./mathutils";

export class Bitvec {
  private arr: Uint8Array;
  private offset = 0;

  constructor(private capacity: number) {
    this.arr = new Uint8Array(Math.ceil(capacity / 8));
  }

  get(idx: number): boolean {
    this.ensureSize(idx);
    const [byte, bit] = this.addr(idx);
    return (this.arr[byte] & this.bitmask(bit)) != 0;
  }

  set(idx: number, value: boolean): void {
    this.ensureSize(idx);
    const [byte, bit] = this.addr(idx);
    if (value) this.addr[byte] |= this.bitmask(bit)
    else this.addr[byte] &= ~this.bitmask(bit)
    this.offset = Math.max(idx, this.offset);
  }


  fill(idx: number, size: number, value: boolean): void {
    if (size == 0) return;
    this.ensureSize(idx + size);
    const [sbyte, sbit] = this.addr(idx);
    const [ebyte, ebit] = this.addr(idx + size);
    if (sbit == 0 && ebit == 7) {
      const fill = value ? 0 : 0xff;
      this.arr.fill(fill, sbyte, ebyte + 1);
    } else if (sbyte != ebyte) {
      this.fillRange(sbyte, sbit, 8, value);
      this.fillRange(ebyte, 0, ebit + 1, value);
      const lh = 8 - sbit;
      const rh = ebit + 1;
      this.fill(idx + lh, size - lh - rh, value);
    } else {
      this.fillRange(sbyte, sbit, ebit, value);
    }
  }

  check(idx: number, value: boolean): number {
    if (this.offset <= idx) return 0;
    const [byte, bit] = this.addr(idx);
    const bytevalue = value ? 0xff : 0;
    if (bit == 0) {
      let off = 0;
      while (this.arr[off + byte] == bytevalue) off++;
      if (off != 0) return off * 8 + this.check(idx + off * 8, value);
    }

    const v = this.get(idx);
    return v == value ? 1 + this.check(idx + 1, value) : 0;
  }

  push(value: boolean): void { this.set(this.offset++, value) }

  private fillRange(byte: number, sbit: number, ebit: number, value: boolean) {
    let mask = value ? 0 : 0xff;
    for (let i = sbit; i < ebit; i++) {
      if (value) mask |= this.bitmask(i)
      else mask &= ~this.bitmask(i)
    }
    if (value) this.arr[byte] |= mask
    else this.arr[byte] &= mask;
  }

  private ensureSize(size: number) {
    while (size >= this.capacity) this.grow();
  }

  private grow() {
    const ncap = Math.ceil(this.capacity / 4);
    const narr = new Uint8Array(ncap);
    narr.set(this.arr, 0);
    this.arr = narr;
    this.capacity = ncap;
  }

  private bitmask(bit: number) { return 1 << bit }
  private addr(idx: number): [number, number] { return [int(idx / 8), idx % 8] }
}