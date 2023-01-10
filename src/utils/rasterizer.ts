import { clamp, int, sign } from "./mathutils";


class BufferParams {
  constructor(public offset: number, public stride: number) { }
}

class TriIntersection {
  public xl = 0;
  public xr = 0;
  public segl = 0;
  public segr = 0;
  private intersecions = false;

  public addIntersect(x: number, seg: number): void {
    if (!this.intersecions) {
      this.xl = x;
      this.segl = seg;
    } else if (this.xl > x) {
      this.xr = this.xl;
      this.segr = this.segl;
      this.xl = x;
      this.segl = seg;
    } else {
      this.xr = x;
      this.segr = seg;
    }
    this.intersecions = true;
  }

  public reset(): void {
    this.intersecions = false;
  }

  public hasIntersections(): boolean {
    return this.intersecions;
  }
}

// export class TexturePixelProvider {

//   private w: number;
//   private h: number;
//   private data: Uint8ClampedArray;

//   constructor(tex:CanvasImageSource) {
//     const texcanvas = document.createElement('canvas');
//     texcanvas.width = tex.width;
//     texcanvas.height = tex.height;
//     const texctx = texcanvas.getContext("2d");
//     texctx!.drawImage(tex, 0, 0);
//     var texData = texctx?.getImageData(0, 0, tex.width, tex.height);
//     this.data = texData!.data;
//     this.w = tex.width;
//     this.h = tex.height;
//   }

//   public get(u: number, w: number): number[] {
//     var x = u * this.w;
//     var y = w * this.h
//     var xf = x % 1;
//     var yf = y % 1;
//     var xi = int(x);
//     var yi = int(y);

//     var x1 = xf < 0.5 ? xi - 1 : xi;
//     var x2 = xf < 0.5 ? xi : xi + 1;
//     var y1 = yf < 0.5 ? yi - 1 : yi;
//     var y2 = yf < 0.5 ? yi : yi + 1;

//     var off11 = this.getOffset(x1, y1);
//     var off12 = this.getOffset(x1, y2);
//     var off21 = this.getOffset(x2, y1);
//     var off22 = this.getOffset(x2, y2);

//     return this.calc(x, y, x1, x2, y1, y2, off11, off21, off12, off22);
//   }

//   private getOffset(x: number, y: number) {
//     x = this.fixX(x);
//     y = this.fixY(y);
//     return (x * this.w + y) * 4;
//   }

//   private calc(x: number, y: number, x1: number, x2: number, y1: number, y2: number, v11: number, v21: number, v12: number, v22: number) {
//     var d = this.data;
//     var wx1 = (x2 + 0.5 - x);
//     var wy1 = (y2 + 0.5 - y);
//     var wx2 = 1 - wx1;
//     var wy2 = 1 - wy1;
//     var w11 = wx1 * wy1;
//     var w12 = wx1 * wy2;
//     var w21 = wx2 * wy1;
//     var w22 = wx2 * wy2;

//     return [
//       d[v11 + 0] * w11 + d[v21 + 0] * w21 + d[v12 + 0] * w12 + d[v22 + 0] * w22,
//       d[v11 + 1] * w11 + d[v21 + 1] * w21 + d[v12 + 1] * w12 + d[v22 + 1] * w22,
//       d[v11 + 2] * w11 + d[v21 + 2] * w21 + d[v12 + 2] * w12 + d[v22 + 2] * w22,
//       d[v11 + 3] * w11 + d[v21 + 3] * w21 + d[v12 + 3] * w12 + d[v22 + 3] * w22
//     ];
//   }

//   private fixX(x: number): number {
//     if (x < 0)
//       return 0;
//     if (x >= this.w)
//       return this.w - 1;
//     return x;
//   }

//   private fixY(y: number): number {
//     if (y < 0)
//       return 0;
//     if (y >= this.h)
//       return this.h - 1;
//     return y;
//   }
// }

function blend(src: Uint8Array, off: number, dst: number[]) {
  var a = dst[3] / 255;
  var b = 1 - a;
  src[off + 0] = src[off + 0] * b + dst[0] * a;
  src[off + 1] = src[off + 1] * b + dst[1] * a;
  src[off + 2] = src[off + 2] * b + dst[2] * a;
  src[off + 3] = 255;
}

class BoundingBox {
  constructor(public minx: number, public miny: number, public maxx: number, public maxy: number) { }
}

export class Rasterizer {

  private img: Uint8Array;
  private shader: (a: number[]) => number[];
  private w: number;
  private h: number;
  private dx: number;
  private dy: number;
  private sx: number;
  private sy: number;
  private reg: number[][];
  private attrs: number[][] = [];
  private attrparams: BufferParams[] = [];

  constructor(img: Uint8Array, w: number, h: number, shader: (a: number[]) => number[]) {
    this.shader = shader;
    this.img = img;
    this.w = w;
    this.h = h;
    this.dx = 1 / w;
    this.dy = 1 / h;
    this.sx = this.dx / 2;
    this.sy = this.dy / 2;
  }

  public bindAttribute(id: number, buf: number[], offset: number, stride: number): void {
    this.attrs[id] = buf;
    this.attrparams[id] = new BufferParams(offset, stride);
  }

  public bindAttributes(startid: number, buf: number[], numattrs: number): void {
    for (let i = 0; i < numattrs; i++)
      this.bindAttribute(startid + i, buf, i, numattrs);
  }

  private getIntersectionsTri(y: number, inter: TriIntersection): TriIntersection {
    const reg = this.reg;
    for (var i = 0; i < 3; i++) {
      const v1 = reg[i];
      const v2 = reg[i == 2 ? 0 : i + 1];

      const dy1 = v1[1] - y;
      const dy2 = v2[1] - y;
      if (dy1 == 0 || dy2 == 0) continue;

      if (sign(dy1) != sign(dy2)) {
        const d = dy1 / (v1[1] - v2[1]);
        const x = v1[0] + d * (v2[0] - v1[0]);
        inter.addIntersect(x, i);
      }
    }

    return inter;
  }

  private allocateRegisters(numverts: number): number[][] {
    const reg = new Array<number[]>(numverts);
    const numattrs = this.attrs.length;
    for (let i = 0; i < numverts; i++) {
      reg[i] = new Array<number>(numattrs);
    }
    return reg;
  }

  public clear(color: number[], d: number): void {
    const _d = 1 - d;
    const data = this.img;
    const end = this.w * this.h * 4;
    for (var i = 0; i < end; i += 4) {
      data[i + 0] = data[i + 0] * d + color[0] * _d;
      data[i + 1] = data[i + 1] * d + color[1] * _d;
      data[i + 2] = data[i + 2] * d + color[2] * _d;
      data[i + 3] = data[i + 3] * d + color[3] * _d;
    }
  }

  public *drawTriangles(indices: number[], start: number = 0, length: number = indices.length): IterableIterator<number[]> {
    const dx = this.dx;
    const dy = this.dy;
    const sx = this.sx;
    const sy = this.sy;
    const numattrs = this.attrs.length;

    this.reg = this.allocateRegisters(3);
    const reg = this.reg;
    const ratrs = new Array<number>(numattrs);
    const latrs = new Array<number>(numattrs);
    const atrs = new Array<number>(numattrs);
    const polygon = [[0, 1], [1, 2], [2, 0]];
    const data = this.img;
    const intersect = new TriIntersection();
    const end = start + length;

    for (let i = start; i < end; i++) {

      for (let a = 0; a < numattrs; a++) {
        const param = this.attrparams[a];
        reg[i % 3][a] = this.attrs[a][param.offset + indices[i] * param.stride];
      }
      if ((i + 1) % 3 != 0) continue;

      const miny = clamp(Math.min(reg[0][1], reg[1][1], reg[2][1]));
      const maxy = clamp(Math.max(reg[0][1], reg[1][1], reg[2][1]));
      let yi = int((miny + sy) / dy);
      let yf = sy + yi * dy;

      while (yf <= maxy) {
        intersect.reset();
        this.getIntersectionsTri(yf, intersect);
        if (intersect.hasIntersections()) {
          const r1 = reg[polygon[intersect.segr][0]];
          const r2 = reg[polygon[intersect.segr][1]];
          const l1 = reg[polygon[intersect.segl][0]];
          const l2 = reg[polygon[intersect.segl][1]];

          const adyr = Math.abs((yf - r1[1]) / (r1[1] - r2[1]));
          const adyl = Math.abs((yf - l1[1]) / (l1[1] - l2[1]));

          for (let a = 0; a < numattrs; a++) {
            ratrs[a] = r1[a] + (r2[a] - r1[a]) * adyr;
            latrs[a] = l1[a] + (l2[a] - l1[a]) * adyl;
          }

          let minx = clamp(intersect.xl);
          let maxx = clamp(intersect.xr);

          let xi = int((minx + sx) / dx);
          let xf = sx + xi * dx;
          while (xf <= maxx) {
            const adx = (xf - intersect.xl) / (intersect.xr - intersect.xl);
            for (var a = 0; a < ratrs.length; a++)
              atrs[a] = latrs[a] + (ratrs[a] - latrs[a]) * adx;

            const px = this.shader(atrs);
            yield px;

            const off = (yi * this.w + xi) * 4;
            blend(data, off, px);
            xi++;
            xf += dx;
          }
        }

        yi++;
        yf += dy;
      }
    }
  }
}



