import { mat2d, vec2, vec3 } from "gl-matrix";
import { ZSCALE, ang2vec, spriteAngleRad } from "../build/utils";
import { Board } from "./board/structs";
import { ArtInfo } from "./formats/art";
import { deg2rad, orto2d } from "@utils/mathutils";

export class WallSprite {
  constructor(
    public n: vec2,
    public ztop: number,
    public zbottom: number,
    public x1: number,
    public y1: number,
    public x2: number,
    public y2: number,) { }

  coords(): number[] {
    return [
      this.x1, this.y1, this.ztop,
      this.x2, this.y2, this.ztop,
      this.x2, this.y2, this.zbottom,
      this.x1, this.y1, this.zbottom,
    ]
  }

  normal(): vec3 {
    return vec3.fromValues(this.n[0], 0, this.n[1]);
  }
}


export class FloorSprite {
  private static normal = vec3.fromValues(0, 1, 0);

  constructor(
    public z: number,
    public x1: number,
    public y1: number,
    public x2: number,
    public y2: number,
    public x3: number,
    public y3: number,
    public x4: number,
    public y4: number,) { }

  coords(): number[] {
    return [
      this.x1, this.y1, this.z,
      this.x2, this.y2, this.z,
      this.x3, this.y3, this.z,
      this.x4, this.y4, this.z
    ]
  }

  normal(): vec3 {
    return FloorSprite.normal;
  }
}

export class FaceSprite {
  constructor(
    readonly left: number,
    readonly right: number,
    readonly top: number,
    readonly bottom: number,
  ) { }

  coords(): number[] {
    return [
      this.left, this.top, 0,
      this.right, this.top, 0,
      this.right, this.bottom, 0,
      this.left, this.bottom, 0
    ]
  }
}

export class SpriteInfo {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  hw: number;
  hh: number;
  angRad: number;
  xo: number;
  yo: number;
  xf: boolean;
  yf: boolean;
  ztop: number;
  zbottom: number;
  onesided: boolean;
  hscale: number;
  wscale: number;
}

function scale(x: number, scale: number) {
  return (x * scale) >> 2
}

export function spriteInfo(board: Board, spriteId: number, infos: Map<number, ArtInfo>): SpriteInfo {
  const spr = board.sprites[spriteId];
  const x = spr.x;
  const y = spr.y;
  const z = spr.z / ZSCALE;
  const info = infos.get(spr.picnum);
  const wscale = scale(1, spr.xrepeat);
  const w = scale(info.w, spr.xrepeat);
  const hw = w >> 1;
  const hscale = scale(1, spr.xrepeat);
  const h = scale(info.h, spr.yrepeat);
  const hh = h >> 1;
  const angRad = spriteAngleRad(spr.ang);
  const xf = spr.cstat.xflip === 1;
  const yf = spr.cstat.yflip === 1;
  const xoff = info.attrs.xoff + spr.xoffset;
  const yoff = info.attrs.yoff + spr.yoffset;
  const xo = scale(xoff, spr.xrepeat) * (xf ? -1 : 1);
  const yo = scale(yoff, spr.yrepeat) * (yf ? -1 : 1);
  const ztop = (spr.cstat.realCenter === 1 ? hh : h);
  const zbottom = (spr.cstat.realCenter === 1 ? -hh : 0);
  const onesided = spr.cstat.onesided === 1;
  return { x, y, z, w, h, hw, hh, angRad, xo, yo, xf, yf, zbottom, ztop, onesided, wscale, hscale };
}

export function wallSprite(info: SpriteInfo): WallSprite {
  const n = ang2vec(info.angRad);
  const [vx, vy] = orto2d(n[0], n[1]);
  const x1 = info.x + vx * (info.hw + info.xo);
  const y1 = info.y + vy * (info.hw + info.xo);
  const x2 = info.x + vx * (-info.hw + info.xo);
  const y2 = info.y + vy * (-info.hw + info.xo);
  const top = info.z + info.ztop + info.yo;
  const bottom = info.z + info.zbottom + info.yo;
  return new WallSprite(n, top, bottom, x1, y1, x2, y2);
}

function floorSpriteMatrix(x: number, y: number, xo: number, yo: number, ang: number): mat2d {
  const mat = mat2d.create();
  mat2d.translate(mat, mat, [x, y]);
  mat2d.rotate(mat, mat, ang);
  mat2d.scale(mat, mat, [1, -1]);
  mat2d.rotate(mat, mat, deg2rad(-90));
  mat2d.translate(mat, mat, [-xo, -yo]);
  return mat;
}

export function floorSprite(info: SpriteInfo): FloorSprite {
  const mat = floorSpriteMatrix(info.x, info.y, info.xo, -info.yo, info.angRad);
  const [x1, y1] = vec2.transformMat2d(vec2.create(), [-info.hw, info.hh], mat);
  const [x2, y2] = vec2.transformMat2d(vec2.create(), [info.hw, info.hh], mat);
  const [x3, y3] = vec2.transformMat2d(vec2.create(), [info.hw, -info.hh], mat);
  const [x4, y4] = vec2.transformMat2d(vec2.create(), [-info.hw, -info.hh], mat);
  return new FloorSprite(info.z, x1, y1, x2, y2, x3, y3, x4, y4);
}

export function faceSprite(info: SpriteInfo): FaceSprite {
  const left = -info.hw - info.xo;
  const right = info.hw - info.xo;
  const top = info.ztop + info.yo * (info.yf ? -1 : 1);
  const bottom = info.zbottom + info.yo * (info.yf ? -1 : 1);
  return new FaceSprite(left, right, top, bottom);
}