import { } from "../../../build/board/internal";
import { loopWallsFull, loopWalls } from "../../../build/board/loops";
import { Board } from "../../../build/board/structs";
import { nextwall } from "../../../build/boardutils";
import { Entity, EntityType, Target } from "../../../build/hitscan";
import { build2gl } from "../../../build/utils";
import { vec3 } from "../../../libs_js/glmatrix";
import { Deck, isEmpty } from "../../../utils/collections";
import { create, Dependency, Injector } from "../../../utils/injector";
import { error } from "../../../utils/logger";
import { detuple0, detuple1 } from "../../../utils/mathutils";
import { BUS, Message, MessageHandler, MessageHandlerList, MessageHandlerReflective } from "../../apis/handler";
import { RenderablesCache, RENDRABLES_CACHE } from "../../modules/geometry/cache";
import { EntityFactory, ENTITY_FACTORY } from "../context";
import { MovingHandle } from "../handle";
import { COMMIT, EndMove, Frame, Highlight, Move, NamedMessage, Render, SetPicnum, Shade, StartMove } from "../messages";
import { SectorEnt } from "../sector";
import { SpriteEnt } from "../sprite";
import { WallEnt } from "../wall";
import { WallSegmentsEnt } from "../wallsegment";

export type PicNumCallback = (picnum: number) => void;
export type PicNumSelector = (cb: PicNumCallback) => void;
export const PICNUM_SELECTOR = new Dependency<PicNumSelector>('PicNumSelector');

const handle = new MovingHandle();
const MOVE = new Move(0, 0, 0);
const START_MOVE = new StartMove();
const END_MOVE = new EndMove();
const SET_PICNUM = new SetPicnum(-1);
const HIGHLIGHT = new Highlight();

const MOVE_STATE = 'move';
const LOOP_STATE = 'select_loop_mod';
const FULL_LOOP_STATE = 'select_full_loop_mod';

export const MOVE_COPY = 'move.copy';
export const MOVE_VERTICAL = 'move.vertical';
export const MOVE_PARALLEL = 'move.parallel';

const clipboardPicnum = new SetPicnum(0);
const clipboardShade = new Shade(0, true);

const list = new Deck<MessageHandler>();
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

function sector(fullLoop: (board: Board, wallId: number) => Iterable<number>, target: Target, factory: EntityFactory) {
  const board = factory.ctx.board();
  if (fullLoop) {
    const firstWall = board.sectors[target.entity.id].wallptr;
    list.push(factory.wallSegment(fullLoop(board, firstWall)));
    const type = target.entity.type == EntityType.CEILING ? EntityType.FLOOR : EntityType.CEILING;
    list.push(factory.sector(new Entity(target.entity.id, type)));
  }
  list.push(factory.sector(target.entity.clone()));
}

function wallSegment(fullLoop: (board: Board, wallId: number) => Iterable<number>, factory: EntityFactory, w: number, bottom: boolean) {
  const board = factory.ctx.board();
  if (fullLoop) {
    const loop = fullLoop(board, w);
    list.push(factory.wallSegment(loop, loop, bottom));
  } else {
    const w1 = nextwall(board, w);
    list.push(factory.wallSegment([w, w1], [w], bottom));
  }
}

const target_ = vec3.create();
const start_ = vec3.create();
const dir_ = vec3.create();

export async function SelectionModule(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  bus.connect(await create(injector, Selection, PICNUM_SELECTOR, RENDRABLES_CACHE, ENTITY_FACTORY));
}

export class Selection extends MessageHandlerReflective {
  private selection = new MessageHandlerList();
  private highlighted = new MessageHandlerList();
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
    ctx.state.register(LOOP_STATE, false);
    ctx.state.register(FULL_LOOP_STATE, false);
  }

  public Frame(msg: Frame) {
    if (!handle.isActive()) this.updateSelection();
    if (isEmpty(this.selection.list()) && isEmpty(this.highlighted.list())) return;
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

  private updateSelection() {
    const underCursor = getFromHitscan(this.factory);
    this.highlighted.list().clear().pushAll(underCursor.clone());
  }

  private checkSelected(ent: Entity, s: any) {
    if (ent.isSector() && s instanceof SectorEnt && ent.id == s.sectorEnt.id && ent.type == s.sectorEnt.type) return true;
    if (ent.isSprite() && s instanceof SpriteEnt && ent.id == s.spriteId) return true;
    if (ent.isWall()) {
      if (s instanceof WallEnt && ent.id == s.wallId) return true;
      if (s instanceof WallSegmentsEnt) for (const w of s.highlighted) if (w == ent.id) return true;
    }
    return false;
  }

  private selectedUnderCursor(): boolean {
    const snapTarget = this.ctx.view.snapTarget();
    if (snapTarget.entity == null) return false;
    const ent = snapTarget.entity;
    for (const s of this.selection.list()) if (this.checkSelected(ent, s)) return true;
    for (const s of this.highlighted.list()) if (this.checkSelected(ent, s)) return true;
    return false;
  }

  public NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'set_picnum': this.setTexture(); return;
      case 'copy': this.copy(); return;
      case 'paste_shade': this.handleSelected(clipboardShade); this.commit(); return;
      case 'paste_picnum': this.handleSelected(clipboardPicnum); this.commit(); return;
      case 'replace_selection': if (!handle.isActive()) this.selection.list().clear().pushAll(this.highlighted.list().clone()); return;
      case 'add_selection': this.selection.list().pushAll(this.highlighted.list().clone()); return;
      case 'clear_selection': this.selection.list().clear(); return;
      default: this.handleSelected(msg);
    }
  }

  public handleDefault(msg: Message) {
    this.handleSelected(msg);
  }

  private handleSelected(msg: Message) {
    this.highlighted.handle(msg);
    this.selection.handle(msg);
  }

  private commit() {
    this.ctx.bus.handle(COMMIT);
  }

  private cloneSelected() {
    const selected = this.highlighted.clone();
    selected.list().pushAll(this.selection.list());
    return selected;
  }

  private isStartMove() {
    return !handle.isActive() && this.ctx.state.get(MOVE_STATE) && this.selectedUnderCursor();
  }

  private activeMove() {
    const start = this.isStartMove();
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
    if (this.isStartMove()) {
      handle.start(build2gl(target_, this.ctx.view.target().coords));
      this.handleSelected(START_MOVE);
    } else if (!this.ctx.state.get(MOVE_STATE)) {
      handle.stop();
      this.handleSelected(END_MOVE);
      this.commit();
      return;
    }

    if (Math.abs(MOVE.dx - handle.dx) >= this.ctx.gridController.getGridSize() / 2
      || Math.abs(MOVE.dy - handle.dy) >= this.ctx.gridController.getGridSize() / 2
      || Math.abs(MOVE.dz - handle.dz) >= this.ctx.gridController.getGridSize() / 2) {
      MOVE.dx = handle.dx;
      MOVE.dy = handle.dy;
      MOVE.dz = handle.dz;
      this.handleSelected(MOVE);
    }
  }

  private setTexture() {
    const sel = this.cloneSelected();
    this.picnumSelector((picnum: number) => {
      if (picnum == -1) return;
      SET_PICNUM.picnum = picnum;
      sel.handle(SET_PICNUM);
      this.commit();
    })
  }

  private copy() {
    const target = this.ctx.view.target();
    const board = this.ctx.board();
    if (target.entity == null) return;
    switch (target.entity.type) {
      case EntityType.CEILING:
        clipboardShade.value = board.sectors[target.entity.id].ceilingshade;
        clipboardPicnum.picnum = board.sectors[target.entity.id].ceilingpicnum;
        break;
      case EntityType.FLOOR:
        clipboardShade.value = board.sectors[target.entity.id].floorshade;
        clipboardPicnum.picnum = board.sectors[target.entity.id].floorpicnum;
        break;
      case EntityType.LOWER_WALL:
      case EntityType.MID_WALL:
      case EntityType.UPPER_WALL:
        clipboardShade.value = board.walls[target.entity.id].shade;
        clipboardPicnum.picnum = board.walls[target.entity.id].picnum;
        break;
      case EntityType.SPRITE:
        clipboardShade.value = board.sprites[target.entity.id].shade;
        clipboardPicnum.picnum = board.sprites[target.entity.id].picnum;
        break;
    }
  }

  public Render(msg: Render) {
    HIGHLIGHT.set.clear();
    this.handleSelected(HIGHLIGHT);
    for (const v of HIGHLIGHT.set.keys()) {
      const type = detuple0(v);
      const id = detuple1(v);
      const rs = this.renderables.helpers;
      switch (type) {
        case 0: msg.consumer(rs.sector(id).ceiling); break;
        case 1: msg.consumer(rs.sector(id).floor); break;
        case 2: msg.consumer(rs.wall(id)); break;
        case 3: msg.consumer(rs.wallPoint(id)); break;
        case 4: msg.consumer(rs.sprite(id)); break;
      }
    }
  }
}


