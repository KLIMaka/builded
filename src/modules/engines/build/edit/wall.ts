import { cyclic, tuple } from "../../../../libs/mathutils";
import * as GLM from "../../../../libs_js/glmatrix";
import { Deck, IndexedDeck } from "../../../collections";
import { BuildContext } from "../api";
import { connectedWalls, deleteWall, lastwall, mergePoints, moveWall, splitWall } from "../boardutils";
import { MessageHandlerReflective, Message } from "../handlerapi";
import { Board } from "../structs";
import { sectorOfWall } from "../utils";
import { invalidateSectorAndWalls } from "./editutils";
import { EndMove, Flip, Highlight, Move, NamedMessage, Palette, PanRepeat, SetPicnum, Shade, StartMove, BoardInvalidate } from "./messages";
import { MOVE_COPY } from "./tools/selection";
import { Entity, EntityType } from "../hitscan";

function collectConnectedWalls(board: Board, wallId: number) {
  let result = new Deck<number>();
  connectedWalls(board, wallId, result);
  return result;
}

export class WallEnt extends MessageHandlerReflective {
  private static invalidatedSectors = new IndexedDeck<number>();

  public static create(board: Board, id: number) {
    return new WallEnt(board, id);
  }

  constructor(
    board: Board,
    public wallId: number,
    public origin = GLM.vec2.create(),
    public active = false,
    public connectedWalls = collectConnectedWalls(board, wallId),
    private valid = true) { super() }

  public StartMove(msg: StartMove, ctx: BuildContext) {
    let wall = ctx.board.walls[this.wallId];
    if (ctx.state.get(MOVE_COPY)) {
      this.wallId = splitWall(ctx.board, this.wallId, wall.x, wall.y, ctx.art, ctx.refs);
      this.connectedWalls = collectConnectedWalls(ctx.board, this.wallId);
    }
    GLM.vec2.set(this.origin, wall.x, wall.y);
    this.active = true;
  }

  private invalidate(ctx: BuildContext) {
    WallEnt.invalidatedSectors.clear();
    let cwalls = this.connectedWalls;
    for (let w of cwalls) {
      let s = sectorOfWall(ctx.board, w);
      if (WallEnt.invalidatedSectors.indexOf(s) == -1) {
        invalidateSectorAndWalls(s, ctx);
        WallEnt.invalidatedSectors.push(s);
      }
    }
  }

  public Move(msg: Move, ctx: BuildContext) {
    let x = ctx.snap(this.origin[0] + msg.dx);
    let y = ctx.snap(this.origin[1] + msg.dy);
    if (moveWall(ctx.board, this.wallId, x, y)) {
      this.invalidate(ctx);
    }
  }

  public EndMove(msg: EndMove, ctx: BuildContext) {
    this.active = false;
    mergePoints(ctx.board, this.wallId, ctx.refs);
  }

  public Highlight(msg: Highlight, ctx: BuildContext) {
    if (this.active) {
      let cwalls = this.connectedWalls;
      for (let i = 0; i < cwalls.length(); i++) {
        let w = cwalls.get(i);
        let s = sectorOfWall(ctx.board, w);
        let p = lastwall(ctx.board, w);
        msg.set.add(tuple(2, w));
        msg.set.add(tuple(3, w));
        msg.set.add(tuple(2, p));
        msg.set.add(tuple(0, s));
        msg.set.add(tuple(1, s));
      }
    } else {
      msg.set.add(tuple(3, this.wallId));
    }
  }

  public SetPicnum(msg: SetPicnum, ctx: BuildContext) {
    let wall = ctx.board.walls[this.wallId];
    wall.picnum = msg.picnum;
    ctx.message(new BoardInvalidate(new Entity(this.wallId, EntityType.WALL_POINT)));
  }

  public Shade(msg: Shade, ctx: BuildContext) {
    let wall = ctx.board.walls[this.wallId];
    let shade = wall.shade;
    if (msg.absolute && shade == msg.value) return;
    if (msg.absolute) wall.shade = msg.value; else wall.shade += msg.value;
    ctx.message(new BoardInvalidate(new Entity(this.wallId, EntityType.WALL_POINT)));
  }

  public PanRepeat(msg: PanRepeat, ctx: BuildContext) {
    let wall = ctx.board.walls[this.wallId];
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
    ctx.message(new BoardInvalidate(new Entity(this.wallId, EntityType.WALL_POINT)));
  }

  public Palette(msg: Palette, ctx: BuildContext) {
    let wall = ctx.board.walls[this.wallId];
    if (msg.absolute) {
      if (msg.value == wall.pal) return;
      wall.pal = msg.value;
    } else {
      wall.pal = cyclic(wall.pal + msg.value, msg.max);
    }
    ctx.message(new BoardInvalidate(new Entity(this.wallId, EntityType.WALL_POINT)));
  }

  public Flip(msg: Flip, ctx: BuildContext) {
    let wall = ctx.board.walls[this.wallId];
    let flip = wall.cstat.xflip + wall.cstat.yflip * 2;
    let nflip = cyclic(flip + 1, 4);
    wall.cstat.xflip = nflip & 1;
    wall.cstat.yflip = (nflip & 2) >> 1;
    ctx.message(new BoardInvalidate(new Entity(this.wallId, EntityType.WALL_POINT)));
  }

  public NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    if (msg.name == 'delete') {
      deleteWall(ctx.board, this.wallId, ctx.refs);
      ctx.commit();
      ctx.message(new BoardInvalidate(null));
    }
  }

  public BoardInvalidate(msg: BoardInvalidate, ctx: BuildContext) {
    if (msg.ent == null) this.valid = false;
  }

  public handle(msg: Message, ctx: BuildContext) {
    if (this.valid) super.handle(msg, ctx);
  }
}
