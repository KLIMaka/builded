import { connectedWalls, fixxrepeat, lastwall, mergePoints, moveWall, nextwall } from "../../build/boardutils";
import { Entity, EntityType, Target } from "../../build/hitscan";
import { Board } from "../../build/structs";
import { sectorOfWall } from "../../build/utils";
import { vec2 } from "../../libs_js/glmatrix";
import { Collection, Deck, IndexedDeck } from "../../utils/collections";
import { List } from "../../utils/list";
import { cyclic, len2d, tuple } from "../../utils/mathutils";
import { Message, MessageHandlerReflective } from "../apis/handler";
import { EditContext } from "./context";
import { invalidateSectorAndWalls } from "./editutils";
import { BoardInvalidate, EndMove, Flip, Highlight, Move, Palette, PanRepeat, ResetPanRepeat, SetPicnum, SetWallCstat, Shade, StartMove } from "./messages";

function getClosestWallByIds(board: Board, target: Target, ids: Iterable<number>): number {
  let id = -1;
  let mindist = Number.MAX_VALUE;
  let [x, y] = target.coords;
  for (let w of ids) {
    let wall = board.walls[w];
    let dist = len2d(wall.x - x, wall.y - y);
    if (dist < mindist) {
      id = w;
      mindist = dist;
    }
  }
  return id == -1 ? ids[Symbol.iterator]().next().value : id;
}

function collectHighlightedWalls(board: Board, walls: Iterable<number>): Collection<number> {
  let result = new Deck<number>();
  let chains = new Deck<List<number>>();
  for (let w of walls) {
    let partOfOldChain = false;
    for (let c = 0; c < chains.length(); c++) {
      let chain = chains.get(c);
      if (nextwall(board, w) == chain.first().obj) {
        chain.insertBefore(w);
        partOfOldChain = true;
        break;
      } else if (lastwall(board, w) == chain.last().obj) {
        chain.insertAfter(w);
        partOfOldChain = true;
        break;
      }
    }
    if (!partOfOldChain) {
      let l = new List<number>();
      l.push(w);
      chains.push(l);
    }
  }
  for (let chain of chains) {
    if (chain.first().next != chain.terminator()) {
      let w1 = chain.first().obj;
      let w2 = chain.last().obj;
      if (board.walls[w2].point2 != w1)
        chain.pop();
    }
    for (let w of chain) result.push(w);
  }
  return result;
}

function collectConnectedWalls(board: Board, walls: Iterable<number>) {
  let result = new Deck<number>();
  for (let w of walls) connectedWalls(board, w, result);
  return result;
}

function collectMotionSectors(board: Board, walls: Iterable<number>): Set<number> {
  let sectors = new Set<number>();
  return sectors;
}

export class WallSegmentsEnt extends MessageHandlerReflective {
  private static invalidatedSectors = new IndexedDeck<number>();

  constructor(
    public wallIds: Iterable<number>,
    public bottom: boolean,
    public ctx: EditContext,
    public origin = vec2.create(),
    public refwall = -1,
    public active = false,
    public highlighted = collectHighlightedWalls(ctx.board(), wallIds),
    public connectedWalls = collectConnectedWalls(ctx.board(), wallIds),
    public motionSectors = collectMotionSectors(ctx.board(), wallIds),
    private valid = true) { super() }

  private invalidate() {
    const invalidatedSectors = WallSegmentsEnt.invalidatedSectors.clear();
    const board = this.ctx.board();
    for (let w of this.connectedWalls) {
      let s = sectorOfWall(board, w);
      if (invalidatedSectors.indexOf(s) == -1) {
        invalidateSectorAndWalls(s, board, this.ctx.bus);
        invalidatedSectors.push(s);
      }
    }
  }

  public StartMove(msg: StartMove) {
    const board = this.ctx.board();
    this.refwall = getClosestWallByIds(board, this.ctx.view.target(), this.wallIds);
    let wall = board.walls[this.refwall];
    vec2.set(this.origin, wall.x, wall.y);
    this.active = true;
  }

  public Move(msg: Move) {
    const board = this.ctx.board();
    let x = this.ctx.gridController.snap(this.origin[0] + msg.dx);
    let y = this.ctx.gridController.snap(this.origin[1] + msg.dy);
    let refwall = board.walls[this.refwall];
    let dx = x - refwall.x;
    let dy = y - refwall.y;
    if (moveWall(board, this.refwall, x, y)) {
      for (let w of this.wallIds) {
        if (w == this.refwall) continue;
        let wall = board.walls[w];
        moveWall(board, w, wall.x + dx, wall.y + dy);
      }
      this.invalidate();
    }
  }

  public EndMove(msg: EndMove) {
    this.active = false;
    for (let w of this.wallIds) mergePoints(this.ctx.board(), w, this.ctx.refs);
  }

  public Highlight(msg: Highlight) {
    const board = this.ctx.board();
    if (this.active) {
      let cwalls = this.connectedWalls;
      for (let w of cwalls) {
        let s = sectorOfWall(board, w);
        let p = lastwall(board, w);
        msg.set.add(tuple(2, w));
        msg.set.add(tuple(3, w));
        msg.set.add(tuple(2, p));
        msg.set.add(tuple(0, s));
        msg.set.add(tuple(1, s));
      }
    } else {
      let hwalls = this.highlighted;
      for (let w of hwalls) msg.set.add(tuple(2, w));
    }
  }

  private getWall(w: number) {
    const board = this.ctx.board();
    const wall = board.walls[w];
    return wall.cstat.swapBottoms && this.bottom && wall.nextwall != -1
      ? board.walls[wall.nextwall]
      : wall;
  }

  private invalidateWall(w: number) {
    const board = this.ctx.board();
    this.ctx.bus.handle(new BoardInvalidate(new Entity(w, EntityType.WALL_POINT)));
    let wall = board.walls[w];
    if (wall.cstat.swapBottoms && wall.nextwall != -1 ||
      wall.nextwall != -1 && board.walls[wall.nextwall].cstat.swapBottoms)
      this.ctx.bus.handle(new BoardInvalidate(new Entity(wall.nextwall, EntityType.WALL_POINT)));
  }

  public SetPicnum(msg: SetPicnum) {
    for (let w of this.highlighted) {
      let wall = this.getWall(w);
      wall.picnum = msg.picnum;
      this.invalidateWall(w);
    }
  }

  public Shade(msg: Shade) {
    for (let w of this.highlighted) {
      let wall = this.getWall(w);
      let shade = wall.shade;
      if (msg.absolute && shade == msg.value) return;
      if (msg.absolute) wall.shade = msg.value; else wall.shade += msg.value;
      this.invalidateWall(w);
    }
  }

  public ResetPanRepeat(msg: ResetPanRepeat) {
    for (let w of this.highlighted) {
      let wall = this.getWall(w);
      wall.xpanning = 0;
      wall.ypanning = 0;
      wall.yrepeat = 8;
      fixxrepeat(this.ctx.board(), w);
      this.invalidateWall(w);
    }
  }

  public PanRepeat(msg: PanRepeat) {
    for (let w of this.highlighted) {
      let wall = this.getWall(w);
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
      this.invalidateWall(w);
    }
  }

  public Palette(msg: Palette) {
    for (let w of this.highlighted) {
      let wall = this.getWall(w);
      if (msg.absolute) {
        if (msg.value == wall.pal) return;
        wall.pal = msg.value;
      } else {
        wall.pal = cyclic(wall.pal + msg.value, msg.max);
      }
      this.invalidateWall(w);
    }
  }

  public Flip(msg: Flip) {
    for (let w of this.highlighted) {
      let wall = this.getWall(w);
      let flip = wall.cstat.xflip + wall.cstat.yflip * 2;
      let nflip = cyclic(flip + 1, 4);
      wall.cstat.xflip = nflip & 1;
      wall.cstat.yflip = (nflip & 2) >> 1;
      this.invalidateWall(w);
    }
  }

  public SetWallCstat(msg: SetWallCstat) {
    const board = this.ctx.board();
    for (let w of this.highlighted) {
      let wall = msg.name == 'swapBottoms' ? board.walls[w] : this.getWall(w);
      let stat = wall.cstat[msg.name];
      wall.cstat[msg.name] = stat ? 0 : 1;
      this.invalidateWall(w);
    }
  }

  public BoardInvalidate(msg: BoardInvalidate) {
    if (msg.ent == null) this.valid = false;
  }

  public handle(msg: Message) {
    if (this.valid) super.handle(msg);
  }
}
