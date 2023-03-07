import { connectedWalls as connected } from "../../build/board/loops";
import { splitWall, moveWall, mergePoints, deleteWall } from "../../build/board/mutations/walls";
import { lastwall, sectorOfWall } from "../../build/board/query";
import { Entity, EntityType } from "../../build/hitscan";
import { vec2 } from "gl-matrix";
import { IndexedDeck } from "../../utils/collections";
import { cyclic, tuple } from "../../utils/mathutils";
import { Message, MessageHandlerReflective } from "../apis/handler";
import { EditContext } from "./context";
import { invalidateSectorAndWalls } from "./editutils";
import { BoardInvalidate, Commit, EndMove, Flip, Highlight, Move, NamedMessage, Palette, PanRepeat, SetPicnum, Shade, StartMove } from "./messages";
import { MOVE_COPY } from "./tools/transform";


export class WallEnt extends MessageHandlerReflective {
  private static invalidatedSectors = new IndexedDeck<number>();

  constructor(
    public wallId: number,
    private ctx: EditContext,
    public origin = vec2.create(),
    public active = false,
    public connectedWalls = connected(ctx.board(), wallId),
    private valid = true) { super() }

  public StartMove(msg: StartMove) {
    const board = this.ctx.board();
    const wall = board.walls[this.wallId];
    if (this.ctx.state.get(MOVE_COPY)) {
      this.wallId = splitWall(board, this.wallId, wall.x, wall.y, this.ctx.art, this.ctx.refs, this.ctx.api.cloneWall);
      this.connectedWalls = connected(board, this.wallId);
    }
    vec2.set(this.origin, wall.x, wall.y);
    this.active = true;
  }

  private invalidate() {
    WallEnt.invalidatedSectors.clear();
    const cwalls = this.connectedWalls;
    const board = this.ctx.board();
    for (let w of cwalls) {
      let s = sectorOfWall(board, w);
      if (WallEnt.invalidatedSectors.indexOf(s) == -1) {
        invalidateSectorAndWalls(s, board, this.ctx.bus);
        WallEnt.invalidatedSectors.push(s);
      }
    }
  }

  public Move(msg: Move) {
    let x = this.ctx.gridController.snap(this.origin[0] + msg.dx);
    let y = this.ctx.gridController.snap(this.origin[1] + msg.dy);
    if (moveWall(this.ctx.board(), this.wallId, x, y)) {
      this.invalidate();
    }
  }

  public EndMove(msg: EndMove) {
    this.active = false;
    mergePoints(this.ctx.board(), this.wallId, this.ctx.refs);
  }

  public Highlight(msg: Highlight) {
    if (this.active) {
      const board = this.ctx.board();
      for (const w of this.connectedWalls) {
        const p = lastwall(board, w);
        msg.set.add(tuple(2, w));
        msg.set.add(tuple(3, w));
        msg.set.add(tuple(2, p));
      }
    } else {
      msg.set.add(tuple(3, this.wallId));
    }
  }

  public SetPicnum(msg: SetPicnum) {
    let wall = this.ctx.board().walls[this.wallId];
    wall.picnum = msg.picnum;
    this.ctx.bus.handle(new Commit(`Set Wall ${this.wallId} Picnum`));
    this.ctx.bus.handle(new BoardInvalidate(new Entity(this.wallId, EntityType.WALL_POINT)));
  }

  public Shade(msg: Shade) {
    let wall = this.ctx.board().walls[this.wallId];
    let shade = wall.shade;
    if (msg.absolute && shade == msg.value) return;
    if (msg.absolute) wall.shade = msg.value; else wall.shade += msg.value;
    this.ctx.bus.handle(new Commit(`Set Wall ${this.wallId} Shade`, true));
    this.ctx.bus.handle(new BoardInvalidate(new Entity(this.wallId, EntityType.WALL_POINT)));
  }

  public PanRepeat(msg: PanRepeat) {
    let wall = this.ctx.board().walls[this.wallId];
    if (msg.absolute) {
      if (wall.xpanning == msg.xpan && wall.ypanning == msg.ypan && wall.xrepeat == msg.xrepeat && wall.yrepeat == msg.yrepeat) return;
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
    this.ctx.bus.handle(new Commit(`Set Wall ${this.wallId} PanRepeat`, true));
    this.ctx.bus.handle(new BoardInvalidate(new Entity(this.wallId, EntityType.WALL_POINT)));
  }

  public Palette(msg: Palette) {
    let wall = this.ctx.board().walls[this.wallId];
    if (msg.absolute) {
      if (msg.value == wall.pal) return;
      wall.pal = msg.value;
    } else {
      wall.pal = cyclic(wall.pal + msg.value, msg.max);
    }
    this.ctx.bus.handle(new Commit(`Set Wall ${this.wallId} Palette`, true));
    this.ctx.bus.handle(new BoardInvalidate(new Entity(this.wallId, EntityType.WALL_POINT)));
  }

  public Flip(msg: Flip) {
    let wall = this.ctx.board().walls[this.wallId];
    let flip = wall.cstat.xflip + wall.cstat.yflip * 2;
    let nflip = cyclic(flip + 1, 4);
    wall.cstat.xflip = nflip & 1;
    wall.cstat.yflip = (nflip & 2) >> 1;
    this.ctx.bus.handle(new Commit(`Flip Wall ${this.wallId}`, true));
    this.ctx.bus.handle(new BoardInvalidate(new Entity(this.wallId, EntityType.WALL_POINT)));
  }

  public NamedMessage(msg: NamedMessage) {
    if (msg.name == 'delete') {
      deleteWall(this.ctx.board(), this.wallId, this.ctx.refs);
      this.ctx.bus.handle(new Commit(`Delete Wall ${this.wallId}`));
      this.ctx.bus.handle(new BoardInvalidate(null));
    }
  }

  public BoardInvalidate(msg: BoardInvalidate) {
    if (msg.ent == null) this.valid = false;
  }

  public handle(msg: Message) {
    if (this.valid) super.handle(msg);
  }
}
