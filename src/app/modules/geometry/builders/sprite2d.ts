import { ang2vec, spriteAngle, ZSCALE } from "../../../../build/utils";
import { vec3 } from "../../../../libs_js/glmatrix";
import { Builders } from "../../../apis/builder";
import { SPRITE_LABEL } from "../../../apis/renderable";
import { RenderablesCacheContext } from "../cache";
import { BuildersFactory, SolidBuilder, WireframeBuilder } from "../common";

export class Sprite2dBuilder extends Builders {
  constructor(
    factory: BuildersFactory,
    readonly ang = factory.wireframe('2d'),
    // readonly label = factory.pointSprite('2d').knd(SPRITE_LABEL),
    readonly img = factory.solid('2d').knd(SPRITE_LABEL),
  ) { super([ang, img]) }
}

export function updateSpriteAngle(ctx: RenderablesCacheContext, spriteId: number, builder: WireframeBuilder): WireframeBuilder {
  builder.mode = WebGLRenderingContext.TRIANGLES;
  const board = ctx.board();
  const buff = builder.buff;
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
  return builder;
}

export function updateSpriteImage(ctx: RenderablesCacheContext, spriteId: number, builder: SolidBuilder) {
  const board = ctx.board();
  const sprite = board.sprites[spriteId];
  if (sprite.picnum == 0 || sprite.cstat.type != 0) return;
  builder.tex = ctx.art.get(sprite.picnum);
  const buff = builder.buff;
  const x = sprite.x;
  const y = sprite.y;
  const z = sprite.z / ZSCALE;
  const pal = sprite.pal;
  const shade = sprite.shade;
  const info = ctx.art.getInfo(sprite.picnum);
  const w = info.w * 8;
  const h = info.h * 8;
  buff.allocate(4, 6);
  buff.writePos(0, x - w / 2, z, y);
  buff.writePos(1, x - w / 2, z, y - h);
  buff.writePos(2, x + w / 2, z, y - h);
  buff.writePos(3, x + w / 2, z, y);
  buff.writeTcLighting(0, 0, 1, pal, shade);
  buff.writeTcLighting(1, 0, 0, pal, shade);
  buff.writeTcLighting(2, 1, 0, pal, shade);
  buff.writeTcLighting(3, 1, 1, pal, shade);
  buff.writeQuad(0, 0, 1, 2, 3);
}

export function updateSprite2d(ctx: RenderablesCacheContext, sprId: number, builder: Sprite2dBuilder): Sprite2dBuilder {
  builder = builder == null ? new Sprite2dBuilder(ctx.factory) : builder;
  const board = ctx.board();
  const sprite = board.sprites[sprId];
  // text(builder.label, sprId + "", sprite.x, sprite.y, sprite.z / ZSCALE, 8, 8, ctx.art.get(-2));
  updateSpriteAngle(ctx, sprId, builder.ang);
  updateSpriteImage(ctx, sprId, builder.img);
  return builder;
}
