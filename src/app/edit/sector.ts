import { deleteSector } from "../../build/boardutils";
import { Entity, EntityType } from "../../build/hitscan";
import { heinumCalc, sectorZ, setSectorHeinum, setSectorPicnum, setSectorZ, ZSCALE } from "../../build/utils";
import * as GLM from "../../libs_js/glmatrix";
import { cyclic, tuple } from "../../utils/mathutils";
import { Message, MessageHandlerReflective } from "../apis/handler";
import { EditContext } from "./context";
import { invalidateSectorAndWalls } from "./editutils";
import { BoardInvalidate, Highlight, Move, NamedMessage, Palette, PanRepeat, ResetPanRepeat, SetPicnum, SetSectorCstat, Shade, StartMove } from "./messages";
import { MOVE_ROTATE, MOVE_VERTICAL } from "./tools/selection";

const resetPanrepeat = new PanRepeat(0, 0, 0, 0, true);

export type SectorEntFactory = (ent: Entity) => SectorEnt;



export class SectorEnt extends MessageHandlerReflective {
  constructor(
    public sectorEnt: Entity,
    private ctx: EditContext,
    public originz = 0,
    public origin = GLM.vec2.create(),
    private valid = true
  ) { super() }

  public StartMove(msg: StartMove) {
    let [x, y] = this.ctx.view.target().coords;
    // let sec = ctx.board.sectors[this.sectorId];
    // let slope = createSlopeCalculator(sec, ctx.board.walls);
    // this.originz = slope(x, y, this.type == HitType.CEILING ? sec.ceilingheinum : sec.floorheinum) + sectorZ(ctx.board, this.sectorId, this.type)) / ZSCALE;
    this.originz = sectorZ(this.ctx.board(), this.sectorEnt) / ZSCALE;
    GLM.vec2.set(this.origin, x, y);
  }

  public Move(msg: Move) {
    if (this.ctx.state.get(MOVE_ROTATE)) {
      let x = this.origin[0];
      let y = this.origin[1];
      let z = this.ctx.gridController.snap(this.originz + msg.dz * ZSCALE);
      let h = heinumCalc(this.ctx.board(), this.sectorEnt.id, x, y, z);
      if (setSectorHeinum(this.ctx.board(), this.sectorEnt, h))
        invalidateSectorAndWalls(this.sectorEnt.id, this.ctx.board(), this.ctx.bus);
    } else if (this.ctx.state.get(MOVE_VERTICAL)) {
      const ent = this.ctx.view.target().entity;
      let z = ent != null && ent.isSector() && ent.id != this.sectorEnt.id
        ? sectorZ(this.ctx.board(), ent) / ZSCALE
        : this.ctx.gridController.snap(this.originz + msg.dz);
      if (setSectorZ(this.ctx.board(), this.sectorEnt, z * ZSCALE))
        invalidateSectorAndWalls(this.sectorEnt.id, this.ctx.board(), this.ctx.bus);
    }
  }

  public Highlight(msg: Highlight) {
    msg.set.add(tuple(this.sectorEnt.type == EntityType.CEILING ? 0 : 1, this.sectorEnt.id));
  }

  public SetPicnum(msg: SetPicnum) {
    if (setSectorPicnum(this.ctx.board(), this.sectorEnt, msg.picnum))
      this.ctx.bus.handle(new BoardInvalidate(this.sectorEnt));
  }

  public Shade(msg: Shade) {
    let sector = this.ctx.board().sectors[this.sectorEnt.id];
    let shade = this.sectorEnt.type == EntityType.CEILING ? sector.ceilingshade : sector.floorshade;
    if (msg.absolute && msg.value == shade) return;
    if (msg.absolute) {
      if (this.sectorEnt.type == EntityType.CEILING) sector.ceilingshade = msg.value; else sector.floorshade = msg.value;
    } else {
      if (this.sectorEnt.type == EntityType.CEILING) sector.ceilingshade += msg.value; else sector.floorshade += msg.value;
    }
    this.ctx.bus.handle(new BoardInvalidate(this.sectorEnt));
  }

  public ResetPanRepeat(msg: ResetPanRepeat) {
    this.PanRepeat(resetPanrepeat);
  }

  public PanRepeat(msg: PanRepeat) {
    let sector = this.ctx.board().sectors[this.sectorEnt.id];
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
    this.ctx.bus.handle(new BoardInvalidate(this.sectorEnt));
  }

  public Palette(msg: Palette) {
    let sector = this.ctx.board().sectors[this.sectorEnt.id];
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
    this.ctx.bus.handle(new BoardInvalidate(this.sectorEnt));
  }

  public SetSectorCstat(msg: SetSectorCstat) {
    let sector = this.ctx.board().sectors[this.sectorEnt.id];
    let stat = this.sectorEnt.type == EntityType.CEILING ? sector.ceilingstat[msg.name] : sector.floorstat[msg.name];
    if (msg.toggle) {
      let nstat = stat ? 0 : 1;
      if (this.sectorEnt.type == EntityType.CEILING) sector.ceilingstat[msg.name] = nstat; else sector.floorstat[msg.name] = nstat;
    } else {
      if (stat == msg.value) return;
      if (this.sectorEnt.type == EntityType.CEILING) sector.ceilingstat[msg.name] = msg.value; else sector.floorstat[msg.name] = msg.value;
    }
    this.ctx.bus.handle(new BoardInvalidate(this.sectorEnt));
  }

  public NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'delete':
        deleteSector(this.ctx.board(), this.sectorEnt.id, this.ctx.refs);
        // ctx.commit();
        this.ctx.bus.handle(new BoardInvalidate(null));
        return;
    }
  }

  public BoardInvalidate(msg: BoardInvalidate) {
    if (msg.ent == null) this.valid = false;
  }

  public handle(msg: Message) {
    if (this.valid) super.handle(msg);
  }
}
