import { EngineApi } from "../../../build/board/mutations/api";
import { pushWall } from "../../../build/board/mutations/walls";
import { sectorOfWall } from "../../../build/board/query";
import { build2gl, createSlopeCalculator, wallNormal, ZSCALE } from "../../../build/utils";
import { vec3 } from "gl-matrix";
import { create, lifecycle, Module, plugin } from "../../../utils/injector";
import { dot2d, int } from "../../../utils/mathutils";
import { ART, ArtProvider, BOARD, BoardProvider, BuildReferenceTracker, ENGINE_API, GRID, GridController, REFERENCE_TRACKER, SnapType, View, VIEW } from "../../apis/app";
import { BUS, busDisconnector, MessageBus } from "../../apis/handler";
import { BuildersFactory, BUILDERS_FACTORY } from "../../modules/geometry/common";
import { LineBuilder } from "../../modules/gl/buffers";
import { MovingHandle } from "../handle";
import { Commit, Frame, INVALIDATE_ALL, NamedMessage, Render } from "../messages";
import { DefaultTool, TOOLS_BUS } from "./toolsbus";

const wnTmp = vec3.create();
const wn1Tmap = vec3.create();
const targetTmp = vec3.create();
const startTmp = vec3.create();
const dirTmp = vec3.create();

export async function PushWallModule(module: Module) {
  module.bind(plugin('PushWall'), lifecycle(async (injector, lifecycle) => {
    const bus = await injector.getInstance(TOOLS_BUS);
    const pushWall = await create(injector, PushWall, BUILDERS_FACTORY, ENGINE_API, VIEW, ART, BOARD, REFERENCE_TRACKER, BUS, GRID);
    lifecycle(bus.connect(pushWall), busDisconnector(bus));
  }));
}

export class PushWall extends DefaultTool {
  private wallId = -1;
  private copy = false;
  private movingHandle = new MovingHandle();

  constructor(
    builders: BuildersFactory,
    private api: EngineApi,
    private view: View,
    private art: ArtProvider,
    private board: BoardProvider,
    private refs: BuildReferenceTracker,
    private bus: MessageBus,
    private grid: GridController,
    private wireframe = builders.wireframe('utils')
  ) { super(); }

  private start(copy: boolean) {
    this.activate();
    this.copy = copy;
    const target = this.view.snapTarget(SnapType.WALL);
    if (target.entity == null || !target.entity.isWall()) return;
    this.wallId = target.entity.id;
    this.movingHandle.start(build2gl(targetTmp, target.coords));
  }

  private abort() {
    this.deactivate();
    this.wallId = -1;
    this.movingHandle.stop();
  }

  private stop() {
    pushWall(this.board(), this.wallId, this.getDistance(), this.art, this.copy, this.refs, this.api);
    this.bus.handle(new Commit(`Push Wall ${this.wallId}`));
    this.bus.handle(INVALIDATE_ALL);
    this.abort();
  }

  private getDistance(): number {
    const dx = this.movingHandle.dx;
    const dy = this.movingHandle.dy;
    const [nx, , ny] = wallNormal(wn1Tmap, this.board(), this.wallId);
    return this.grid.snap(dot2d(nx, ny, dx, dy));
  }

  public NamedMessage(msg: NamedMessage,) {
    switch (msg.name) {
      case 'push_wall': this.movingHandle.isActive() ? this.stop() : this.start(false); return;
      case 'push_wall_copy': this.movingHandle.isActive() ? this.stop() : this.start(true); return;
      case 'push_wall_stop': this.movingHandle.isActive() ? this.abort() : null; return;
    }
  }

  public Frame(msg: Frame) {
    if (this.movingHandle.isActive()) {
      const { start, dir } = this.view.dir();
      this.movingHandle.update(false, false, build2gl(startTmp, start), build2gl(dirTmp, dir));
    }
  }

  public Render(msg: Render) {
    if (!this.movingHandle.isActive()) return;
    this.updateWireframe();
    msg.consumer(this.wireframe);
  }

  private updateWireframe() {
    const board = this.board();
    const normal = wallNormal(wnTmp, board, this.wallId);
    const [nx, , ny] = vec3.scale(normal, normal, this.getDistance());
    const wall = board.walls[this.wallId];
    const wall2 = board.walls[wall.point2];
    const sectorId = sectorOfWall(board, this.wallId);
    const sector = board.sectors[sectorId];
    const x1 = int(wall.x + nx), y1 = int(wall.y + ny);
    const x2 = int(wall2.x + nx), y2 = int(wall2.y + ny);
    const slopeCalc = createSlopeCalculator(board, sectorId);
    const z1 = (slopeCalc(x1, y1, sector.floorheinum) + sector.floorz) / ZSCALE;
    const z2 = (slopeCalc(x1, y1, sector.ceilingheinum) + sector.ceilingz) / ZSCALE;
    const z3 = (slopeCalc(x2, y2, sector.ceilingheinum) + sector.ceilingz) / ZSCALE;
    const z4 = (slopeCalc(x2, y2, sector.floorheinum) + sector.floorz) / ZSCALE;
    const z5 = (slopeCalc(wall.x, wall.y, sector.floorheinum) + sector.floorz) / ZSCALE;
    const z6 = (slopeCalc(wall.x, wall.y, sector.ceilingheinum) + sector.ceilingz) / ZSCALE;
    const z7 = (slopeCalc(wall2.x, wall2.y, sector.ceilingheinum) + sector.ceilingz) / ZSCALE;
    const z8 = (slopeCalc(wall2.x, wall2.y, sector.floorheinum) + sector.floorz) / ZSCALE;

    const line = new LineBuilder();
    this.wireframe.needToRebuild();
    line.rect(x1, z1, y1, x1, z2, y1, x2, z3, y2, x2, z4, y2);
    line.segment(x1, z1, y1, wall.x, z5, wall.y);
    line.segment(x1, z2, y1, wall.x, z6, wall.y);
    line.segment(x2, z3, y2, wall2.x, z7, wall2.y);
    line.segment(x2, z4, y2, wall2.x, z8, wall2.y);
    line.build(this.wireframe.buff);
  }
}