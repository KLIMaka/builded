import { EngineApi } from "../../build/board/mutations/api";
import { Entity } from "../../build/hitscan";
import { Dependency, Injector } from "../../utils/injector";
import { ART, ArtProvider, BOARD, BoardProvider, BuildReferenceTracker, REFERENCE_TRACKER, State, STATE, View, VIEW, GridController, GRID, ENGINE_API } from "../apis/app";
import { BUS, MessageBus } from "../apis/handler";
import { SectorEnt } from "./sector";
import { SpriteEnt } from "./sprite";
import { WallEnt } from "./wall";
import { WallSegmentsEnt } from "./wallsegment";

export class EditContext {
  readonly board: BoardProvider;
  readonly api: EngineApi;
  readonly view: View
  readonly gridController: GridController;
  readonly bus: MessageBus;
  readonly state: State;
  readonly refs: BuildReferenceTracker;
  readonly art: ArtProvider;
}

export async function EditContextConstructor(injector: Injector): Promise<EditContext> {
  const [board, api, view, gridController, bus, state, refs, art] = await Promise.all([
    injector.getInstance(BOARD),
    injector.getInstance(ENGINE_API),
    injector.getInstance(VIEW),
    injector.getInstance(GRID),
    injector.getInstance(BUS),
    injector.getInstance(STATE),
    injector.getInstance(REFERENCE_TRACKER),
    injector.getInstance(ART),
  ]);
  return { board, api, view, gridController, bus, state, refs, art }
}

export class EntityFactory {
  constructor(readonly ctx: EditContext) { }

  public sector(ent: Entity): SectorEnt { return new SectorEnt(ent, this.ctx) }
  public sprite(id: number): SpriteEnt { return new SpriteEnt(id, this.ctx) }
  public wall(id: number): WallEnt { return new WallEnt(id, this.ctx) }
  public wallSegment(ids: Iterable<number>, hids: Iterable<number> = ids, bottom = false): WallSegmentsEnt { return new WallSegmentsEnt(ids, hids, bottom, this.ctx) }
}
export const ENTITY_FACTORY = new Dependency<EntityFactory>('Entity Factory');

export async function EntityFactoryConstructor(injector: Injector): Promise<EntityFactory> {
  const ctx = await EditContextConstructor(injector);
  return new EntityFactory(ctx);
}

