import { cyclic, tuple } from "../../../../libs/mathutils";
import * as GLM from "../../../../libs_js/glmatrix";
import { BuildContext } from "../api";
import { deleteSprite, insertSprite, moveSprite } from "../boardutils";
import { MessageHandlerReflective, Message } from "../handlerapi";
import { ZSCALE } from "../utils";
import { Flip, Highlight, Move, NamedMessage, Palette, PanRepeat, SetPicnum, Shade, SpriteMode, StartMove, BoardInvalidate, SetSpriteCstat } from "./messages";
import { MOVE_COPY, MOVE_ROTATE } from "./tools/selection";
import { Entity, EntityType } from "../hitscan";

export class SpriteEnt extends MessageHandlerReflective {

  public static create(id: number) {
    return new SpriteEnt(id);
  }

  constructor(
    public spriteId: number,
    public origin = GLM.vec3.create(),
    public origAng = 0,
    private valid = true) { super() }

  public StartMove(msg: StartMove, ctx: BuildContext) {
    let spr = ctx.board.sprites[this.spriteId];
    if (ctx.state.get(MOVE_COPY)) this.spriteId = insertSprite(ctx.board, spr.x, spr.y, spr.z, spr);
    GLM.vec3.set(this.origin, spr.x, spr.z / ZSCALE, spr.y);
    this.origAng = spr.ang;
  }

  public Move(msg: Move, ctx: BuildContext) {
    if (ctx.state.get(MOVE_ROTATE)) {
      let spr = ctx.board.sprites[this.spriteId];
      spr.ang = ctx.snap(this.origAng + msg.dz);
      ctx.message(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
    } else {
      let x = ctx.snap(this.origin[0] + msg.dx);
      let y = ctx.snap(this.origin[2] + msg.dy);
      let z = ctx.snap(this.origin[1] + msg.dz) * ZSCALE;
      if (moveSprite(ctx.board, this.spriteId, x, y, z)) {
        ctx.message(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
      }
    }
  }

  public Highlight(msg: Highlight, ctx: BuildContext) {
    msg.set.add(tuple(4, this.spriteId));
  }

  public SetPicnum(msg: SetPicnum, ctx: BuildContext) {
    let sprite = ctx.board.sprites[this.spriteId];
    sprite.picnum = msg.picnum;
    ctx.message(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
  }

  public Shade(msg: Shade, ctx: BuildContext) {
    let sprite = ctx.board.sprites[this.spriteId];
    let shade = sprite.shade;
    if (msg.absolute && shade == msg.value) return;
    if (msg.absolute) sprite.shade = msg.value; else sprite.shade += msg.value;
    ctx.message(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
  }

  public PanRepeat(msg: PanRepeat, ctx: BuildContext) {
    let sprite = ctx.board.sprites[this.spriteId];
    if (msg.absolute) {
      if (sprite.xoffset == msg.xpan && sprite.yoffset == msg.ypan && sprite.xrepeat == msg.xrepeat && sprite.yrepeat == msg.yrepeat) return;
      sprite.xoffset = msg.xpan;
      sprite.yoffset = msg.ypan;
      sprite.xrepeat = msg.xrepeat;
      sprite.yrepeat = msg.yrepeat;
    } else {
      sprite.xoffset += msg.xpan;
      sprite.yoffset += msg.ypan;
      sprite.xrepeat += msg.xrepeat;
      sprite.yrepeat += msg.yrepeat;
    }
    ctx.message(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
  }

  public Palette(msg: Palette, ctx: BuildContext) {
    let spr = ctx.board.sprites[this.spriteId];
    if (msg.absolute) {
      if (msg.value == spr.pal) return;
      spr.pal = msg.value;
    } else {
      spr.pal = cyclic(spr.pal + msg.value, msg.max);
    }
    ctx.message(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
  }

  public SpriteMode(msg: SpriteMode, ctx: BuildContext) {
    let spr = ctx.board.sprites[this.spriteId];
    spr.cstat.type = cyclic(spr.cstat.type + 1, 3);
    ctx.message(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
  }

  public Flip(msg: Flip, ctx: BuildContext) {
    let spr = ctx.board.sprites[this.spriteId];
    let flip = spr.cstat.xflip + spr.cstat.yflip * 2;
    let nflip = cyclic(flip + 1, 4);
    spr.cstat.xflip = nflip & 1;
    spr.cstat.yflip = (nflip & 2) >> 1;
    ctx.message(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
  }

  public NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    switch (msg.name) {
      case 'delete':
        deleteSprite(ctx.board, this.spriteId);
        ctx.commit();
        ctx.message(new BoardInvalidate(null));
        return;
    }
  }

  public BoardInvalidate(msg: BoardInvalidate, ctx: BuildContext) {
    if (msg.ent == null) this.valid = false;
  }

  public SetSpriteCstat(msg: SetSpriteCstat, ctx: BuildContext) {
    const spr = ctx.board.sprites[this.spriteId];
    const stat = spr.cstat[msg.name];
    spr.cstat[msg.name] = stat ? 0 : 1;
    ctx.commit();
    ctx.message(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
  }

  public handle(msg: Message, ctx: BuildContext) {
    if (this.valid) super.handle(msg, ctx);
  }
}
