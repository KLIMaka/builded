import { sectorWalls } from "../../build/board/loops";
import { deleteSector } from "../../build/board/mutations/internal";
import { Board } from "../../build/board/structs";
import { Entity, EntityType } from "../../build/hitscan";
import { sectorHeinum, sectorZ, setSectorHeinum, setSectorPicnum, setSectorZ, ZSCALE } from "../../build/utils";
import { vec2 } from "gl-matrix";
import { cyclic, tuple } from "../../utils/mathutils";
import { Message, MessageHandlerReflective } from "../apis/handler";
import { EditContext } from "./context";
import { invalidateSectorAndWalls } from "./editutils";
import { BoardInvalidate, Commit, Highlight, Move, NamedMessage, Palette, PanRepeat, ResetPanRepeat, Rotate, SetPicnum, SetSectorCstat, Shade, StartMove } from "./messages";
import { MOVE_VERTICAL } from "./tools/transform";

const resetPanrepeat = new PanRepeat(0, 0, 0, 0, true);

export type SectorEntFactory = (ent: Entity) => SectorEnt;



export class SectorEnt extends MessageHandlerReflective {
  constructor(
    public sectorEnt: Entity,
    private ctx: EditContext,
    public originz = 0,
    public origin = vec2.create(),
    private valid = true
  ) { super() }

  public StartMove(msg: StartMove) {
    const [x, y] = this.ctx.view.target().coords;
    // const sec = ctx.board.sectors[this.sectorId];
    // const slope = createSlopeCalculator(sec, ctx.board.walls);
    // this.originz = slope(x, y, this.type == HitType.CEILING ? sec.ceilingheinum : sec.floorheinum) + sectorZ(ctx.board, this.sectorId, this.type)) / ZSCALE;
    this.originz = sectorZ(this.ctx.board(), this.sectorEnt) / ZSCALE;
    vec2.set(this.origin, x, y);
  }

  private setZ(z: number) {
    if (setSectorZ(this.ctx.board(), this.sectorEnt, z))
      invalidateSectorAndWalls(this.sectorEnt.id, this.ctx.board(), this.ctx.bus);
  }

  public Move(msg: Move) {
    if (this.ctx.state.get(MOVE_VERTICAL)) {
      const ent = this.ctx.view.target().entity;
      const z = ent != null && ent.isSector() && ent.id != this.sectorEnt.id
        ? sectorZ(this.ctx.board(), ent) / ZSCALE
        : this.ctx.gridController.snap(this.originz + msg.dz);
      this.setZ(z * ZSCALE);
    }
  }

  public Rotate(msg: Rotate) {
    const board = this.ctx.board();
    const h = sectorHeinum(board, this.sectorEnt);
    const newH = msg.absolute ? msg.da : h + msg.da;
    if (setSectorHeinum(board, this.sectorEnt, newH)) {
      this.ctx.bus.handle(new Commit(`Set Sector ${this.sectorEnt.id}:${this.sectorEnt.type} Angle`, true));
      invalidateSectorAndWalls(this.sectorEnt.id, board, this.ctx.bus);
    }
  }

  public Highlight(msg: Highlight) {
    msg.set.add(tuple(this.sectorEnt.type == EntityType.CEILING ? 0 : 1, this.sectorEnt.id));
  }

  public SetPicnum(msg: SetPicnum) {
    if (setSectorPicnum(this.ctx.board(), this.sectorEnt, msg.picnum)) {
      this.ctx.bus.handle(new BoardInvalidate(this.sectorEnt));
      this.ctx.bus.handle(new Commit(`Set Sector ${this.sectorEnt.id}:${this.sectorEnt.type} Picnum`));
    }
  }

  public Shade(msg: Shade) {
    const sector = this.ctx.board().sectors[this.sectorEnt.id];
    const shade = this.sectorEnt.type == EntityType.CEILING ? sector.ceilingshade : sector.floorshade;
    if (msg.absolute && msg.value == shade) return;
    if (msg.absolute) {
      if (this.sectorEnt.type == EntityType.CEILING) sector.ceilingshade = msg.value; else sector.floorshade = msg.value;
    } else {
      if (this.sectorEnt.type == EntityType.CEILING) sector.ceilingshade += msg.value; else sector.floorshade += msg.value;
    }
    this.ctx.bus.handle(new Commit(`Set Sector ${this.sectorEnt.id}:${this.sectorEnt.type} Shade`, true));
    this.ctx.bus.handle(new BoardInvalidate(this.sectorEnt));
  }

  public ResetPanRepeat(msg: ResetPanRepeat) {
    this.PanRepeat(resetPanrepeat);
  }

  public PanRepeat(msg: PanRepeat) {
    const sector = this.ctx.board().sectors[this.sectorEnt.id];
    if (msg.absolute) {
      if (this.sectorEnt.type == EntityType.CEILING) {
        if (sector.ceilingxpanning == msg.xpan && sector.ceilingypanning == msg.ypan) return;
        sector.ceilingxpanning = msg.xpan;
        sector.ceilingypanning = msg.ypan;
      } else {
        if (sector.floorxpanning == msg.xpan && sector.floorypanning == msg.ypan) return;
        sector.floorxpanning = msg.xpan;
        sector.floorypanning = msg.ypan;
      }
    } else {
      if (this.sectorEnt.type == EntityType.CEILING) {
        sector.ceilingxpanning += msg.xpan;
        sector.ceilingypanning += msg.ypan;
      } else {
        sector.floorxpanning += msg.xpan;
        sector.floorypanning += msg.ypan;
      }
    }
    this.ctx.bus.handle(new Commit(`Set Sector ${this.sectorEnt.id}:${this.sectorEnt.type} PanRepeat`, true));
    this.ctx.bus.handle(new BoardInvalidate(this.sectorEnt));
  }

  public Palette(msg: Palette) {
    const sector = this.ctx.board().sectors[this.sectorEnt.id];
    if (msg.absolute) {
      if (this.sectorEnt.type == EntityType.CEILING) {
        if (msg.value == sector.ceilingpal) return;
        sector.ceilingpal = msg.value;
      } else {
        if (msg.value == sector.floorpal) return;
        sector.floorpal = msg.value;
      }
    } else {
      if (this.sectorEnt.type == EntityType.CEILING) {
        sector.ceilingpal = cyclic(sector.ceilingpal + msg.value, msg.max);
      } else {
        sector.floorpal = cyclic(sector.floorpal + msg.value, msg.max);
      }
    }
    this.ctx.bus.handle(new Commit(`Set Sector ${this.sectorEnt.id}:${this.sectorEnt.type} Palette`, true));
    this.ctx.bus.handle(new BoardInvalidate(this.sectorEnt));
  }

  public SetSectorCstat(msg: SetSectorCstat) {
    const sector = this.ctx.board().sectors[this.sectorEnt.id];
    const stat = this.sectorEnt.type == EntityType.CEILING ? sector.ceilingstat[msg.name] : sector.floorstat[msg.name];
    if (msg.toggle) {
      const nstat = stat ? 0 : 1;
      if (this.sectorEnt.type == EntityType.CEILING) sector.ceilingstat[msg.name] = nstat; else sector.floorstat[msg.name] = nstat;
    } else {
      if (stat == msg.value) return;
      if (this.sectorEnt.type == EntityType.CEILING) sector.ceilingstat[msg.name] = msg.value; else sector.floorstat[msg.name] = msg.value;
    }
    this.ctx.bus.handle(new Commit(`Set Sector ${this.sectorEnt.id} Cstat ${msg.name}`));
    this.ctx.bus.handle(new BoardInvalidate(this.sectorEnt));
  }

  private collectZs(board: Board) {
    const zs = new Set<number>();
    zs.add(board.sectors[this.sectorEnt.id].ceilingz);
    zs.add(board.sectors[this.sectorEnt.id].floorz);
    for (const w of sectorWalls(board, this.sectorEnt.id)) {
      const wall = board.walls[w];
      if (wall.nextsector == -1) continue;
      zs.add(board.sectors[wall.nextsector].ceilingz);
      zs.add(board.sectors[wall.nextsector].floorz);
    }
    return [...zs].sort((l, r) => l - r);
  }

  private fly() {
    const board = this.ctx.board();
    const refz = sectorZ(board, this.sectorEnt);
    const zs = this.collectZs(board);
    const idx = zs.indexOf(refz);
    if (idx == 0) return;
    this.setZ(zs[idx - 1]);
    this.ctx.bus.handle(new Commit(`Fly Sector ${this.sectorEnt.id}:${this.sectorEnt.type}`));
  }

  private fall() {
    const board = this.ctx.board();
    const refz = sectorZ(board, this.sectorEnt);
    const zs = this.collectZs(board);
    const idx = zs.indexOf(refz);
    if (idx == zs.length - 1) return;
    this.setZ(zs[idx + 1]);
    this.ctx.bus.handle(new Commit(`Fall Sector ${this.sectorEnt.id}:${this.sectorEnt.type}`));
  }

  private delete() {
    deleteSector(this.ctx.board(), this.sectorEnt.id, this.ctx.refs);
    this.ctx.bus.handle(new Commit(`Delete Sector ${this.sectorEnt.id}`));
    this.ctx.bus.handle(new BoardInvalidate(null));
  }

  private lotag(delta: number) {
    const board = this.ctx.board();
    const lotag = board.sectors[this.sectorEnt.id].lotag + delta;
    board.sectors[this.sectorEnt.id].lotag = lotag;
    this.ctx.bus.handle(new Commit(`Change Sector ${this.sectorEnt.id} Lo-Tag to ${delta}`));
    this.ctx.bus.handle(new BoardInvalidate(this.sectorEnt));
  }

  private hitag(delta: number) {
    const board = this.ctx.board();
    const hitag = board.sectors[this.sectorEnt.id].hitag + delta;
    board.sectors[this.sectorEnt.id].hitag = hitag;
    this.ctx.bus.handle(new Commit(`Change Sector ${this.sectorEnt.id} Hi-Tag to ${delta}`));
    this.ctx.bus.handle(new BoardInvalidate(this.sectorEnt));
  }

  public NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'delete': this.delete(); return;
      case 'fly': this.fly(); return;
      case 'fall': this.fall(); return;
      case 'lotag+': this.lotag(1); return;
      case 'lotag-': this.lotag(-1); return;
      case 'hitag+': this.hitag(1); return;
      case 'hitag-': this.hitag(-1); return;
    }
  }

  public BoardInvalidate(msg: BoardInvalidate) {
    if (msg.ent == null) this.valid = false;
  }

  public handle(msg: Message) {
    if (this.valid) super.handle(msg);
  }
}
