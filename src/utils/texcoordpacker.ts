// Inspired by https://blackpawn.com/texts/lightmaps/default.html by blackpawn 

export class Rect {
  public w: number;
  public h: number;
  public xoff: number;
  public yoff: number;

  constructor(w: number, h: number, xoff: number = 0, yoff: number = 0) {
    this.w = w;
    this.h = h;
    this.xoff = xoff;
    this.yoff = yoff;
  }
}

export class Packer {
  private p1: Packer;
  private p2: Packer;
  private sized = false;

  constructor(
    private width: number,
    private height: number,
    private wpad = 0,
    private hpad = 0,
    private xoff = 0,
    private yoff = 0) { }

  public pack(w: number, h: number): Rect | undefined {
    if (this.sized) {
      return this.p1?.pack(w, h) ?? this.p2?.pack(w, h);
    } else {
      const nw = w + this.wpad * 2;
      const nh = h + this.hpad * 2;
      const dw = this.width - nw;
      const dh = this.height - nh;
      if (dw < 0 || dh < 0) return undefined;
      else if (dw > dh) this.splitX(nw, nh)
      else this.splitY(nw, nh)
      const xoff = this.xoff + this.wpad;
      const yoff = this.yoff + this.hpad;
      this.sized = true;
      return { w, h, xoff, yoff };
    }
  }

  private splitX(w: number, h: number) {
    if (this.width - w > 0) this.p1 = new Packer(this.width - w, this.height, this.wpad, this.hpad, this.xoff + w, this.yoff);
    if (this.height - h > 0) this.p2 = new Packer(w, this.height - h, this.wpad, this.hpad, this.xoff, this.yoff + h);
  }

  private splitY(w: number, h: number) {
    if (this.width - w > 0) this.p1 = new Packer(this.width - w, h, this.wpad, this.hpad, this.xoff + w, this.yoff);
    if (this.height - h > 0) this.p2 = new Packer(this.width, this.height - h, this.wpad, this.hpad, this.xoff, this.yoff + h);
  }
}