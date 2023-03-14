import { vec2, vec3 } from "gl-matrix";
import { ArtInfo, ArtInfoProvider } from "../build/formats/art";
import { ang2vec, posOffRotate, spriteAngle, ZSCALE } from "../build/utils";
import { Board, FLOOR_SPRITE, Sprite } from "./board/structs";

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

}

export class SpriteInfo {
  public x: number;
  public y: number;
  public z: number;
  public w: number;
  public h: number;
  public hw: number;
  public hh: number;
  public ang: number;
  public xo: number;
  public yo: number;
  public xf: boolean;
  public yf: boolean;
  public ztop: number;
  public zbottom: number;
  public onesided: boolean;
}

export function spriteInfo(board: Board, spriteId: number, infos: ArtInfoProvider): SpriteInfo {
  const spr = board.sprites[spriteId];
  const x = spr.x;
  const y = spr.y;
  const z = spr.z / ZSCALE;
  const info = infos.getInfo(spr.picnum);
  const w = (info.w * spr.xrepeat) >> 2;
  const hw = w >> 1;
  const h = (info.h * spr.yrepeat) >> 2;
  const hh = h >> 1;
  const ang = spriteAngle(spr.ang);
  const xo = ((info.attrs.xoff + spr.xoffset) * spr.xrepeat) >> 2;
  const yo = (((info.attrs.yoff + spr.yoffset) * spr.yrepeat) >> 2) + (spr.cstat.realCenter == 1 ? 0 : hh);
  const xf = spr.cstat.xflip == 1;
  const yf = spr.cstat.yflip == 1;
  const ztop = spr.cstat.type == FLOOR_SPRITE ? 0 : hh + yo;
  const zbottom = spr.cstat.type == FLOOR_SPRITE ? 0 : -hh + yo;
  const onesided = spr.cstat.onesided == 1;
  return { x, y, z, w, h, hw, hh, ang, xo, yo, xf, yf, zbottom, ztop, onesided } as SpriteInfo;
}

export function wallSprite(info: SpriteInfo): WallSprite {
  const n = ang2vec(info.ang);
  const mat = posOffRotate(info.x, info.y, info.xo, 0, info.ang);
  const [x1, y1] = vec2.transformMat2d(vec2.create(), [info.hw, 0], mat);
  const [x2, y2] = vec2.transformMat2d(vec2.create(), [-info.hw, 0], mat);
  return new WallSprite(n, info.z + info.ztop, info.z + info.zbottom, x1, y1, x2, y2);
}

export function floorSprite(info: SpriteInfo): FloorSprite {
  const mat = posOffRotate(info.x, info.y, info.xo, info.yo, info.ang);
  const [x1, y1] = vec2.transformMat2d(vec2.create(), [-info.hw, info.hh], mat);
  const [x2, y2] = vec2.transformMat2d(vec2.create(), [info.hw, info.hh], mat);
  const [x3, y3] = vec2.transformMat2d(vec2.create(), [info.hw, -info.hh], mat);
  const [x4, y4] = vec2.transformMat2d(vec2.create(), [-info.hw, -info.hh], mat);
  return new FloorSprite(info.z, x1, y1, x2, y2, x3, y3, x4, y4);
}

export function faceSprite(info: SpriteInfo): FaceSprite {

}