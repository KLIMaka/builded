import { BoardContext } from "app/apis/engine";
import { BuildReferenceTrackerImpl } from "app/modules/default/reftracker";
import { vec2 } from "gl-matrix";
import { deleteWall, mergePoints, moveWall } from "../../build/board/mutations/walls";
import { cyclic } from "../../utils/mathutils";
import { Message, MessageHandlerReflective } from "../apis/handler";
import { BoardInvalidate, EndMove, Flip, Move, NamedMessage, Palette, PanRepeat, SetPicnum, Shade, StartMove } from "./messages";


export class WallEnt extends MessageHandlerReflective {

  constructor(
    private wallId: number,
    private boardCtx: BoardContext,
    private origin = vec2.create(),
    private active = false,
    private valid = true) { super() }

  StartMove(msg: StartMove) {
    const board = this.boardCtx.board.get();
    const wall = board.walls[this.wallId];
    // if (this.ctx.state.get(MOVE_COPY)) {
    //   this.wallId = splitWall(board, this.wallId, wall.x, wall.y, this.ctx.art, this.ctx.refs, this.ctx.api.cloneWall);
    // }
    vec2.set(this.origin, wall.x, wall.y);
    this.active = true;
  }

  Move(msg: Move) {
    let x = this.boardCtx.grid.snap(this.origin[0] + msg.dx);
    let y = this.boardCtx.grid.snap(this.origin[1] + msg.dy);
    this.boardCtx.modifyBoard(`Set Wall ${this.wallId} position`, board => moveWall(board, this.wallId, x, y));
  }

  EndMove(msg: EndMove) {
    this.active = false;
    this.boardCtx.modifyBoard(`Set Wall ${this.wallId} position`, board => mergePoints(board, this.wallId, new BuildReferenceTrackerImpl()));
  }

  // Highlight(msg: Highlight) {
  //   if (this.active) {
  //     const board = this.board;
  //     for (const w of this.connectedWalls) {
  //       const p = lastwall(board, w);
  //       msg.set.add(tuple(2, w));
  //       msg.set.add(tuple(3, w));
  //       msg.set.add(tuple(2, p));
  //     }
  //   } else {
  //     msg.set.add(tuple(3, this.wallId));
  //   }
  // }

  SetPicnum(msg: SetPicnum) {
    this.boardCtx.modifyBoard(`Set Wall ${this.wallId} Picnum`, board => {
      let wall = board.walls[this.wallId];
      wall.picnum = msg.picnum;
    })
  }

  Shade(msg: Shade) {
    this.boardCtx.modifyBoard(`Set Wall ${this.wallId} Shade`, board => {
      let wall = board.walls[this.wallId];
      if (msg.absolute) wall.shade = msg.value;
      else wall.shade += msg.value;
    });
  }

  PanRepeat(msg: PanRepeat) {
    this.boardCtx.modifyBoard(`Set Wall ${this.wallId} PanRepeat`, board => {
      const wall = board.walls[this.wallId];
      if (msg.absolute) {
        wall.xpanning = msg.xpan;
        wall.ypanning = msg.ypan;
        wall.xrepeat = msg.xrepeat;
        wall.yrepeat = msg.yrepeat;
      } else {
        wall.xpanning += msg.xpan;
        wall.ypanning += msg.ypan;
        wall.xrepeat += msg.xrepeat;
        wall.yrepeat += msg.yrepeat;
      }
    })
  }

  Palette(msg: Palette) {
    this.boardCtx.modifyBoard(`Set Wall ${this.wallId} Palette`, board => {
      const wall = board.walls[this.wallId];
      if (msg.absolute) wall.pal = msg.value;
      else wall.pal = cyclic(wall.pal + msg.value, msg.max);
    });
  }

  Flip(msg: Flip) {
    this.boardCtx.modifyBoard(`Flip Wall ${this.wallId}`, board => {
      const wall = board.walls[this.wallId];
      const flip = wall.cstat.xflip + wall.cstat.yflip * 2;
      const nflip = cyclic(flip + 1, 4);
      wall.cstat.xflip = nflip & 1;
      wall.cstat.yflip = (nflip & 2) >> 1;
    })
  }

  NamedMessage(msg: NamedMessage) {
    if (msg.name === 'delete') {
      this.boardCtx.modifyBoard(`Delete Wall ${this.wallId}`, board => {
        deleteWall(board, this.wallId, new BuildReferenceTrackerImpl());
      })
    }
  }

  BoardInvalidate(msg: BoardInvalidate) {
    if (msg.ent == null) this.valid = false;
  }

  handle(msg: Message) {
    if (this.valid) super.handle(msg);
  }
}
