import { sectorZ, setSectorZ, ZSCALE } from "build/utils";
import { canonicalWall, connectedWalls } from "../../build/board/loops";
import { fixxrepeat, mergePoints, moveWall } from "../../build/board/mutations/walls";
import { lastwall, sectorOfWall } from "../../build/board/query";
import { Board, Wall } from "../../build/board/structs";
import { Entity, EntityType, Target } from "../../build/hitscan";
import { vec2 } from "gl-matrix";
import { IndexedDeck, map, takeFirst } from "../../utils/collections";
import { iter } from "../../utils/iter";
import { cyclic, len2d, tuple } from "../../utils/mathutils";
import { Message, MessageHandlerReflective } from "../apis/handler";
import { EditContext } from "./context";
import { invalidateSectorAndWalls } from "./editutils";
import { BoardInvalidate, Commit, EndMove, Flip, Highlight, Move, Palette, PanRepeat, ResetPanRepeat, Rotate, SetPicnum, SetWallCstat, Shade, StartMove } from "./messages";
import { MOVE_VERTICAL } from "./tools/transform";

function getClosestWallByIds(board: Board, target: Target, ids: Iterable<number>): number {
  let id = -1;
  let mindist = Number.MAX_VALUE;
  const [x, y] = target.coords;
  for (const w of ids) {
    const wall = board.walls[w];
    const dist = len2d(wall.x - x, wall.y - y);
    if (dist < mindist) {
      id = w;
      mindist = dist;
    }
  }
  return id == -1 ? takeFirst(ids) : id;
}

function collectConnectedWalls(board: Board, walls: Iterable<number>) {
  const result = new Set<number>();
  for (const w of walls) connectedWalls(board, w, result);
  return result;
}

export class WallSegmentsEnt extends MessageHandlerReflective {
  private static invalidatedSectors = new IndexedDeck<number>();

  constructor(
    public walls: Iterable<Entity>,
    public highlighted: Iterable<Entity>,
    public ctx: EditContext,
    public origin = vec2.create(),
    public originz = 0,
    public sectorEnt: Entity = null,
    public refwall = -1,
    public active = false,
    public connectedWalls = collectConnectedWalls(ctx.board(), map(walls, w => w.id)),
    public canonicalWalls = iter(walls).map(w => canonicalWall(ctx.board(), w.id)).set(),
    private valid = true) { super() }

  private invalidate() {
    const invalidatedSectors = WallSegmentsEnt.invalidatedSectors.clear();
    const board = this.ctx.board();
    for (const w of this.connectedWalls) {
      const s = sectorOfWall(board, w);
      if (invalidatedSectors.indexOf(s) == -1) {
        invalidateSectorAndWalls(s, board, this.ctx.bus);
        invalidatedSectors.push(s);
      }
    }
  }

  private getWall(wallEnt: Entity): Wall {
    const board = this.ctx.board();
    const wall = board.walls[wallEnt.id];
    return wall.cstat.swapBottoms && wallEnt.type == EntityType.LOWER_WALL && wall.nextwall != -1
      ? board.walls[wall.nextwall]
      : wall;
  }

  private invalidateWall(wallEnt: Entity) {
    const board = this.ctx.board();
    this.ctx.bus.handle(new BoardInvalidate(wallEnt));
    const wall = board.walls[wallEnt.id];
    if (wall.cstat.swapBottoms && wall.nextwall != -1 ||
      wall.nextwall != -1 && board.walls[wall.nextwall].cstat.swapBottoms)
      this.ctx.bus.handle(new BoardInvalidate(Entity.wallPoint(wall.nextwall)));
  }

  public StartMove(msg: StartMove) {
    const board = this.ctx.board();
    this.refwall = getClosestWallByIds(board, this.ctx.view.target(), this.canonicalWalls);
    const wall = board.walls[this.refwall];
    vec2.set(this.origin, wall.x, wall.y);

    const sectorWallId = getClosestWallByIds(board, this.ctx.view.target(), map(this.highlighted, e => e.id));
    const sectorWall = board.walls[sectorWallId];
    const type = this.ctx.view.target().entity.type == EntityType.UPPER_WALL ? EntityType.CEILING : EntityType.FLOOR;
    if (sectorWall.nextsector == -1) this.sectorEnt = Entity.of(sectorOfWall(board, this.refwall), type);
    else this.sectorEnt = Entity.of(sectorWall.nextsector, type);
    this.originz = sectorZ(board, this.sectorEnt) / ZSCALE;
    this.active = true;
  }

  public Move(msg: Move) {
    const board = this.ctx.board();
    if (this.ctx.state.get(MOVE_VERTICAL)) {
      const z = this.ctx.gridController.snap(this.originz + msg.dz) * ZSCALE;
      if (setSectorZ(this.ctx.board(), this.sectorEnt, z))
        invalidateSectorAndWalls(this.sectorEnt.id, this.ctx.board(), this.ctx.bus);
    } else {
      const x = this.ctx.gridController.snap(this.origin[0] + msg.dx);
      const y = this.ctx.gridController.snap(this.origin[1] + msg.dy);
      const refwall = board.walls[this.refwall];
      const dx = x - refwall.x;
      const dy = y - refwall.y;
      if (moveWall(board, this.refwall, x, y)) {
        for (const w of this.canonicalWalls) {
          if (w == this.refwall) continue;
          const wall = board.walls[w];
          moveWall(board, w, wall.x + dx, wall.y + dy);
        }
        this.invalidate();
      }
    }

  }

  public EndMove(msg: EndMove) {
    this.active = false;
    for (const w of this.walls) mergePoints(this.ctx.board(), w.id, this.ctx.refs);
  }

  public Rotate(msg: Rotate) {
    // const board = this.ctx.board();
    // const target = this.ctx.view.snapTarget();
    // const [cx, cy] = target.coords;
    // const ang = (msg.da / 128) * (Math.PI / 8);
    // const matrix = mat2d.create();
    // mat2d.translate(matrix, matrix, [cx, cy]);
    // mat2d.rotate(matrix, matrix, ang);
    // mat2d.translate(matrix, matrix, [-cx, -cy]);
    // for (const w of this.canonicalWalls) {
    //   const wall = board.walls[w];
    //   const [x, y] = vec2.transformMat2d([], [wall.x, wall.y], matrix);
    //   moveWall(board, w, int(x), int(y));
    // }
    // this.invalidate();
  }

  public Highlight(msg: Highlight) {
    const board = this.ctx.board();
    if (this.active) {
      let cwalls = this.connectedWalls;
      for (let w of cwalls) {
        let s = sectorOfWall(board, w);
        let p = lastwall(board, w);
        msg.set.add(tuple(2, w));
        // msg.set.add(tuple(3, w));
        msg.set.add(tuple(2, p));
        msg.set.add(tuple(0, s));
        msg.set.add(tuple(1, s));
      }
    } else {
      const hwalls = this.highlighted;
      for (const w of hwalls) msg.set.add(tuple(2, w.id));
    } 13
  }

  public SetPicnum(msg: SetPicnum) {
    for (const w of this.highlighted) {
      const wall = this.getWall(w);
      if (w.type == EntityType.MID_WALL && wall.nextwall != -1) wall.overpicnum = msg.picnum;
      else wall.picnum = msg.picnum;
      this.invalidateWall(w);
    }
    this.ctx.bus.handle(new Commit(`Set Walls ${[...this.canonicalWalls]} Picnum`));
  }

  public Shade(msg: Shade) {
    for (const w of this.highlighted) {
      const wall = this.getWall(w);
      const shade = wall.shade;
      if (msg.absolute && shade == msg.value) continue;
      if (msg.absolute) wall.shade = msg.value; else wall.shade += msg.value;
      this.invalidateWall(w);
    }
    this.ctx.bus.handle(new Commit(`Set Walls ${[...this.canonicalWalls]} Shade`, true));
  }

  public ResetPanRepeat(msg: ResetPanRepeat) {
    for (const w of this.highlighted) {
      const wall = this.getWall(w);
      wall.xpanning = 0;
      wall.ypanning = 0;
      wall.yrepeat = 8;
      fixxrepeat(this.ctx.board(), w.id);
      this.invalidateWall(w);
    }
    this.ctx.bus.handle(new Commit(`Reset Walls ${[...this.canonicalWalls]} PanRepeat`, true));
  }

  public PanRepeat(msg: PanRepeat) {
    for (const w of this.highlighted) {
      const wall = this.getWall(w);
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
    this.ctx.bus.handle(new Commit(`Set Walls ${[...this.canonicalWalls]} PanRepeat`, true));
  }

  public Palette(msg: Palette) {
    for (const w of this.highlighted) {
      const wall = this.getWall(w);
      if (msg.absolute) {
        if (msg.value == wall.pal) return;
        wall.pal = msg.value;
      } else {
        wall.pal = cyclic(wall.pal + msg.value, msg.max);
      }
      this.invalidateWall(w);
    }
    this.ctx.bus.handle(new Commit(`Set Walls ${[...this.canonicalWalls]} Palette`, true));
  }

  public Flip(msg: Flip) {
    for (const w of this.highlighted) {
      const wall = this.getWall(w);
      const flip = wall.cstat.xflip + wall.cstat.yflip * 2;
      const nflip = cyclic(flip + 1, 4);
      wall.cstat.xflip = nflip & 1;
      wall.cstat.yflip = (nflip & 2) >> 1;
      this.invalidateWall(w);
    }
    this.ctx.bus.handle(new Commit(`Flip Walls ${[...this.canonicalWalls]}`, true));
  }

  public SetWallCstat(msg: SetWallCstat) {
    const board = this.ctx.board();
    for (const w of this.highlighted) {
      const wall = msg.name == 'swapBottoms' ? board.walls[w.id] : this.getWall(w);
      const stat = wall.cstat[msg.name];
      wall.cstat[msg.name] = stat ? 0 : 1;
      this.invalidateWall(w);
    }
    this.ctx.bus.handle(new Commit(`Set Walls ${[...this.canonicalWalls]} Cstat ${msg.name}`, true));
  }

  public BoardInvalidate(msg: BoardInvalidate) {
    if (msg.ent == null) this.valid = false;
  }

  public handle(msg: Message) {
    if (this.valid) super.handle(msg);
  }
}
