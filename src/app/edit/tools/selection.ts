import { deleteLoop, deleteLoopFull, deleteSectorFull, fillInnerLoop, insertSprite, loopWalls, loopWallsFull, nextwall, setFirstWall } from "../../../build/boardutils";
import { Entity, EntityType, Target } from "../../../build/hitscan";
import { Board } from "../../../build/structs";
import { build2gl, sectorOfWall } from "../../../build/utils";
import { vec3 } from "../../../libs_js/glmatrix";
import { Collection, Deck } from "../../../utils/collections";
import { create, Dependency, Injector } from "../../../utils/injector";
import { error, info } from "../../../utils/logger";
import { detuple0, detuple1 } from "../../../utils/mathutils";
import { BUS, Message, MessageHandler, MessageHandlerList, MessageHandlerReflective } from "../../apis/handler";
import { RenderablesCache, RENDRABLES_CACHE } from "../../modules/geometry/cache";
import { EntityFactory, ENTITY_FACTORY } from "../context";
import { MovingHandle } from "../handle";
import { BoardInvalidate, EndMove, Frame, Highlight, Move, NamedMessage, Render, SetPicnum, Shade, StartMove } from "../messages";

export type PicNumCallback = (picnum: number) => void;
export type PicNumSelector = (cb: PicNumCallback) => void;
export const PicNumSelector_ = new Dependency<PicNumSelector>('PicNumSelector');

const handle = new MovingHandle();
const MOVE = new Move(0, 0, 0);
const START_MOVE = new StartMove();
const END_MOVE = new EndMove();
const SET_PICNUM = new SetPicnum(-1);
const HIGHLIGHT = new Highlight();


const MOVE_STATE = 'move';
const LOOP_STATE = 'select_loop_mod';
const FULL_LOOP_STATE = 'select_full_loop_mod';
const SNAP_DIST = 'select.snap_dist';

export const MOVE_COPY = 'move.copy';
export const MOVE_VERTICAL = 'move.vertical';
export const MOVE_PARALLEL = 'move.parallel';
export const MOVE_ROTATE = 'move.rotate';

const clipboardPicnum = new SetPicnum(0);
const clipboardShade = new Shade(0, true);

// function getAttachedSector(board: Board, hit: Hitscan): MessageHandler {
//   const wall = board.walls[hit.ent.id];
//   const sectorId = wall.nextsector == -1 ? sectorOfWall(board, hit.ent.id) : wall.nextsector;
//   const [x, y, z] = hit.target();
//   const type = getClosestSectorZ(board, sectorId, x, y, z)[0];
//   return SectorEnt.create(hit.ent.clone());
// }

const list = new Deck<MessageHandler>();
const segment = new Deck<number>();
export function getFromHitscan(factory: EntityFactory): Deck<MessageHandler> {
  const target = factory.ctx.view.snapTarget();
  list.clear();
  if (target.entity == null) return list;
  const fullLoop = factory.ctx.state.get<boolean>(FULL_LOOP_STATE)
    ? loopWallsFull
    : factory.ctx.state.get<boolean>(LOOP_STATE)
      ? loopWalls
      : null;
  const board = factory.ctx.board();
  if (target.entity.type == EntityType.WALL_POINT) {
    const w = target.entity.id;
    list.push(fullLoop ? factory.wallSegment(fullLoop(board, w)) : factory.wall(w));
  } else if (target.entity.isWall()) {
    wallSegment(fullLoop, factory, target.entity.id, target.entity.type == EntityType.LOWER_WALL);
  } else if (target.entity.isSector()) {
    sector(fullLoop, target, factory);
  } else if (target.entity.isSprite()) {
    list.push(factory.sprite(target.entity.id));
  }
  return list;
}

function sector(fullLoop: (board: Board, wallId: number) => Collection<number>, target: Target, factory: EntityFactory) {
  const board = factory.ctx.board();
  if (fullLoop) {
    const firstWall = board.sectors[target.entity.id].wallptr;
    list.push(factory.wallSegment(fullLoop(board, firstWall)));
    list.push(factory.sector(new Entity(target.entity.id, target.entity.type == EntityType.CEILING ? EntityType.FLOOR : EntityType.CEILING)));
  }
  list.push(factory.sector(target.entity.clone()));
}

function wallSegment(fullLoop: (board: Board, wallId: number) => Collection<number>, factory: EntityFactory, w: number, bottom: boolean) {
  const board = factory.ctx.board();
  if (fullLoop) {
    list.push(factory.wallSegment(fullLoop(board, w), bottom));
  } else {
    const w1 = nextwall(board, w);
    segment.clear().push(w).push(w1);
    list.push(factory.wallSegment(segment, bottom));
  }
}

const target_ = vec3.create();
const start_ = vec3.create();
const dir_ = vec3.create();

export const Selection_ = new Dependency<Selection>('Selection');

export async function SelectionModule(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  bus.connect(await create(injector, Selection, PicNumSelector_, RENDRABLES_CACHE, ENTITY_FACTORY));
}

export class Selection extends MessageHandlerReflective {
  private selection = new MessageHandlerList();
  private valid = true;

  constructor(
    private picnumSelector: PicNumSelector,
    private renderables: RenderablesCache,
    private factory: EntityFactory,
    private ctx = factory.ctx) {
    super();
    ctx.state.register(MOVE_STATE, false);
    ctx.state.register(MOVE_COPY, false);
    ctx.state.register(MOVE_VERTICAL, false);
    ctx.state.register(MOVE_PARALLEL, false);
    ctx.state.register(MOVE_ROTATE, false);
    ctx.state.register(LOOP_STATE, false);
    ctx.state.register(FULL_LOOP_STATE, false);
    ctx.state.register(SNAP_DIST, 32);
  }

  public Frame(msg: Frame) {
    if (!handle.isActive()) this.selection.list().clear().pushAll(getFromHitscan(this.factory));
    if (this.selection.list().isEmpty()) return;
    if (this.activeMove()) {
      this.updateHandle();
      try {
        this.updateMove();
      } catch (e) {
        this.valid = false;
        error(e);
      }
    }
  }

  public NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'set_picnum': this.setTexture(); /*this.ctx.commit();*/ return;
      case 'insert_sprite': this.insertSprite(); /*this.ctx.commit();*/ return;
      case 'copy': this.copy(); return;
      case 'paste_shade': this.selection.handle(clipboardShade); /*this.ctx.commit();*/ return;
      case 'paste_picnum': this.selection.handle(clipboardPicnum); /*this.ctx.commit();*/ return;
      case 'print_selected': this.print(); return;
      case 'set_first_wall': this.setFirstWall(); return;
      case 'fill_inner_sector': this.fillInnerLoop(); return;
      case 'delete_loop': this.deleteLoop(); return;
      case 'delete_full': this.deleteFull(); return;
      default: this.selection.handle(msg);
    }
  }

  public handleDefault(msg: Message) {
    this.selection.handle(msg);
  }

  private activeMove() {
    const start = !handle.isActive() && this.ctx.state.get(MOVE_STATE);
    if (this.valid == false && start) this.valid = true;
    const move = handle.isActive() && this.ctx.state.get(MOVE_STATE);
    const end = handle.isActive() && !this.ctx.state.get(MOVE_STATE);
    return this.valid && (start || move || end);
  }

  private updateHandle() {
    const vertical = this.ctx.state.get<boolean>(MOVE_VERTICAL);
    const parallel = this.ctx.state.get<boolean>(MOVE_PARALLEL);
    const { start, dir } = this.ctx.view.dir();
    handle.update(vertical, parallel, build2gl(start_, start), build2gl(dir_, dir));
  }

  private updateMove() {
    if (!handle.isActive() && this.ctx.state.get(MOVE_STATE)) {
      handle.start(build2gl(target_, this.ctx.view.target().coords));
      this.selection.handle(START_MOVE);
    } else if (!this.ctx.state.get(MOVE_STATE)) {
      handle.stop();
      this.selection.handle(END_MOVE);
      // this.ctx.commit();
      return;
    }

    MOVE.dx = handle.dx;
    MOVE.dy = handle.dy;
    MOVE.dz = handle.dz;
    this.selection.handle(MOVE);
  }

  private setFirstWall() {
    const target = this.ctx.view.snapTarget();
    if (target.entity == null || !target.entity.isWall()) return;
    setFirstWall(this.ctx.board(), sectorOfWall(this.ctx.board(), target.entity.id), target.entity.id, this.ctx.refs);
    // this.ctx.commit();
    this.ctx.bus.handle(new BoardInvalidate(null));
  }

  private fillInnerLoop() {
    const target = this.ctx.view.snapTarget();
    if (target.entity == null || !target.entity.isWall()) return;
    fillInnerLoop(this.ctx.board(), target.entity.id, this.ctx.refs);
    // this.ctx.commit();
    this.ctx.bus.handle(new BoardInvalidate(null));
  }

  private deleteLoop() {
    const target = this.ctx.view.snapTarget();
    if (target.entity == null || !target.entity.isWall()) return;
    deleteLoop(this.ctx.board(), target.entity.id, this.ctx.refs);
    // this.ctx.commit();
    this.ctx.bus.handle(new BoardInvalidate(null));
  }

  private deleteFull() {
    const target = this.ctx.view.snapTarget();
    if (target.entity == null) return;
    if (target.entity.isWall()) deleteLoopFull(this.ctx.board(), target.entity.id, this.ctx.refs);
    else if (target.entity.isSector()) deleteSectorFull(this.ctx.board(), target.entity.id, this.ctx.refs);
    else return;
    // this.ctx.commit();
    this.ctx.bus.handle(new BoardInvalidate(null));
  }

  private setTexture() {
    const sel = this.selection.clone();
    this.picnumSelector((picnum: number) => {
      if (picnum == -1) return;
      SET_PICNUM.picnum = picnum;
      sel.handle(SET_PICNUM);
    })
  }

  private insertSprite() {
    const target = this.ctx.view.snapTarget();
    if (target.entity == null || !target.entity.isSector()) return;
    const [x, y, z] = target.coords;
    this.picnumSelector((picnum: number) => {
      if (picnum == -1) return;
      const spriteId = insertSprite(this.ctx.board(), x, y, z);
      this.ctx.board().sprites[spriteId].picnum = picnum;
    });
  }

  private print() {
    const target = this.ctx.view.target();
    if (target.entity == null) return;
    switch (target.entity.type) {
      case EntityType.CEILING:
      case EntityType.FLOOR:
        info(target.entity.id, this.ctx.board().sectors[target.entity.id]);
        break;
      case EntityType.UPPER_WALL:
      case EntityType.MID_WALL:
      case EntityType.LOWER_WALL:
        info(target.entity.id, this.ctx.board().walls[target.entity.id]);
        break;
      case EntityType.SPRITE:
        info(target.entity.id, this.ctx.board().sprites[target.entity.id]);
        break;
    }
  }

  private copy() {
    const target = this.ctx.view.target();
    if (target.entity == null) return;
    switch (target.entity.type) {
      case EntityType.CEILING:
        clipboardShade.value = this.ctx.board().sectors[target.entity.id].ceilingshade;
        clipboardPicnum.picnum = this.ctx.board().sectors[target.entity.id].ceilingpicnum;
        break;
      case EntityType.FLOOR:
        clipboardShade.value = this.ctx.board().sectors[target.entity.id].floorshade;
        clipboardPicnum.picnum = this.ctx.board().sectors[target.entity.id].floorpicnum;
        break;
      case EntityType.LOWER_WALL:
      case EntityType.MID_WALL:
      case EntityType.UPPER_WALL:
        clipboardShade.value = this.ctx.board().walls[target.entity.id].shade;
        clipboardPicnum.picnum = this.ctx.board().walls[target.entity.id].picnum;
        break;
      case EntityType.SPRITE:
        clipboardShade.value = this.ctx.board().sprites[target.entity.id].shade;
        clipboardPicnum.picnum = this.ctx.board().sprites[target.entity.id].picnum;
        break;
    }
  }

  public Render(msg: Render) {
    HIGHLIGHT.set.clear();
    this.selection.handle(HIGHLIGHT);
    for (const v of HIGHLIGHT.set.keys()) {
      const type = detuple0(v);
      const id = detuple1(v);
      const rs = this.renderables.helpers;
      switch (type) {
        case 0: rs.sector(id).ceiling.accept(msg.consumer); break;
        case 1: rs.sector(id).floor.accept(msg.consumer); break;
        case 2: rs.wall(id).accept(msg.consumer); break;
        case 3: rs.wallPoint(id).accept(msg.consumer); break;
        case 4: rs.sprite(id).accept(msg.consumer); break;
      }
    }
  }
}


