import { ang2vec, spriteAngle, ZSCALE } from "../../../../build/utils";
import { vec3, vec4 } from "../../../../libs_js/glmatrix";
import { Builders } from "../../../apis/builder";
import { SPRITE_LABEL } from "../../../apis/renderable";
import { RenderablesCacheContext } from "../cache";
import { BuildersFactory, SolidBuilder, WireframeBuilder } from "../common";
import { WALL_SPRITE, FACE_SPRITE } from "../../../../build/structs";
import { cyclicPairs } from "../../../../utils/collections";

export class Sprite2dBuilder extends Builders {
  constructor(
    factory: BuildersFactory,
    readonly ang = factory.wireframe('2d'),
    // readonly label = factory.pointSprite('2d').knd(SPRITE_LABEL),
    readonly lines = factory.wireframe('2d'),
    readonly img = factory.solid('2d').knd(SPRITE_LABEL),
  ) { super([ang, img, lines]) }
}

const CIRCLE_SECTIONS = 8;
const CIRCLE_OUT_RADIUS = 48;
const CIRCLE_IN_RADIUS = 32;
function genSpriteMarker(builder: WireframeBuilder, x: number, y: number, z: number, ang: number, color: [number, number, number, number]) {
  builder.mode = WebGLRenderingContext.TRIANGLES;
  vec4.copy(builder.color, color);
  const buff = builder.buff;
  buff.allocate(CIRCLE_SECTIONS * 2, CIRCLE_SECTIONS * 6);
  let off = 0;
  for (let i = 0; i < CIRCLE_SECTIONS; i++) {
    const ang = Math.PI * 2 * (i / CIRCLE_SECTIONS);
    const dxo = Math.sin(ang) * CIRCLE_OUT_RADIUS;
    const dxi = Math.sin(ang) * CIRCLE_IN_RADIUS;
    const dyo = Math.cos(ang) * CIRCLE_OUT_RADIUS;
    const dyi = Math.cos(ang) * CIRCLE_IN_RADIUS;
    buff.writePos(off + 0, x + dxo, z, y + dyo);
    buff.writePos(off + 1, x + dxi, z, y + dyi);
    off += 2;
  }
  off = 0;
  for (const [i1, i2] of cyclicPairs(CIRCLE_SECTIONS)) {
    const off1 = i1 * 2;
    const off2 = i2 * 2;
    buff.writeTriangle(off, off1, off2, off1 + 1);
    buff.writeTriangle(off + 3, off1 + 1, off2, off2 + 1);
    off += 6;
  }
}

function updateSpriteAngle(ctx: RenderablesCacheContext, spriteId: number, builder: WireframeBuilder): WireframeBuilder {
  builder.mode = WebGLRenderingContext.TRIANGLES;
  const board = ctx.board();
  const sprite = board.sprites[spriteId];
  genSpriteMarker(builder, sprite.x, sprite.y, sprite.z / ZSCALE, sprite.ang, [1, 1, 1, 1]);
  return builder;
}

function updateSpriteImage(ctx: RenderablesCacheContext, spriteId: number, builder: SolidBuilder) {
  const board = ctx.board();
  const sprite = board.sprites[spriteId];
  if (sprite.picnum == 0 || sprite.cstat.type != FACE_SPRITE) return;
  builder.tex = ctx.art.get(sprite.picnum);
  const buff = builder.buff;
  const x = sprite.x;
  const y = sprite.y;
  const z = sprite.z / ZSCALE;
  const pal = sprite.pal;
  const shade = -127;
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

function updateSpriteLine(ctx: RenderablesCacheContext, spriteId: number, builder: WireframeBuilder) {
  const board = ctx.board();
  const sprite = board.sprites[spriteId];
  if (sprite.picnum == 0 || sprite.cstat.type != WALL_SPRITE) return;
  const info = ctx.art.getInfo(sprite.picnum);
  const w = (info.w * sprite.xrepeat) / 4; const hw = w >> 1;
  const ang = spriteAngle(sprite.ang);
  const dx = Math.sin(ang) * hw;
  const dy = Math.cos(ang) * hw;
  const dxt = Math.sin(ang + Math.PI / 2) * 32;
  const dyt = Math.cos(ang + Math.PI / 2) * 32;
  const x = sprite.x;
  const y = sprite.y;
  const z = sprite.z / ZSCALE;
  vec4.set(builder.color, 0, 0, 1, 1);
  builder.mode = WebGLRenderingContext.TRIANGLES;
  const buff = builder.buff;
  buff.allocate(4, 6);
  buff.writePos(0, x - dx, z, y - dy);
  buff.writePos(1, x + dx, z, y + dy);
  buff.writePos(2, x + dx + dxt, z, y + dy + dyt);
  buff.writePos(3, x - dx + dxt, z, y - dy + dyt);
  buff.writeQuad(0, 3, 2, 1, 0);
}

export function updateSprite2d(ctx: RenderablesCacheContext, sprId: number, builder: Sprite2dBuilder): Sprite2dBuilder {
  builder = builder == null ? new Sprite2dBuilder(ctx.factory) : builder;
  const board = ctx.board();
  const sprite = board.sprites[sprId];
  // text(builder.label, sprId + "", sprite.x, sprite.y, sprite.z / ZSCALE, 8, 8, ctx.art.get(-2));
  updateSpriteAngle(ctx, sprId, builder.ang);
  updateSpriteImage(ctx, sprId, builder.img);
  updateSpriteLine(ctx, sprId, builder.lines);
  return builder;
}
