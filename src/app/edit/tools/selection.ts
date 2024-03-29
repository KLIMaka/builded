import { innerWalls, loopWalls, samePicnumWalls } from "../../../build/board/loops";
import { nextwall } from "../../../build/board/query";
import { Board } from "../../../build/board/structs";
import { Entity, EntityType, Target } from "../../../build/hitscan";
import { Deck, map } from "../../../utils/collections";
import { create, Dependency, getInstances, instance, lifecycle, Module, plugin } from "../../../utils/injector";
import { detuple0, detuple1 } from "../../../utils/mathutils";
import { SnapType, STATE } from "../../apis/app";
import { busDisconnector, Message, MessageHandler, MessageHandlerList, NULL_MESSAGE_HANDLER } from "../../apis/handler";
import { RenderablesCache, RENDRABLES_CACHE } from "../../modules/geometry/cache";
import { EntityFactory, ENTITY_FACTORY } from "../context";
import { Frame, Highlight, NamedMessage, Render } from "../messages";
import { DefaultTool, TOOLS_BUS } from "./toolsbus";

export type PicNumCallback = (picnum: number) => void;
export type PicNumSelector = (cb: PicNumCallback) => void;
export const PICNUM_SELECTOR = new Dependency<PicNumSelector>('PicNumSelector');

const HIGHLIGHT = new Highlight();
const LOOP_STATE = 'select_loop_mod';
const FULL_LOOP_STATE = 'select_full_loop_mod';

const list = new Deck<MessageHandler>();
export function getFromHitscan(factory: EntityFactory, snapType: SnapType): Deck<MessageHandler> {
  list.clear();
  const targets = factory.ctx.view.snapTargets().get();
  const board = factory.ctx.board();
  for (const snapTarget of targets) {
    const target = snapTarget.target;
    if (target.entity == null) continue;
    if (target.entity.type == EntityType.WALL_POINT) {
      list.push(factory.wall(target.entity.id));
    } else if (target.entity.isWall()) {
      const w1 = nextwall(board, target.entity.id);
      list.push(factory.wallSegment([target.entity.clone(), Entity.of(w1, target.entity.type)], [target.entity.clone()]));
    } else if (target.entity.isSector()) {
      list.push(factory.sector(target.entity.clone()));
    } else if (target.entity.isSprite()) {
      list.push(factory.sprite(target.entity.id));
    }
  }

  // const fullLoop = factory.ctx.state.get<boolean>(FULL_LOOP_STATE)
  //   ? innerWalls
  //   : factory.ctx.state.get<boolean>(LOOP_STATE)
  //     ? loopWalls
  //     : null;
  // const board = factory.ctx.board();
  // if (target.entity.type == EntityType.WALL_POINT) {
  //   const w = target.entity.id;
  //   list.push(fullLoop ? factory.wallSegment([...map(fullLoop(board, w), ww => new Entity(ww, EntityType.WALL_POINT))]) : factory.wall(w));
  // } else if (target.entity.isWall()) {
  //   wallSegment(fullLoop, factory, target.entity);
  // } else if (target.entity.isSector()) {
  //   sector(fullLoop, target, factory);
  // } else if (target.entity.isSprite()) {
  //   list.push(factory.sprite(target.entity.id));
  // }
  return list;
}

function sector(fullLoop: (board: Board, wallId: number) => Iterable<number>, target: Target, factory: EntityFactory) {
  const board = factory.ctx.board();
  if (fullLoop) {
    const firstWall = board.sectors[target.entity.id].wallptr;
    list.push(factory.wallSegment([...map(fullLoop(board, firstWall), w => Entity.wallPoint(w))]));
    const type = target.entity.type == EntityType.CEILING ? EntityType.FLOOR : EntityType.CEILING;
    list.push(factory.sector(Entity.of(target.entity.id, type)));
  }
  list.push(factory.sector(target.entity.clone()));
}

function wallSegment(fullLoop: (board: Board, wallId: number) => Iterable<number>, factory: EntityFactory, wallEnt: Entity) {
  const board = factory.ctx.board();
  if (fullLoop) {
    const loop = [...map(fullLoop(board, wallEnt.id), w => Entity.of(w, wallEnt.type))];
    list.push(factory.wallSegment(loop, loop));
  } else {
    const w1 = nextwall(board, wallEnt.id);
    list.push(factory.wallSegment([wallEnt, Entity.of(w1, wallEnt.type)], [wallEnt]));
  }
}

export type Selected = () => MessageHandler;
export const SELECTED = new Dependency<Selected>('Selected');

export async function SelectionModule(module: Module) {
  let selection: Selection = null;
  module.bind(SELECTED, instance(() => selection == null ? NULL_MESSAGE_HANDLER : selection.cloneSelected()));
  module.bind(plugin('Selection'), lifecycle(async (injector, lifecycle) => {
    const [bus, state] = await getInstances(injector, TOOLS_BUS, STATE);
    const stateCleaner = async (s: string) => state.unregister(s);
    lifecycle(state.register(LOOP_STATE, false), stateCleaner);
    lifecycle(state.register(FULL_LOOP_STATE, false), stateCleaner);
    selection = await create(injector, Selection, RENDRABLES_CACHE, ENTITY_FACTORY);
    lifecycle(bus.connect(selection), busDisconnector(bus));
  }));
}

export class Selection extends DefaultTool {
  private selection = new MessageHandlerList();
  private highlighted = new MessageHandlerList();
  private selectionType = SnapType.GRID;

  constructor(
    private renderables: RenderablesCache,
    private factory: EntityFactory,
    private ctx = factory.ctx) { super() }

  public Frame(msg: Frame) {
    this.updateSelection();
  }

  private updateSelection() {
    const underCursor = getFromHitscan(this.factory, this.selectionType);
    this.highlighted.list().clear().pushAll(underCursor.clone());
  }

  // private checkSelected(ent: Entity, s: any) {
  //   if (ent.isSector() && s instanceof SectorEnt && ent.id == s.sectorEnt.id && ent.type == s.sectorEnt.type) return true;
  //   if (ent.isSprite() && s instanceof SpriteEnt && ent.id == s.spriteId) return true;
  //   if (ent.isWall()) {
  //     if (s instanceof WallEnt && ent.id == s.wallId) return true;
  //     if (s instanceof WallSegmentsEnt) for (const w of s.highlighted) if (w == ent.id) return true;
  //   }
  //   return false;
  // }

  // private selectedUnderCursor(): boolean {
  //   const snapTarget = this.ctx.view.snapTarget();
  //   if (snapTarget.entity == null) return false;
  //   const ent = snapTarget.entity;
  //   for (const s of this.selection.list()) if (this.checkSelected(ent, s)) return true;
  //   for (const s of this.highlighted.list()) if (this.checkSelected(ent, s)) return true;
  //   return false;
  // }

  public NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'add_selection': this.selection.list().pushAll(this.highlighted.list().clone()); return;
      case 'clear_selection': this.selection.list().clear(); return;
      case 'select_wall': this.selectionType = SnapType.WALL; return;
      case 'select_wall_point': this.selectionType = SnapType.POINT_ON_WALL; return;
      case 'select_sector': this.selectionType = SnapType.GRID; return;
      case 'select_sprite': this.selectionType = SnapType.SPRITE; return;
      default: this.handleSelected(msg);
    }
  }

  public handleDefault(msg: Message) {
    this.handleSelected(msg);
  }

  public handleSelected(msg: Message) {
    this.highlighted.handle(msg);
    this.selection.handle(msg);
  }

  public cloneSelected() {
    const selected = this.highlighted.clone();
    selected.list().pushAll(this.selection.list());
    return selected;
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


