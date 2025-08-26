import { BoardContext, EngineContext, gridSnap } from "app/apis/engine";
import { BuildReferenceTrackerImpl } from "app/modules/default/reftracker";
import { sectorWalls } from "../../build/board/loops";
import { deleteSector } from "../../build/board/mutations/internal";
import { Board } from "../../build/board/structs";
import { Entity, EntityType } from "../../build/hitscan";
import { sectorHeinum, sectorZ, setSectorHeinum, setSectorPicnum, setSectorZ, ZSCALE } from "../../build/utils";
import { cyclic } from "ts-utils/mathutils";
import { MessageHandlerReflective } from "../apis/handler";
import { Move, NamedMessage, Palette, PanRepeat, ResetPanRepeat, Rotate, SetPicnum, SetSectorCstat, Shade, StartMove } from "./messages";
import { iter } from "ts-utils/iter";
import { pair } from "ts-utils/types";

const resetPanrepeat = new PanRepeat(0, 0, 0, 0, true);

export type SectorEntFactory = (ent: Entity) => SectorEnt;

export class SectorEnt extends MessageHandlerReflective {
  constructor(
    private sectorEnt: Entity,
    private boardCtx: BoardContext,
    private engine: EngineContext,
    private originz = 0,
    private zs: Set<number> = new Set(),
  ) { super() }

  StartMove(msg: StartMove) {
    // const sec = ctx.board.sectors[this.sectorId];
    // const slope = createSlopeCalculator(sec, ctx.board.walls);
    // this.originz = slope(x, y, this.type == HitType.CEILING ? sec.ceilingheinum : sec.floorheinum) + sectorZ(ctx.board, this.sectorId, this.type)) / ZSCALE;
    const { board } = this.boardCtx.data.get()
    this.originz = sectorZ(board, this.sectorEnt) / ZSCALE;
    this.zs = iter(sectorWalls(board, this.sectorEnt.id))
      .map(w => board.walls[w])
      .filter(w => w.nextsector !== -1)
      .map(w => [board.sectors[w.nextsector].ceilingz / ZSCALE, board.sectors[w.nextsector].floorz / ZSCALE])
      .flatten()
      .set();
    console.log(`originz=${this.originz}`);
  }

  Move(msg: Move) {
    this.boardCtx.modifyBoard(`Set Sector ${this.sectorEnt.id}:${this.sectorEnt.type} Z`, board => {
      const newZ = gridSnap(this.boardCtx.grid.size.get(), this.originz + msg.dz, .25);
      console.log(`originz=${this.originz} dz=${msg.dz} newz=${newZ}`);
      const z = iter(this.zs)
        .map(z => pair(z, Math.abs(newZ - z)))
        .filter(([_, dz]) => dz < (this.boardCtx.grid.size.get() * 0.25))
        .reduceFirst((l, r) => l[1] < r[1] ? l : r)
        .map(([z, _]) => z)
        .orElse(newZ);
      setSectorZ(board, this.sectorEnt, z * ZSCALE);
    });
  }

  Rotate(msg: Rotate) {
    this.boardCtx.modifyBoard(`Set Sector ${this.sectorEnt.id}:${this.sectorEnt.type} Angle`, board => {
      const h = sectorHeinum(board, this.sectorEnt);
      const newH = msg.absolute ? msg.da : h + msg.da;
      setSectorHeinum(board, this.sectorEnt, newH);
    });
  }

  SetPicnum(msg: SetPicnum) {
    this.boardCtx.modifyBoard(`Set Sector ${this.sectorEnt.id}:${this.sectorEnt.type} Picnum`,
      board => setSectorPicnum(board, this.sectorEnt, msg.picnum));
  }

  Shade(msg: Shade) {
    this.boardCtx.modifyBoard(`Set Sector ${this.sectorEnt.id}:${this.sectorEnt.type} Shade`, board => {
      const sector = board.sectors[this.sectorEnt.id];
      if (msg.absolute)
        if (this.sectorEnt.type === EntityType.CEILING) sector.ceilingshade = msg.value;
        else sector.floorshade = msg.value;
      else
        if (this.sectorEnt.type === EntityType.CEILING) sector.ceilingshade += msg.value;
        else sector.floorshade += msg.value;
    });
  }

  ResetPanRepeat(msg: ResetPanRepeat) {
    this.PanRepeat(resetPanrepeat);
  }

  PanRepeat(msg: PanRepeat) {
    this.boardCtx.modifyBoard(`Set Sector ${this.sectorEnt.id}:${this.sectorEnt.type} PanRepeat`, board => {
      const sector = board.sectors[this.sectorEnt.id];
      if (msg.absolute) {
        if (this.sectorEnt.type === EntityType.CEILING) {
          sector.ceilingxpanning = msg.xpan;
          sector.ceilingypanning = msg.ypan;
        } else {
          sector.floorxpanning = msg.xpan;
          sector.floorypanning = msg.ypan;
        }
      } else {
        if (this.sectorEnt.type === EntityType.CEILING) {
          sector.ceilingxpanning += msg.xpan;
          sector.ceilingypanning += msg.ypan;
        } else {
          sector.floorxpanning += msg.xpan;
          sector.floorypanning += msg.ypan;
        }
      }
    });
  }

  Palette(msg: Palette) {
    this.boardCtx.modifyBoard(`Set Sector ${this.sectorEnt.id}:${this.sectorEnt.type} Palette`, board => {
      const sector = board.sectors[this.sectorEnt.id];
      if (msg.absolute) {
        if (this.sectorEnt.type === EntityType.CEILING) sector.ceilingpal = msg.value;
        else sector.floorpal = msg.value;
      } else {
        if (this.sectorEnt.type === EntityType.CEILING) sector.ceilingpal = cyclic(sector.ceilingpal + msg.value, msg.max);
        else sector.floorpal = cyclic(sector.floorpal + msg.value, msg.max);
      }
    });
  }

  SetSectorCstat(msg: SetSectorCstat) {
    this.boardCtx.modifyBoard(`Set Sector ${this.sectorEnt.id} Cstat ${msg.name}`, board => {
      const sector = board.sectors[this.sectorEnt.id];
      const stat = this.sectorEnt.type === EntityType.CEILING ? sector.ceilingstat[msg.name] : sector.floorstat[msg.name];
      if (msg.toggle) {
        const nstat = stat ? 0 : 1;
        if (this.sectorEnt.type === EntityType.CEILING) sector.ceilingstat[msg.name] = nstat;
        else sector.floorstat[msg.name] = nstat;
      } else {
        if (this.sectorEnt.type === EntityType.CEILING) sector.ceilingstat[msg.name] = msg.value;
        else sector.floorstat[msg.name] = msg.value;
      }
    });
  }

  private collectZs(board: Board) {
    const zs = new Set<number>();
    zs.add(board.sectors[this.sectorEnt.id].ceilingz);
    zs.add(board.sectors[this.sectorEnt.id].floorz);
    for (const w of sectorWalls(board, this.sectorEnt.id)) {
      const wall = board.walls[w];
      if (wall.nextsector === -1) continue;
      zs.add(board.sectors[wall.nextsector].ceilingz);
      zs.add(board.sectors[wall.nextsector].floorz);
    }
    return [...zs].sort((l, r) => l - r);
  }

  private fly() {
    this.boardCtx.modifyBoard(`Fly Sector ${this.sectorEnt.id}:${this.sectorEnt.type}`, board => {
      const refz = sectorZ(board, this.sectorEnt);
      const zs = this.collectZs(board);
      const idx = zs.indexOf(refz);
      if (idx === 0) return;
      setSectorZ(board, this.sectorEnt, zs[idx - 1]);
    });
  }

  private fall() {
    this.boardCtx.modifyBoard(`Fall Sector ${this.sectorEnt.id}:${this.sectorEnt.type}`, board => {
      const refz = sectorZ(board, this.sectorEnt);
      const zs = this.collectZs(board);
      const idx = zs.indexOf(refz);
      if (idx === zs.length - 1) return;
      setSectorZ(board, this.sectorEnt, zs[idx + 1]);
    });
  }

  private delete() {
    this.boardCtx.modifyBoard(`Delete Sector ${this.sectorEnt.id}`,
      board => deleteSector(board, this.sectorEnt.id, new BuildReferenceTrackerImpl()));
  }

  private up() {
    this.boardCtx.modifyBoard(`Up Sector ${this.sectorEnt.id}`, board => setSectorZ(board, this.sectorEnt, sectorZ(board, this.sectorEnt) - 32 * 16));
  }

  private down() {
    this.boardCtx.modifyBoard(`Down Sector ${this.sectorEnt.id}`, board => setSectorZ(board, this.sectorEnt, sectorZ(board, this.sectorEnt) + 32 * 16));
  }

  // private lotag(delta: number) {
  //   const board = this.ctx.board();
  //   const lotag = board.sectors[this.sectorEnt.id].lotag + delta;
  //   board.sectors[this.sectorEnt.id].lotag = lotag;
  //   this.ctx.bus.handle(new Commit(`Change Sector ${this.sectorEnt.id} Lo-Tag to ${delta}`));
  //   this.ctx.bus.handle(new BoardInvalidate(this.sectorEnt));
  // }

  // private hitag(delta: number) {
  //   const board = this.ctx.board();
  //   const hitag = board.sectors[this.sectorEnt.id].hitag + delta;
  //   board.sectors[this.sectorEnt.id].hitag = hitag;
  //   this.ctx.bus.handle(new Commit(`Change Sector ${this.sectorEnt.id} Hi-Tag to ${delta}`));
  //   this.ctx.bus.handle(new BoardInvalidate(this.sectorEnt));
  // }

  NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'delete': this.delete(); return;
      case 'fly': this.fly(); return;
      case 'fall': this.fall(); return;
      case 'up': this.up(); return;
      case 'down': this.down(); return;
      // case 'lotag+': this.lotag(1); return;
      // case 'lotag-': this.lotag(-1); return;
      // case 'hitag+': this.hitag(1); return;
      // case 'hitag-': this.hitag(-1); return;
    }
  }
}
