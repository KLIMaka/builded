import { SpriteInfo, faceSprite, floorSprite, spriteInfo, wallSprite } from "build/sprites";
import { vec2, vec4 } from "gl-matrix";
import { FACE_SPRITE, FLOOR_SPRITE, WALL_SPRITE } from "../../../../../build/board/structs";
import { ZSCALE, ang2vec, spriteAngleRad } from "../../../../../build/utils";
import { Builders } from "../../../../apis/builder";
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

function genFaceWireframe(x: number, y: number, z: number, normals: number[], builder: WireframeBuilder) {
  const buff = builder.buff;
  buff.allocate(4, 8);
  buff.writePos(0, x, z, y);
  buff.writePos(1, x, z, y);
  buff.writePos(2, x, z, y);
  buff.writePos(3, x, z, y);
  buff.writeNormal(0, normals[0], normals[1], normals[2]);
  buff.writeNormal(1, normals[3], normals[4], normals[5]);
  buff.writeNormal(2, normals[6], normals[7], normals[8]);
  buff.writeNormal(3, normals[9], normals[10], normals[11]);
  buff.writeLine(0, 0, 1);
  buff.writeLine(2, 1, 2);
  buff.writeLine(4, 2, 3);
  buff.writeLine(6, 3, 0);
}

function fillbuffersForWallSpriteWireframe(sinfo: SpriteInfo, builder: WireframeBuilder) {
  genQuadWireframe(wallSprite(sinfo).coords(), null, builder);
}

function fillbuffersForFloorSpriteWireframe(sinfo: SpriteInfo, builder: WireframeBuilder) {
  genQuadWireframe(floorSprite(sinfo).coords(), null, builder);
}

function fillBuffersForFaceSpriteWireframe(sinfo: SpriteInfo, builder: WireframeBuilder) {
  const sprite = faceSprite(sinfo);
  genFaceWireframe(sinfo.x, sinfo.y, sinfo.z, sprite.coords(), builder);
}

function updateSpriteWireframe(ctx: RenderablesCacheContext, sprId: number, builder: WireframeBuilder): WireframeBuilder {
  const board = ctx.board();
  vec4.set(builder.color, 1, 1, 1, -100);
  const spr = board.sprites[sprId];
  if (/*spr.picnum === 0 ||*/ spr.cstat.invisible) return builder;
  const sinfo = spriteInfo(board, sprId, ctx.textures.art.get());
  builder.type = 'SURFACE';

  if (spr.cstat.type === FACE_SPRITE) {
    builder.type = 'SPRITE';
    fillBuffersForFaceSpriteWireframe(sinfo, builder);
  } else if (spr.cstat.type === WALL_SPRITE) {
    fillbuffersForWallSpriteWireframe(sinfo, builder);
  } else if (spr.cstat.type === FLOOR_SPRITE) {
    fillbuffersForFloorSpriteWireframe(sinfo, builder);
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
  const ang = spriteAngleRad(spr.ang);
  const size = 128;
  const v1 = ang2vec(ang);
  vec2.scale(v1, v1, size);
  const v2 = ang2vec(ang + Math.PI / 2);
  vec2.scale(v2, v2, size / 4);
  buff.writePos(0, x + v1[0], z, y + v1[1]);
  buff.writePos(1, x - v2[0], z, y - v2[1]);
  buff.writePos(2, x + v2[0], z, y + v2[1]);
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