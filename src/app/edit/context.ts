import { Entity } from "../../build/hitscan";
import { Board } from "../../build/structs";
import { Injector, Dependency } from "../../utils/injector";
import { BOARD, BuildReferenceTracker, REFERENCE_TRACKER, State, STATE, View, VIEW, ArtProvider, ART, BoardProvider } from "../apis/app";
import { BUS, MessageBus } from "../apis/handler";
import { GridController, GRID } from "../modules/context";
import { SectorEnt } from "./sector";
import { SpriteEnt } from "./sprite";
import { WallEnt } from "./wall";
import { WallSegmentsEnt } from "./wallsegment";

export class EditContext {
  readonly board: BoardProvider;
  readonly view: View
  readonly gridController: GridController;
  readonly bus: MessageBus;
  readonly state: State;
  readonly refs: BuildReferenceTracker;
  readonly art: ArtProvider;
}

export async function EditContextConstructor(injector: Injector): Promise<EditContext> {
  const [board, view, gridController, bus, state, refs, art] = await Promise.all([
    injector.getInstance(BOARD),
    injector.getInstance(VIEW),
    injector.getInstance(GRID),
    injector.getInstance(BUS),
    injector.getInstance(STATE),
    injector.getInstance(REFERENCE_TRACKER),
    injector.getInstance(ART),
  ]);
  return { board, view, gridController, bus, state, refs, art }
}

export class EntityFactory {
  constructor(readonly ctx: EditContext) { }

  public sector(ent: Entity): SectorEnt { return new SectorEnt(ent, this.ctx) }
  public sprite(id: number): SpriteEnt { return new SpriteEnt(id, this.ctx) }
  public wall(id: number): WallEnt { return new WallEnt(id, this.ctx) }
  public wallSegment(ids: Iterable<number>, bottom = false): WallSegmentsEnt { return new WallSegmentsEnt(ids, bottom, this.ctx) }
}
export const ENTITY_FACTORY = new Dependency<EntityFactory>('Entity Factory');

export async function EntityFactoryConstructor(injector: Injector): Promise<EntityFactory> {
  const ctx = await EditContextConstructor(injector);
  return new EntityFactory(ctx);
}

