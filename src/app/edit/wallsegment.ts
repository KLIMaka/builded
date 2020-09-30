import { connectedWalls } from "../../build/board/loops";
import { Board } from "../../build/board/structs";
import { fixxrepeat, mergePoints, moveWall } from "../../build/boardutils";
import { Entity, EntityType, Target } from "../../build/hitscan";
import { sectorOfWall } from "../../build/utils";
import { mat2d, vec2 } from "../../libs_js/glmatrix";
import { Deck, IndexedDeck } from "../../utils/collections";
import { cyclic, int, len2d, tuple } from "../../utils/mathutils";
import { Message, MessageHandlerReflective } from "../apis/handler";
import { EditContext } from "./context";
import { invalidateSectorAndWalls } from "./editutils";
import { BoardInvalidate, EndMove, Flip, Highlight, Move, Palette, PanRepeat, ResetPanRepeat, Rotate, SetPicnum, SetWallCstat, Shade, StartMove } from "./messages";

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

function collectConnectedWalls(board: Board, walls: Iterable<number>) {
  let result = new Deck<number>();
  for (let w of walls) connectedWalls(board, w, result);
  return result;
}

export class WallSegmentsEnt extends MessageHandlerReflective {
  private static invalidatedSectors = new IndexedDeck<number>();

  constructor(
    public wallIds: Iterable<number>,
    public highlighted: Iterable<number>,
    public bottom: boolean,
    public ctx: EditContext,
    public origin = vec2.create(),
    public refwall = -1,
    public active = false,
    public connectedWalls = collectConnectedWalls(ctx.board(), wallIds),
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

  public Rotate(msg: Rotate) {
    const board = this.ctx.board();
    const target = this.ctx.view.snapTarget();
    const [cx, cy] = target.coords;
    const ang = (msg.da / 128) * (Math.PI / 8);
    const matrix = mat2d.create();
    mat2d.translate(matrix, matrix, [cx, cy]);
    mat2d.rotate(matrix, matrix, ang);
    mat2d.translate(matrix, matrix, [-cx, -cy]);
    for (const w of this.wallIds) {
      const wall = board.walls[w];
      const [x, y] = vec2.transformMat2d([], [wall.x, wall.y], matrix);
      moveWall(board, w, int(x), int(y));
    }
    this.invalidate();
  }

  public Highlight(msg: Highlight) {
    // const board = this.ctx.board();
    // if (this.active) {
    //   let cwalls = this.connectedWalls;
    //   for (let w of cwalls) {
    //     let s = sectorOfWall(board, w);
    //     let p = lastwall(board, w);
    //     msg.set.add(tuple(2, w));
    //     msg.set.add(tuple(3, w));
    //     msg.set.add(tuple(2, p));
    //     msg.set.add(tuple(0, s));
    //     msg.set.add(tuple(1, s));
    //   }
    // } else {
    let hwalls = this.highlighted;
    for (let w of hwalls) msg.set.add(tuple(2, w));
    // }
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
