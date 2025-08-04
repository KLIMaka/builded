import { pair } from "ts-utils/types";
import { BoardContext, gridSnap } from "app/apis/engine";
import { BuildReferenceTrackerImpl } from "app/modules/default/reftracker";
import { vec2, vec3 } from "gl-matrix";
import { canonicalWall } from "../../build/board/loops";
import { fixxrepeat, mergePoints, moveWall } from "../../build/board/mutations/walls";
import { Board, Wall } from "../../build/board/structs";
import { Entity, EntityType } from "../../build/hitscan";
import { iter } from "ts-utils/iter";
import { cyclic, len2d } from "ts-utils/mathutils";
import { Message, MessageHandlerReflective } from "../apis/handler";
import { BoardInvalidate, Commit, EndMove, Flip, Move, Palette, PanRepeat, ResetPanRepeat, Rotate, SetPicnum, SetWallCstat, Shade, StartMove } from "./messages";

function getClosestWallByIds(board: Board, origin: vec3, ids: Iterable<number>): number {
  const [x, y] = origin;
  return iter(ids)
    .map(w => pair(w, board.walls[w]))
    .map(([w, wall]) => pair(w, len2d(wall.x - x, wall.y - y)))
    .reduceFirst((lh, rh) => lh[1] < rh[1] ? lh : rh)
    .map(([w, _]) => w).orElse(-1);
}

export class WallSegmentsEnt extends MessageHandlerReflective {

  constructor(
    public walls: Iterable<Entity>,
    public boardCtx: BoardContext,
    public origin = vec2.create(),
    public refwall = -1,
    public active = false,
    public canonicalWalls = iter(walls).map(w => canonicalWall(boardCtx.board.get(), w.id)).set(),
    private valid = true) { super() }


  private getWall(board: Board, wallEnt: Entity): Wall {
    const wall = board.walls[wallEnt.id];
    return wall.cstat.swapBottoms && wallEnt.type === EntityType.LOWER_WALL && wall.nextwall !== -1
      ? board.walls[wall.nextwall]
      : wall;
  }

  public StartMove(msg: StartMove) {
    const board = this.boardCtx.board.get();
    this.refwall = getClosestWallByIds(board, msg.origin, this.canonicalWalls);
    const wall = board.walls[this.refwall];
    vec2.set(this.origin, wall.x, wall.y);
    this.active = true;
  }

  public Move(msg: Move) {
    this.boardCtx.modifyBoard(`Move Walls ${this.canonicalWalls}`, board => {
      const gridSize = this.boardCtx.grid.size.get();
      const x = gridSnap(gridSize, this.origin[0] + msg.dx);
      const y = gridSnap(gridSize, this.origin[1] + msg.dy);
      const refwall = board.walls[this.refwall];
      const dx = x - refwall.x;
      const dy = y - refwall.y;
      if (moveWall(board, this.refwall, x, y)) {
        for (const w of this.canonicalWalls) {
          if (w === this.refwall) continue;
          const wall = board.walls[w];
          moveWall(board, w, wall.x + dx, wall.y + dy);
        }
      }
    })
  }

  public EndMove(msg: EndMove) {
    this.active = false;
    this.boardCtx.modifyBoard(`Move Walls ${this.canonicalWalls}`, board => iter(this.walls).forEach(w => mergePoints(board, w.id, new BuildReferenceTrackerImpl())));
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

  // public Highlight(msg: Highlight) {
  //   const board = this.ctx.board();
  //   if (this.active) {
  //     let cwalls = this.connectedWalls;
  //     for (let w of cwalls) {
  //       let s = sectorOfWall(board, w);
  //       let p = lastwall(board, w);
  //       msg.set.add(tuple(2, w));
  //       // msg.set.add(tuple(3, w));
  //       msg.set.add(tuple(2, p));
  //       msg.set.add(tuple(0, s));
  //       msg.set.add(tuple(1, s));
  //     }
  //   } else {
  //     const hwalls = this.highlighted;
  //     for (const w of hwalls) msg.set.add(tuple(2, w.id));
  //   }
  // }

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
