
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
  private width: number;
  private height: number;
  private wpad: number;
  private hpad: number;
  private xoff: number;
  private yoff: number;
  private sized = false;

  constructor(w: number, h: number, wpad: number = 1, hpad: number = 1, xoff: number = 0, yoff: number = 0) {
    this.width = w;
    this.height = h;
    this.wpad = wpad;
    this.hpad = hpad;
    this.xoff = xoff;
    this.yoff = yoff;
  }

  public pack(rect: Rect): Rect | null {
    if (this.sized) {
      let r: Rect | null = null;
      if (this.p1 != null)
        r = this.p1.pack(rect);
      if (r == null && this.p2 != null)
        r = this.p2.pack(rect);
      return r;
    } else {
      const nw = rect.w + this.wpad * 2;
      const nh = rect.h + this.hpad * 2;
      if (nw <= this.width && nh <= this.height) {
        rect.xoff = this.xoff + this.wpad; rect.yoff = this.yoff + this.hpad;
        this.sized = true;
        if (nw != this.width) {
          this.p1 = new Packer(this.width - nw, nh, this.wpad, this.hpad, this.xoff + nw, this.yoff);
        }
        if (nh != this.height) {
          this.p2 = new Packer(this.width, this.height - nh, this.wpad, this.hpad, this.xoff, this.yoff + nh);
        }
        return rect;
      }
      return null;
    }
  }
}

export class Hull {
  constructor(
    public minx: number,
    public maxx: number,
    public miny: number,
    public maxy: number) { }
}

export function getHull(vtxs: number[][]): Hull {
  let maxx = vtxs[0][0];
  let maxy = vtxs[0][1];
  let minx = vtxs[0][0];
  let miny = vtxs[0][1];
  for (let i = 1; i < vtxs.length; i++) {
    const vtx = vtxs[i];
    minx = Math.min(minx, vtx[0]);
    maxx = Math.max(maxx, vtx[0]);
    miny = Math.min(miny, vtx[1]);
    maxy = Math.max(maxy, vtx[1]);
  }
  return new Hull(minx, maxx, miny, maxy);
}
