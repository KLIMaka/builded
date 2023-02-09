import { EngineApi } from "../../build/board/mutations/api";
import { Entity } from "../../build/hitscan";
import { Dependency, getInstances, Injector, provider } from "../../utils/injector";
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
  const [board, api, view, gridController, bus, state, refs, art] = await 
  getInstances(injector, BOARD, ENGINE_API, VIEW, GRID, BUS, STATE, REFERENCE_TRACKER, ART);
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

export const EntityFactoryConstructor = provider(async (injector: Injector) => {
  const ctx = await EditContextConstructor(injector);
  return new EntityFactory(ctx);
});

