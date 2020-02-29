import { deleteSprite, insertSprite, moveSprite } from "../../build/boardutils";
import { Entity, EntityType } from "../../build/hitscan";
import { ZSCALE } from "../../build/utils";
import * as GLM from "../../libs_js/glmatrix";
import { cyclic, tuple } from "../../utils/mathutils";
import { Message, MessageHandlerReflective } from "../apis/handler";
import { EditContext } from "./context";
import { BoardInvalidate, COMMIT, Flip, Highlight, Move, NamedMessage, Palette, PanRepeat, Rotate, SetPicnum, SetSpriteCstat, Shade, SpriteMode, StartMove } from "./messages";
import { MOVE_COPY } from "./tools/selection";

export class SpriteEnt extends MessageHandlerReflective {

  constructor(
    public spriteId: number,
    private ctx: EditContext,
    public origin = GLM.vec3.create(),
    public origAng = 0,
    private valid = true) { super() }

  public StartMove(msg: StartMove) {
    const board = this.ctx.board();
    let spr = board.sprites[this.spriteId];
    if (this.ctx.state.get(MOVE_COPY)) this.spriteId = insertSprite(board, spr.x, spr.y, spr.z, spr);
    GLM.vec3.set(this.origin, spr.x, spr.z / ZSCALE, spr.y);
    this.origAng = spr.ang;
  }

  public Move(msg: Move) {
    const board = this.ctx.board();
    let x = this.ctx.gridController.snap(this.origin[0] + msg.dx);
    let y = this.ctx.gridController.snap(this.origin[2] + msg.dy);
    let z = this.ctx.gridController.snap(this.origin[1] + msg.dz) * ZSCALE;
    if (moveSprite(board, this.spriteId, x, y, z)) {
      this.ctx.bus.handle(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
    }
  }

  public Rotate(msg: Rotate) {
    const board = this.ctx.board();
    const spr = board.sprites[this.spriteId];
    spr.ang = this.ctx.gridController.snap(spr.ang + msg.da);
    this.ctx.bus.handle(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
  }

  public Highlight(msg: Highlight) {
    msg.set.add(tuple(4, this.spriteId));
  }

  public SetPicnum(msg: SetPicnum) {
    const board = this.ctx.board();
    const sprite = board.sprites[this.spriteId];
    sprite.picnum = msg.picnum;
    this.ctx.bus.handle(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
  }

  public Shade(msg: Shade) {
    const board = this.ctx.board();
    const sprite = board.sprites[this.spriteId];
    const shade = sprite.shade;
    if (msg.absolute && shade == msg.value) return;
    if (msg.absolute) sprite.shade = msg.value; else sprite.shade += msg.value;
    this.ctx.bus.handle(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
  }

  public PanRepeat(msg: PanRepeat) {
    const board = this.ctx.board();
    const sprite = board.sprites[this.spriteId];
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
    this.ctx.bus.handle(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
  }

  public Palette(msg: Palette) {
    const board = this.ctx.board();
    const spr = board.sprites[this.spriteId];
    if (msg.absolute) {
      if (msg.value == spr.pal) return;
      spr.pal = msg.value;
    } else {
      spr.pal = cyclic(spr.pal + msg.value, msg.max);
    }
    this.ctx.bus.handle(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
  }

  public SpriteMode(msg: SpriteMode) {
    const board = this.ctx.board();
    const spr = board.sprites[this.spriteId];
    spr.cstat.type = cyclic(spr.cstat.type + 1, 3);
    this.ctx.bus.handle(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
  }

  public Flip(msg: Flip) {
    const board = this.ctx.board();
    const spr = board.sprites[this.spriteId];
    const flip = spr.cstat.xflip + spr.cstat.yflip * 2;
    const nflip = cyclic(flip + 1, 4);
    spr.cstat.xflip = nflip & 1;
    spr.cstat.yflip = (nflip & 2) >> 1;
    this.ctx.bus.handle(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
  }

  public NamedMessage(msg: NamedMessage) {
    const board = this.ctx.board();
    switch (msg.name) {
      case 'delete':
        deleteSprite(board, this.spriteId);
        this.ctx.bus.handle(COMMIT);
        this.ctx.bus.handle(new BoardInvalidate(null));
        return;
    }
  }

  public BoardInvalidate(msg: BoardInvalidate) {
    if (msg.ent == null) this.valid = false;
  }

  public SetSpriteCstat(msg: SetSpriteCstat) {
    const board = this.ctx.board();
    const spr = board.sprites[this.spriteId];
    const stat = spr.cstat[msg.name];
    spr.cstat[msg.name] = stat ? 0 : 1;
    this.ctx.bus.handle(COMMIT);
    this.ctx.bus.handle(new BoardInvalidate(new Entity(this.spriteId, EntityType.SPRITE)));
  }

  public handle(msg: Message) {
    if (this.valid) super.handle(msg);
  }
}
