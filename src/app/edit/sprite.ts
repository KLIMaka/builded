import { BoardContext, EngineContext } from "app/apis/engine";
import { vec3 } from "gl-matrix";
import { MessageHandlerReflective } from "../apis/handler";
import { PanRepeat, Rotate, Shade, SpriteMode } from "./messages";
import { cyclic } from "ts-utils/mathutils";

export class SpriteEnt extends MessageHandlerReflective {
  private moveActive = false;

  constructor(
    private spriteId: number,
    private boardCtx: BoardContext,
    private engine: EngineContext,
    private origin = vec3.create(),
    private origAng = 0,
    private valid = true) { super() }

  // StartMove(msg: StartMove) {
  //   this.moveActive = true;
  //   const board = this.ctx.board();
  //   const spr = board.sprites[this.spriteId];
  //   if (this.ctx.state.get(MOVE_COPY)) {
  //     const newSprite = this.ctx.api.cloneSprite(spr);
  //     this.spriteId = addSprite(board, newSprite);
  //   }
  //   vec3.set(this.origin, spr.x, spr.z / ZSCALE, spr.y);
  //   this.origAng = spr.ang;
  // }

  // EndMove(msg: EndMove) {
  //   this.moveActive = false;
  // }

  // Move(msg: Move) {
  //   const board = this.ctx.board();
  //   const hit = findFirst(this.ctx.view.targets(), t => t.entity != null && !t.entity.isSprite(), null);
  //   if (hit == null) return;
  //   const [nx, ny, nz] = hit.coords;
  //   const ent = hit.entity;
  //   const bottom = ent != null && ent.type != EntityType.CEILING;
  //   const x = this.ctx.gridController.snap(nx);
  //   const y = this.ctx.gridController.snap(ny);
  //   const z = nz + this.zoff(board, bottom);
  //   if (moveSpriteX(board, this.spriteId, x, y, z, this.ctx.gridController)) {
  //     this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
  //   }
  //   // const board = this.ctx.board();
  //   // const x = this.ctx.gridController.snap(this.origin[0] + msg.dx);
  //   // const y = this.ctx.gridController.snap(this.origin[2] + msg.dy);
  //   // const z = this.ctx.gridController.snap(this.origin[1] + msg.dz) * ZSCALE;
  //   // if (moveSpriteX(board, this.spriteId, x, y, z, this.ctx.gridController)) {
  //   //   this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
  //   // }
  // }

  Rotate(msg: Rotate) {
    this.boardCtx.modifyBoard(`Set sprite ${this.spriteId} angle`, board => {
      const spr = board.sprites[this.spriteId];
      const nang = msg.absolute ? msg.da : spr.ang + msg.da;
      spr.ang = nang;
    });
  }

  // Highlight(msg: Highlight) {
  //   msg.set.add(tuple(4, this.spriteId));
  //   if (this.moveActive) {
  //     const sectorId = this.ctx.board().sprites[this.spriteId].sectnum;
  //     msg.set.add(tuple(0, sectorId))
  //     msg.set.add(tuple(1, sectorId))
  //   }
  // }

  // SetPicnum(msg: SetPicnum) {
  //   const board = this.ctx.board();
  //   const sprite = board.sprites[this.spriteId];
  //   sprite.picnum = msg.picnum;
  //   this.ctx.bus.handle(new Commit(`Set Sprite ${this.spriteId} Picnum`));
  //   this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
  // }

  Shade(msg: Shade) {
    this.boardCtx.modifyBoard(`Set sprite ${this.spriteId} shade`, board => {
      const sprite = board.sprites[this.spriteId];
      const shade = sprite.shade;
      if (msg.absolute && shade === msg.value) return;
      if (msg.absolute) sprite.shade = msg.value; else sprite.shade += msg.value;
    });
  }

  PanRepeat(msg: PanRepeat) {
    this.boardCtx.modifyBoard(`Set sprite ${this.spriteId} pan/repeat`, board => {
      const sprite = board.sprites[this.spriteId];
      if (msg.absolute) {
        if (sprite.xoffset === msg.xpan && sprite.yoffset === msg.ypan && sprite.xrepeat === msg.xrepeat && sprite.yrepeat === msg.yrepeat) return;
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
    });
  }

  // Palette(msg: Palette) {
  //   const board = this.ctx.board();
  //   const spr = board.sprites[this.spriteId];
  //   if (msg.absolute) {
  //     if (msg.value == spr.pal) return;
  //     spr.pal = msg.value;
  //   } else {
  //     spr.pal = cyclic(spr.pal + msg.value, msg.max);
  //   }
  //   this.ctx.bus.handle(new Commit(`Set Sprite ${this.spriteId} Palette`, true));
  //   this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
  // }

  SpriteMode(msg: SpriteMode) {
    this.boardCtx.modifyBoard(`Set sprite ${this.spriteId} mode`, board => {
      const spr = board.sprites[this.spriteId];
      spr.cstat.type = cyclic(spr.cstat.type + 1, 3);
    });
  }

  // Flip(msg: Flip) {
  //   const board = this.ctx.board();
  //   const spr = board.sprites[this.spriteId];
  //   const flip = spr.cstat.xflip + spr.cstat.yflip * 2;
  //   const nflip = cyclic(flip + 1, 4);
  //   spr.cstat.xflip = nflip & 1;
  //   spr.cstat.yflip = (nflip & 2) >> 1;
  //   this.ctx.bus.handle(new Commit(`Flip Sprite ${this.spriteId}`, true));
  //   this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
  // }

  // private zoff(board: Board, bottom = true): number {
  //   const sprite = board.sprites[this.spriteId];
  //   const sinfo = spriteInfo(board, this.spriteId, this.ctx.art.get());
  //   return bottom
  //     ? sprite.cstat.type == FLOOR_SPRITE ? -1 : (sinfo.hh - sinfo.yo) * ZSCALE
  //     : sprite.cstat.type == FLOOR_SPRITE ? 1 : -(sinfo.hh + sinfo.yo) * ZSCALE;
  // }

  // NamedMessage(msg: NamedMessage) {
  //   const board = this.ctx.board();
  //   const sprite = board.sprites[this.spriteId];
  //   switch (msg.name) {
  //     case 'delete':
  //       deleteSprite(board, this.spriteId);
  //       this.ctx.bus.handle(new Commit(`Delete Sprite ${this.spriteId}`));
  //       this.ctx.bus.handle(new BoardInvalidate(null));
  //       return;
  //     case 'fly': {
  //       if (!isValidSectorId(board, sprite.sectnum)) return;
  //       const sector = board.sectors[sprite.sectnum];
  //       const zoff = this.zoff(board, false);
  //       sprite.z = zoff + slope(board, sprite.sectnum, sprite.x, sprite.y, sector.ceilingheinum) + sector.ceilingz;
  //       this.ctx.bus.handle(new Commit(`Fly Sprite ${this.spriteId}`, true));
  //       this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
  //       return;
  //     }
  //     case 'fall': {
  //       if (!isValidSectorId(board, sprite.sectnum)) return;
  //       const sector = board.sectors[sprite.sectnum];
  //       const zoff = this.zoff(board, true);
  //       sprite.z = zoff + slope(board, sprite.sectnum, sprite.x, sprite.y, sector.floorheinum) + sector.floorz;
  //       this.ctx.bus.handle(new Commit(`Fall Sprite ${this.spriteId}`, true));
  //       this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
  //       return;
  //     }
  //   }
  // }

  // BoardInvalidate(msg: BoardInvalidate) {
  //   if (msg.ent == null) this.valid = false;
  // }

  // SetSpriteCstat(msg: SetSpriteCstat) {
  //   const board = this.ctx.board();
  //   const spr = board.sprites[this.spriteId];
  //   const stat = spr.cstat[msg.name];
  //   spr.cstat[msg.name] = stat ? 0 : 1;
  //   this.ctx.bus.handle(new Commit(`Set Sprite ${this.spriteId} Cstat ${msg.name}`, true));
  //   this.ctx.bus.handle(new BoardInvalidate(Entity.sprite(this.spriteId)));
  // }

  // handle(msg: Message) {
  //   if (this.valid) super.handle(msg);
  // }
}
