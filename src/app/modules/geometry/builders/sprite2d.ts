import { FACE_SPRITE, WALL_SPRITE } from "../../../../build/board/structs";
import { spriteAngle, ZSCALE } from "../../../../build/utils";
import { vec4 } from "gl-matrix";
import { cyclicPairs } from "../../../../utils/collections";
import { Builders } from "../../../apis/builder";
import { SPRITE_LABEL } from "../../../apis/renderable";
import { RenderablesCacheContext, SPRITE_COLOR } from "../cache";
import { BuildersFactory, SolidBuilder, WireframeBuilder } from "../common";

export class Sprite2dBuilder extends Builders {
  constructor(
    factory: BuildersFactory,
    readonly ang = factory.wireframe('2d'),
    // readonly label = factory.pointSprite('2d').knd(SPRITE_LABEL),
    readonly lines = factory.wireframe('2d'),
    readonly img = factory.solid('2d').knd(SPRITE_LABEL),
  ) { super([ang, img, lines]) }
}

const CIRCLE_SECTIONS = 12;
const CIRCLE_OUT_RADIUS = 96;
const CIRCLE_IN_RADIUS = 80;
function genSpriteMarker(builder: WireframeBuilder, x: number, y: number, z: number, ang: number, color: [number, number, number, number]) {
  builder.mode = WebGLRenderingContext.TRIANGLES;
  vec4.copy(builder.color, color);
  const buff = builder.buff;
  buff.allocate(CIRCLE_SECTIONS * 2 + 4, CIRCLE_SECTIONS * 6 + 6);
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
  const angle = spriteAngle(ang | 0);
  const hw = ((CIRCLE_OUT_RADIUS - CIRCLE_IN_RADIUS) / 2);
  const dx = Math.sin(angle) * hw;
  const dy = Math.cos(angle) * hw;
  const dx1 = Math.sin(angle + Math.PI / 2) * CIRCLE_IN_RADIUS;
  const dy1 = Math.cos(angle + Math.PI / 2) * CIRCLE_IN_RADIUS;
  buff.writePos(off++, x - dx + dx1, z, y - dy + dy1);
  buff.writePos(off++, x + dx + dx1, z, y + dy + dy1);
  buff.writePos(off++, x + dx, z, y + dy);
  buff.writePos(off++, x - dx, z, y - dy);
  off = 0;
  for (const [i1, i2] of cyclicPairs(CIRCLE_SECTIONS)) {
    const off1 = i1 * 2;
    const off2 = i2 * 2;
    buff.writeTriangle(off, off1, off2, off1 + 1);
    buff.writeTriangle(off + 3, off1 + 1, off2, off2 + 1);
    off += 6;
  }
  const vtxoff = CIRCLE_SECTIONS * 2;
  buff.writeQuad(off, vtxoff, vtxoff + 1, vtxoff + 2, vtxoff + 3);
}

function updateSpriteAngle(ctx: RenderablesCacheContext, spriteId: number, builder: WireframeBuilder): WireframeBuilder {
  builder.mode = WebGLRenderingContext.TRIANGLES;
  const board = ctx.board();
  const sprite = board.sprites[spriteId];
  genSpriteMarker(builder, sprite.x, sprite.y, sprite.z / ZSCALE, sprite.ang, ctx.state.get(SPRITE_COLOR));
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

const WALL_SPRITE_LINE_WIDTH = 32;
function updateSpriteLine(ctx: RenderablesCacheContext, spriteId: number, builder: WireframeBuilder) {
  const board = ctx.board();
  const sprite = board.sprites[spriteId];
  if (sprite.picnum == 0 || sprite.cstat.type != WALL_SPRITE) return;
  const info = ctx.art.getInfo(sprite.picnum);
  const w = (info.w * sprite.xrepeat) / 4; const hw = w >> 1;
  const ang = spriteAngle(sprite.ang);
  const dx = Math.sin(ang) * hw;
  const dy = Math.cos(ang) * hw;
  const dxt = Math.sin(ang + Math.PI / 2) * (WALL_SPRITE_LINE_WIDTH / 2);
  const dyt = Math.cos(ang + Math.PI / 2) * (WALL_SPRITE_LINE_WIDTH / 2);
  const x = sprite.x;
  const y = sprite.y;
  const z = sprite.z / ZSCALE;
  vec4.copy(builder.color, ctx.state.get(SPRITE_COLOR));
  builder.mode = WebGLRenderingContext.TRIANGLES;
  const buff = builder.buff;
  buff.allocate(4, 6);
  buff.writePos(0, x - dx + dxt, z, y - dy + dyt);
  buff.writePos(1, x + dx + dxt, z, y + dy + dyt);
  buff.writePos(2, x + dx - dxt, z, y + dy - dyt);
  buff.writePos(3, x - dx - dxt, z, y - dy - dyt);
  buff.writeQuad(0, 0, 1, 2, 3);
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
