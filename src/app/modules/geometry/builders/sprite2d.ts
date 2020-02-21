import { ang2vec, spriteAngle, ZSCALE } from "../../../../build/utils";
import { vec3 } from "../../../../libs_js/glmatrix";
import { fastIterator } from "../../../../utils/collections";
import { BuildContext } from "../../../apis/app";
import { Builders } from "../../../apis/builder";
import { text } from "./common";
import { WireframeBuilder, BuildersFactory } from "../common";

export class Sprite2dBuilder extends Builders {
  constructor(
    factory: BuildersFactory,
    readonly ang = factory.wireframe('2d'),
    readonly label = factory.pointSprite('2d')
  ) { super(fastIterator([ang, label])) }
}

export function updateSpriteAngle(ctx: BuildContext, spriteId: number, builder: WireframeBuilder): WireframeBuilder {
  builder.mode = WebGLRenderingContext.TRIANGLES;
  const buff = builder.buff;
  buff.allocate(3, 6);
  const spr = ctx.board.sprites[spriteId];
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

export function updateSprite2d(ctx: BuildContext, sprId: number, builder: Sprite2dBuilder): Sprite2dBuilder {
  builder = builder == null ? new Sprite2dBuilder(ctx.buildersFactory) : builder;
  const sprite = ctx.board.sprites[sprId];
  text(builder.label, sprId + "", sprite.x, sprite.y, sprite.z / ZSCALE - 1024, 8, 8, ctx.art.get(-2));
  updateSpriteAngle(ctx, sprId, builder.ang);
  return builder;
}
