import { addSprite, deleteSprite } from "../../build/board/mutations/internal";
import { moveSpriteX } from "../../build/board/mutations/sprites";
import { isValidSectorId } from "../../build/board/query";
import { Entity, EntityType, Hitscan } from "../../build/hitscan";
import { slope, ZSCALE } from "../../build/utils";
import { vec3 } from "gl-matrix";
import { cyclic, tuple } from "../../utils/mathutils";
import { Message, MessageHandlerReflective } from "../apis/handler";
import { EditContext } from "./context";
import { BoardInvalidate, Commit, EndMove, Flip, Highlight, Move, NamedMessage, Palette, PanRepeat, Rotate, SetPicnum, SetSpriteCstat, Shade, SpriteMode, StartMove } from "./messages";
import { MOVE_COPY } from "./tools/transform";
import { spriteInfo } from "build/sprites";
import { Board, FLOOR_SPRITE } from "build/board/structs";
import { findFirst } from "utils/collections";

export class SpriteEnt extends MessageHandlerReflective {
  private moveActive = false;

  constructor(
    public spriteId: number,
    private ctx: EditContext,
    public origin = vec3.create(),
    public origAng = 0,
    private valid = true) { super() }

  public StartMove(msg: StartMove) {
    this.moveActive = true;
    const board = this.ctx.board();
    const spr = board.sprites[this.spriteId];
    if (this.ctx.state.get(MOVE_COPY)) {
      const newSprite = this.ctx.api.cloneSprite(spr);
      this.spriteId = addSprite(board, newSprite);
    }
    vec3.set(this.origin, spr.x, spr.z / ZSCALE, spr.y);
    this.origAng = spr.ang;
  }

  public EndMove(msg: EndMove) {
    this.moveActive = false;
  }

  public Move(msg: Move) {
    const board = this.ctx.board();
    const hit = findFirst(this.ctx.view.targets(), t => t.entity != null && !t.entity.isSprite(), null);
    if (hit == null) return;
    const [nx, ny, nz] = hit.coords;
    const ent = hit.entity;
    const bottom = ent != null && ent.type != EntityType.CEILING;
    const x = this.ctx.gridController.snap(nx);
    const y = this.ctx.gridController.snap(ny);
    const z = nz + this.zoff(board, bottom);
    if (moveSpriteX(board, this.spriteId, x, y, z, this.ctx.gridController)) {
      this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
    }
    // const board = this.ctx.board();
    // const x = this.ctx.gridController.snap(this.origin[0] + msg.dx);
    // const y = this.ctx.gridController.snap(this.origin[2] + msg.dy);
    // const z = this.ctx.gridController.snap(this.origin[1] + msg.dz) * ZSCALE;
    // if (moveSpriteX(board, this.spriteId, x, y, z, this.ctx.gridController)) {
    //   this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
    // }
  }

  public Rotate(msg: Rotate) {
    const board = this.ctx.board();
    const spr = board.sprites[this.spriteId];
    const nang = msg.absolute ? msg.da : this.ctx.gridController.snap(spr.ang + msg.da + Math.sign(msg.da));
    spr.ang = nang;
    this.ctx.bus.handle(new Commit(`Set Sprite ${this.spriteId} Angle`, true));
    this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
  }

  public Highlight(msg: Highlight) {
    msg.set.add(tuple(4, this.spriteId));
    if (this.moveActive) {
      const sectorId = this.ctx.board().sprites[this.spriteId].sectnum;
      msg.set.add(tuple(0, sectorId))
      msg.set.add(tuple(1, sectorId))
    }
  }

  public SetPicnum(msg: SetPicnum) {
    const board = this.ctx.board();
    const sprite = board.sprites[this.spriteId];
    sprite.picnum = msg.picnum;
    this.ctx.bus.handle(new Commit(`Set Sprite ${this.spriteId} Picnum`));
    this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
  }

  public Shade(msg: Shade) {
    const board = this.ctx.board();
    const sprite = board.sprites[this.spriteId];
    const shade = sprite.shade;
    if (msg.absolute && shade == msg.value) return;
    if (msg.absolute) sprite.shade = msg.value; else sprite.shade += msg.value;
    this.ctx.bus.handle(new Commit(`Set Sprite ${this.spriteId} Shade`, true));
    this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
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
    this.ctx.bus.handle(new Commit(`Set Sprite ${this.spriteId} PanRepeat`, true));
    this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
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
    this.ctx.bus.handle(new Commit(`Set Sprite ${this.spriteId} Palette`, true));
    this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
  }

  public SpriteMode(msg: SpriteMode) {
    const board = this.ctx.board();
    const spr = board.sprites[this.spriteId];
    spr.cstat.type = cyclic(spr.cstat.type + 1, 3);
    this.ctx.bus.handle(new Commit(`Set Sprite ${this.spriteId} Mode`, true));
    this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
  }

  public Flip(msg: Flip) {
    const board = this.ctx.board();
    const spr = board.sprites[this.spriteId];
    const flip = spr.cstat.xflip + spr.cstat.yflip * 2;
    const nflip = cyclic(flip + 1, 4);
    spr.cstat.xflip = nflip & 1;
    spr.cstat.yflip = (nflip & 2) >> 1;
    this.ctx.bus.handle(new Commit(`Flip Sprite ${this.spriteId}`, true));
    this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
  }

  private zoff(board: Board, bottom = true): number {
    const sprite = board.sprites[this.spriteId];
    const sinfo = spriteInfo(board, this.spriteId, this.ctx.art);
    return bottom
      ? sprite.cstat.type == FLOOR_SPRITE ? -1 : (sinfo.hh - sinfo.yo) * ZSCALE
      : sprite.cstat.type == FLOOR_SPRITE ? 1 : -(sinfo.hh + sinfo.yo) * ZSCALE;
  }

  public NamedMessage(msg: NamedMessage) {
    const board = this.ctx.board();
    const sprite = board.sprites[this.spriteId];
    switch (msg.name) {
      case 'delete':
        deleteSprite(board, this.spriteId);
        this.ctx.bus.handle(new Commit(`Delete Sprite ${this.spriteId}`));
        this.ctx.bus.handle(new BoardInvalidate(null));
        return;
      case 'fly': {
        if (!isValidSectorId(board, sprite.sectnum)) return;
        const sector = board.sectors[sprite.sectnum];
        const zoff = this.zoff(board, false);
        sprite.z = zoff + slope(board, sprite.sectnum, sprite.x, sprite.y, sector.ceilingheinum) + sector.ceilingz;
        this.ctx.bus.handle(new Commit(`Fly Sprite ${this.spriteId}`, true));
        this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
        return;
      }
      case 'fall': {
        if (!isValidSectorId(board, sprite.sectnum)) return;
        const sector = board.sectors[sprite.sectnum];
        const zoff = this.zoff(board, true);
        sprite.z = zoff + slope(board, sprite.sectnum, sprite.x, sprite.y, sector.floorheinum) + sector.floorz;
        this.ctx.bus.handle(new Commit(`Fall Sprite ${this.spriteId}`, true));
        this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
        return;
      }
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
    this.ctx.bus.handle(new Commit(`Set Sprite ${this.spriteId} Cstat ${msg.name}`, true));
    this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
  }

  public handle(msg: Message) {
    if (this.valid) super.handle(msg);
  }
}
