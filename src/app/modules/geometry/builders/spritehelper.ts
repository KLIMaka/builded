import { FACE_SPRITE, FLOOR_SPRITE, WALL_SPRITE } from "../../../../build/board/structs";
import { ang2vec, spriteAngle, ZSCALE } from "../../../../build/utils";
import { vec3, vec4 } from "gl-matrix";
import { Builders } from "../../../apis/builder";
import { RenderablesCacheContext } from "../cache";
import { BuildersFactory, Type, WireframeBuilder } from "../common";

export class SpriteHelperBuillder extends Builders {
  constructor(
    factory: BuildersFactory,
    readonly wire = factory.wireframe('helper'),
    readonly angle = factory.wireframe('helper')
  ) { super([wire, angle]) }
}

function genQuadWireframe(coords: number[], normals: number[], builder: WireframeBuilder) {
  const buff = builder.buff;
  buff.allocate(4, 8);
  const [x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4] = coords;
  buff.writePos(0, x1, z1, y1);
  buff.writePos(1, x2, z2, y2);
  buff.writePos(2, x3, z3, y3);
  buff.writePos(3, x4, z4, y4);
  if (normals != null) {
    buff.writeNormal(0, normals[0], normals[1], 0);
    buff.writeNormal(1, normals[2], normals[3], 0);
    buff.writeNormal(2, normals[4], normals[5], 0);
    buff.writeNormal(3, normals[6], normals[7], 0);
  }
  buff.writeLine(0, 0, 1);
  buff.writeLine(2, 1, 2);
  buff.writeLine(4, 2, 3);
  buff.writeLine(6, 3, 0);
}

function fillbuffersForWallSpriteWireframe(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, ang: number, builder: WireframeBuilder) {
  const dx = Math.sin(ang) * hw;
  const dy = Math.cos(ang) * hw;
  genQuadWireframe([
    x - dx, y - dy, z - hh + yo,
    x + dx, y + dy, z - hh + yo,
    x + dx, y + dy, z + hh + yo,
    x - dx, y - dy, z + hh + yo],
    null, builder);
}

function fillbuffersForFloorSpriteWireframe(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, ang: number, builder: WireframeBuilder) {
  const dwx = Math.sin(ang) * hw;
  const dwy = Math.cos(ang) * hw;
  const dhx = Math.sin(ang + Math.PI / 2) * hh;
  const dhy = Math.cos(ang + Math.PI / 2) * hh;
  genQuadWireframe([
    x - dwx - dhx, y - dwy - dhy, z,
    x + dwx - dhx, y + dwy - dhy, z,
    x + dwx + dhx, y + dwy + dhy, z,
    x - dwx + dhx, y - dwy + dhy, z],
    null, builder);
}

function fillBuffersForFaceSpriteWireframe(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, builder: WireframeBuilder) {
  genQuadWireframe([
    x, y, z,
    x, y, z,
    x, y, z,
    x, y, z
  ], [
    -hw + xo, +hh + yo,
    +hw + xo, +hh + yo,
    +hw + xo, -hh + yo,
    -hw + xo, -hh + yo],
    builder);
}

function updateSpriteWireframe(ctx: RenderablesCacheContext, sprId: number, builder: WireframeBuilder): WireframeBuilder {
  const board = ctx.board();
  vec4.set(builder.color, 1, 1, 1, -100);
  const spr = board.sprites[sprId];
  if (spr.picnum == 0 || spr.cstat.invisible) return builder;

  const x = spr.x; const y = spr.y; const z = spr.z / ZSCALE;
  const info = ctx.art.getInfo(spr.picnum);
  const w = (info.w * spr.xrepeat) / 4; const hw = w >> 1;
  const h = (info.h * spr.yrepeat) / 4; const hh = h >> 1;
  const ang = spriteAngle(spr.ang);
  const xo = (info.attrs.xoff * spr.xrepeat) / 4;
  const yo = (info.attrs.yoff * spr.yrepeat) / 4 + (spr.cstat.realCenter ? 0 : hh);

  if (spr.cstat.type == FACE_SPRITE) {
    builder.type = Type.SPRITE;
    fillBuffersForFaceSpriteWireframe(x, y, z, xo, yo, hw, hh, builder);
  } else if (spr.cstat.type == WALL_SPRITE) {
    builder.type = Type.SURFACE;
    fillbuffersForWallSpriteWireframe(x, y, z, xo, yo, hw, hh, ang, builder);
  } else if (spr.cstat.type == FLOOR_SPRITE) {
    builder.type = Type.SURFACE;
    fillbuffersForFloorSpriteWireframe(x, y, z, xo, yo, hw, hh, ang, builder);
  }
  return builder;
}

function updateSpriteAngle(ctx: RenderablesCacheContext, spriteId: number, renderable: WireframeBuilder): WireframeBuilder {
  renderable.mode = WebGLRenderingContext.TRIANGLES;
  const buff = renderable.buff;
  const board = ctx.board();
  buff.allocate(3, 6);
  const spr = board.sprites[spriteId];
  const x = spr.x, y = spr.y, z = spr.z / ZSCALE;
  const ang = spriteAngle(spr.ang);
  const size = 128;
  const vec1 = ang2vec(ang);
  vec3.scale(vec1, vec1, size);
  const vec2 = ang2vec(ang + Math.PI / 2);
  vec3.scale(vec2, vec2, size / 4);
  buff.writePos(0, x + vec1[0], z, y + vec1[2]);
  buff.writePos(1, x + vec2[0], z, y + vec2[2]);
  buff.writePos(2, x - vec2[0], z, y - vec2[2]);
  buff.writeTriangle(0, 0, 1, 2);
  buff.writeTriangle(3, 2, 1, 0);
  return renderable;
}

export function updateSpriteHelper(ctx: RenderablesCacheContext, sprId: number, builder: SpriteHelperBuillder): SpriteHelperBuillder {
  builder = builder == null ? new SpriteHelperBuillder(ctx.factory) : builder;
  updateSpriteWireframe(ctx, sprId, builder.wire);
  updateSpriteAngle(ctx, sprId, builder.angle);
  return builder;
}