import { mat2d, vec2 } from "gl-matrix";
import { getOrDefault } from "ts-utils/collections";
import { deg2rad, orto2d } from "ts-utils/mathutils";
import { ZSCALE, ang2vec, spriteAngleRad } from "../build/utils";
import { Board, FACE_SPRITE, FLOOR_SPRITE, SLOPE_SPRITE, Sprite, WALL_SPRITE } from "./board/structs";
import { ArtInfo, EMPTY_INFO } from "./formats/art";
import { match } from "ts-pattern";

export type WallSpriteCoords = Readonly<Record<'ztop' | 'zbottom' | 'x1' | 'y1' | 'x2' | 'y2', number>>;
export type FloorSpriteCoords = Readonly<Record<'z' | 'x1' | 'y1' | 'x2' | 'y2' | 'x3' | 'y3' | 'x4' | 'y4', number>>;
export type FaceSpriteCoords = Readonly<Record<'left' | 'right' | 'top' | 'bottom', number>>;
export type SpriteInfo = Readonly<
  Record<'x' | 'y' | 'z' | 'w' | 'h' | 'hw' | 'hh' | 'angRad' | 'xo' | 'yo' | 'ztop' | 'zbottom' | 'hscale' | 'wscale', number> &
  Record<'onesided' | 'xf' | 'yf', boolean>>;

type SpriteCoords = WallSpriteCoords | FaceSpriteCoords | FloorSpriteCoords;

export class SpriteDescriptor {
  constructor(
    readonly id: number,
    readonly sprite: Sprite,
    readonly info: SpriteInfo,
    private coords: SpriteCoords,
  ) {
  }

  face(): FaceSpriteCoords {
    if (this.sprite.cstat.type !== FACE_SPRITE) throw new Error();
    return this.coords as FaceSpriteCoords;
  }

  wall(): WallSpriteCoords {
    if (this.sprite.cstat.type !== WALL_SPRITE) throw new Error();
    return this.coords as WallSpriteCoords;
  }

  floor(): FloorSpriteCoords {
    if (this.sprite.cstat.type !== FLOOR_SPRITE) throw new Error();
    return this.coords as FloorSpriteCoords;
  }
}

function scale(x: number, scale: number) {
  return (x * scale) >> 2
}

export function spriteInfo(board: Board, spriteId: number, infos: Map<number, ArtInfo>): SpriteDescriptor {
  const spr = board.sprites[spriteId];
  const x = spr.x;
  const y = spr.y;
  const z = spr.z / ZSCALE;
  const info = getOrDefault(infos, spr.picnum, EMPTY_INFO);
  const wscale = scale(1, spr.xrepeat);
  const hscale = scale(1, spr.xrepeat);
  const w = scale(info.w, spr.xrepeat);
  const h = scale(info.h, spr.yrepeat);
  const hw = scale(info.w >> 1, spr.xrepeat);
  const hh = scale(info.h >> 1, spr.yrepeat);
  const angRad = spriteAngleRad(spr.ang);
  const xf = spr.cstat.xflip === 1;
  const yf = spr.cstat.yflip === 1;
  const xoff = info.attrs.xoff + spr.xoffset;
  const yoff = info.attrs.yoff + spr.yoffset;
  const xo = scale(xoff, spr.xrepeat) * (xf ? -1 : 1);
  const yo = scale(yoff, spr.yrepeat) * (yf ? -1 : 1);
  const ztop = (spr.cstat.realCenter === 1 ? hh : h);
  const zbottom = (spr.cstat.realCenter === 1 ? -h + hh : 0);
  const onesided = spr.cstat.onesided === 1;
  const spriteInfo = { x, y, z, w, h, hw, hh, angRad, xo, yo, xf, yf, zbottom, ztop, onesided, wscale, hscale };
  const coords = match(spr.cstat.type)
    .returnType<SpriteCoords>()
    .with(FACE_SPRITE, () => faceSprite(spriteInfo))
    .with(FLOOR_SPRITE, () => floorSprite(spriteInfo))
    .with(WALL_SPRITE, () => wallSprite(spriteInfo))
    .with(SLOPE_SPRITE, () => floorSprite(spriteInfo))
    .otherwise(() => { throw Error() });
  return new SpriteDescriptor(spriteId, spr, spriteInfo, coords);
}

export function wallSprite(info: SpriteInfo): WallSpriteCoords {
  const n = ang2vec(info.angRad);
  const [vx, vy] = orto2d(n[0], n[1]);
  const x1 = info.x + vx * (info.hw + info.xo);
  const y1 = info.y + vy * (info.hw + info.xo);
  const x2 = info.x + vx * (-info.w + info.hw + info.xo);
  const y2 = info.y + vy * (-info.w + info.hw + info.xo);
  const ztop = info.z + info.ztop + info.yo;
  const zbottom = info.z + info.zbottom + info.yo;
  return { ztop, zbottom, x1, y1, x2, y2 };
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

export function floorSprite(info: SpriteInfo): FloorSpriteCoords {
  const mat = floorSpriteMatrix(info.x, info.y, info.xo, -info.yo, info.angRad);
  const [x1, y1] = vec2.transformMat2d(vec2.create(), [-info.hw, info.hh], mat);
  const [x2, y2] = vec2.transformMat2d(vec2.create(), [info.w - info.hw, info.hh], mat);
  const [x3, y3] = vec2.transformMat2d(vec2.create(), [info.w - info.hw, -info.h + info.hh], mat);
  const [x4, y4] = vec2.transformMat2d(vec2.create(), [-info.hw, -info.h + info.hh], mat);
  const z = info.z;
  return { z, x1, y1, x2, y2, x3, y3, x4, y4 };
}

export function faceSprite(info: SpriteInfo): FaceSpriteCoords {
  const xo = 0;// info.xo;
  const yo = info.yo * (info.yf ? -1 : 1);
  const left = -info.hw - xo;
  const right = info.hw - xo;
  const top = info.ztop + yo;
  const bottom = info.zbottom + yo;
  return { left, right, top, bottom };
}