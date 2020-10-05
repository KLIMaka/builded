import { deleteLoop, deleteLoopFull, deleteSectorFull, fillInnerLoop, insertSprite, setFirstWall, splitWall } from "../../../build/boardutils";
import { EntityType } from "../../../build/hitscan";
import { Board, WALL_SPRITE } from "../../../build/board/structs";
import { slope, vec2ang, wallNormal } from "../../../build/utils";
import { vec3 } from "../../../libs_js/glmatrix";
import { create, Injector } from "../../../utils/injector";
import { info } from "../../../utils/logger";
import { int } from "../../../utils/mathutils";
import { ART, ArtProvider, BOARD, BoardProvider, BuildReferenceTracker, REFERENCE_TRACKER, View, VIEW, GRID, GridController } from "../../apis/app";
import { BUS, MessageBus, MessageHandlerReflective } from "../../apis/handler";
import { COMMIT, INVALIDATE_ALL, NamedMessage } from "../messages";
import { PicNumSelector, PICNUM_SELECTOR } from "./selection";
import { invalidateSectorAndWalls } from "../editutils";
import { sectorOfWall } from "../../../build/board/query";

export async function UtilsModule(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  bus.connect(await create(injector, Utils, BOARD, ART, VIEW, BUS, REFERENCE_TRACKER, GRID, PICNUM_SELECTOR));
}

class Utils extends MessageHandlerReflective {
  constructor(
    private board: BoardProvider,
    private art: ArtProvider,
    private view: View,
    private bus: MessageBus,
    private refs: BuildReferenceTracker,
    private gridController: GridController,
    private picnumSelector: PicNumSelector
  ) { super() }

  public NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'insert_sprite': this.insertSprite(); return;
      // case 'print_selected': this.print(); return;
      case 'set_first_wall': this.setFirstWall(); return;
      case 'fill_inner_sector': this.fillInnerLoop(); return;
      case 'delete_loop': this.deleteLoop(); return;
      case 'delete_full': this.deleteFull(); return;
      case 'print_usage': this.printPicUsage(); return;
      case 'split_wall': this.splitWall(); return;
    }
  }

  private insertSprite() {
    const target = this.view.snapTarget();
    if (target.entity == null) return;
    const [x, y, z] = target.coords;
    const ent = target.entity;
    this.picnumSelector((picnum: number) => {
      if (picnum == -1) return;
      const board = this.board();
      if (ent.isWall()) {
        const normal = wallNormal(vec3.create(), board, ent.id);
        const offx = normal[0] * 4;
        const offy = normal[2] * 4;
        const spriteId = insertSprite(board, int(x + offx), int(y + offy), this.gridController.snap(z));
        const sprite = board.sprites[spriteId];
        sprite.picnum = picnum;
        sprite.cstat.type = WALL_SPRITE;
        sprite.ang = vec2ang(normal[0], normal[2]);
      } else {
        const spriteId = insertSprite(board, x, y, z);
        const sprite = board.sprites[spriteId];
        sprite.picnum = picnum;
      }
      this.commit();
    });
  }

  private setFirstWall() {
    const target = this.view.snapTarget();
    if (target.entity == null || !target.entity.isWall()) return;
    setFirstWall(this.board(), sectorOfWall(this.board(), target.entity.id), target.entity.id, this.refs);
    this.commit();
    this.invalidateAll();
  }

  private fillInnerLoop() {
    const target = this.view.snapTarget();
    if (target.entity == null || !target.entity.isWall()) return;
    fillInnerLoop(this.board(), target.entity.id, this.refs);
    this.commit();
    this.invalidateAll();
  }

  private deleteLoop() {
    const target = this.view.snapTarget();
    if (target.entity == null || !target.entity.isWall()) return;
    deleteLoop(this.board(), target.entity.id, this.refs);
    this.commit();
    this.invalidateAll();
  }

  private deleteFull() {
    const target = this.view.snapTarget();
    if (target.entity == null) return;
    if (target.entity.isWall()) deleteLoopFull(this.board(), target.entity.id, this.refs);
    else if (target.entity.isSector()) deleteSectorFull(this.board(), target.entity.id, this.refs);
    else return;
    this.commit();
    this.invalidateAll();
  }

  private splitWall() {
    const target = this.view.snapTarget();
    if (target.entity == null || !target.entity.isWall()) return;
    const [x, y] = target.coords;
    const id = target.entity.id;
    const board = this.board();

    splitWall(board, id, x, y, this.art, this.refs);
    this.commit();
    const s = sectorOfWall(board, id);
    invalidateSectorAndWalls(s, board, this.bus);
    const nextsector = board.walls[id].nextsector;
    if (nextsector != -1) {
      invalidateSectorAndWalls(nextsector, board, this.bus);
    }
  }

  private print() {
    const target = this.view.target();
    const board = this.board();
    if (target.entity == null) return;
    switch (target.entity.type) {
      case EntityType.CEILING:
      case EntityType.FLOOR:
        info(target.entity.id, board.sectors[target.entity.id]);
        break;
      case EntityType.UPPER_WALL:
      case EntityType.MID_WALL:
      case EntityType.LOWER_WALL:
        info(target.entity.id, board.walls[target.entity.id]);
        break;
      case EntityType.SPRITE:
        info(target.entity.id, board.sprites[target.entity.id]);
        break;
    }
  }

  private getSectorPics(board: Board, sectorId: number) {
    const sector = board.sectors[sectorId];
    const pics = new Set<number>();
    pics.add(sector.ceilingpicnum);
    pics.add(sector.floorpicnum);
    const wallend = sector.wallptr + sector.wallnum;
    for (let w = sector.wallptr; w < wallend; w++) {
      const wall = board.walls[w];
      if (wall.nextwall == -1) {
        pics.add(wall.picnum);
      } else {
        const wall2 = board.walls[wall.point2];
        const nextwall = board.walls[wall.nextwall];
        const nextwall2 = board.walls[nextwall.nextwall];
        const nextsectorId = wall.nextsector;
        const nextsector = board.sectors[nextsectorId];
        const cz1 = slope(board, sectorId, wall.x, wall.y, sector.ceilingheinum) + sector.ceilingz;
        const cz2 = slope(board, sectorId, wall2.x, wall2.y, sector.ceilingheinum) + sector.ceilingz;
        const czn1 = slope(board, nextsectorId, nextwall.x, nextwall.y, nextsector.ceilingheinum) + sector.ceilingz;
        const czn2 = slope(board, nextsectorId, nextwall2.x, nextwall2.y, nextsector.ceilingheinum) + sector.ceilingz;
        if (cz1 < czn1 || cz2 < czn2) pics.add(wall.picnum);

        const fz1 = slope(board, sectorId, wall.x, wall.y, sector.floorheinum) + sector.floorz;
        const fz2 = slope(board, sectorId, wall2.x, wall2.y, sector.floorheinum) + sector.floorz;
        const fzn1 = slope(board, nextsectorId, nextwall.x, nextwall.y, nextsector.floorheinum) + sector.floorz;
        const fzn2 = slope(board, nextsectorId, nextwall2.x, nextwall2.y, nextsector.floorheinum) + sector.floorz;
        if (fz1 > fzn1 || fz2 > fzn2) {
          if (wall.cstat.swapBottoms) pics.add(wall2.picnum);
          else pics.add(wall.picnum);
        }

        if (wall.cstat.masking) pics.add(wall.overpicnum);
      }
    }
    return pics;
  }

  private printPicUsage() {
    // const board = this.board();
    // const results: [string, number][] = [];
    // const picsStat = new Map<number, Set<number>>();
    // for (let s = 0; s < board.numsectors; s++) {
    //   const pics = [...this.getSectorPics(board, s)];
    //   results.push([pics.sort().join(','), s]);
    //   pics.forEach(p => {
    //     let sectors = picsStat.get(p);
    //     if (sectors == undefined) {
    //       sectors = new Set();
    //       picsStat.set(p, sectors);
    //     }
    //     sectors.add(s);
    //   })
    // }
    // info([...picsStat.values()].sort((l, r) => l.size - r.size));

    // const imgStats = new Map<string, Set<number>>();
    // const art = this.art;
    // for (let i = 0; i < 4096; i++) {
    //   const info = art.getInfo(i);
    //   if (info == null) continue;
    //   const key = `${info.w}x${info.h}`;
    //   let ids = imgStats.get(key);
    //   if (ids == undefined) {
    //     ids = new Set();
    //     imgStats.set(key, ids);
    //   }
    //   ids.add(i);
    // }
    // info([...imgStats.entries()].sort((l, r) => l[1].size - r[1].size));
    const target = this.view.target();
    if (!target.entity.isSector()) return;
    const board = this.board();
    const art = this.art;
    const sectorId = target.entity.id;
    const pics = new Set<number>();
    const sectors = new Set<number>();
    const sizes = new Set<string>();

    const sector = board.sectors[sectorId];
    const pf = (p: number) => { pics.add(p); const i = art.getInfo(p); sizes.add(`${i.w}x${i.h}`) };
    this.getSectorPics(board, sectorId).forEach(pf);
    const wallend = sector.wallptr + sector.wallnum;
    for (let w = sector.wallptr; w < wallend; w++) {
      const wall = board.walls[w];
      if (wall.nextsector == -1) continue;
      const nextsector = wall.nextsector;
      if (sectors.has(nextsector)) continue;
      this.getSectorPics(board, nextsector).forEach(pf);
      sectors.add(nextsector);
    }
    info(pics, sectors, sizes);
  }

  private commit() { this.bus.handle(COMMIT) }
  private invalidateAll() { this.bus.handle(INVALIDATE_ALL) }
}