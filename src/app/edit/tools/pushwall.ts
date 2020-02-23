import { pushWall } from "../../../build/boardutils";
import { Board } from "../../../build/structs";
import { build2gl, createSlopeCalculator, sectorOfWall, wallNormal, ZSCALE } from "../../../build/utils";
import { vec3 } from "../../../libs_js/glmatrix";
import { cyclicPairs } from "../../../utils/collections";
import { create, Injector } from "../../../utils/injector";
import { dot2d } from "../../../utils/mathutils";
import { ART, ArtProvider, BOARD, BuildReferenceTracker, REFERENCE_TRACKER, View, VIEW, BoardProvider } from "../../apis/app";
import { BUS, MessageBus, MessageHandlerReflective } from "../../apis/handler";
import { GRID, GridController } from "../../modules/context";
import { BuildersFactory, BUILDERS_FACTORY } from "../../modules/geometry/common";
import { MovingHandle } from "../handle";
import { BoardInvalidate, Frame, NamedMessage, Render } from "../messages";

const wallNormal_ = vec3.create();
const wallNormal1_ = vec3.create();
const target_ = vec3.create();
const start_ = vec3.create();
const dir_ = vec3.create();

export async function PushWallModule(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  bus.connect(await create(injector, PushWall, BUILDERS_FACTORY, VIEW, ART, BOARD, REFERENCE_TRACKER, BUS, GRID));
}

export class PushWall extends MessageHandlerReflective {
  private wallId = -1;
  private movingHandle = new MovingHandle();

  constructor(
    private builders: BuildersFactory,
    private view: View,
    private art: ArtProvider,
    private board: BoardProvider,
    private refs: BuildReferenceTracker,
    private bus: MessageBus,
    private grid: GridController,
    private wireframe = builders.wireframe('utils')
  ) { super(); }

  private start() {
    const target = this.view.snapTarget();
    if (target.entity == null || !target.entity.isWall()) return;
    this.wallId = target.entity.id;
    this.movingHandle.start(build2gl(target_, target.coords));
  }

  private abort() {
    this.wallId = -1;
    this.movingHandle.stop();
  }

  private stop(copy: boolean) {
    pushWall(this.board(), this.wallId, this.getDistance(), this.art, copy, this.refs);
    // this.commit();
    this.bus.handle(new BoardInvalidate(null));
    this.wallId = -1;
    this.movingHandle.stop();
  }

  private getDistance(): number {
    const dx = this.movingHandle.dx;
    const dy = this.movingHandle.dy;
    const [nx, , ny] = wallNormal(wallNormal1_, this.board(), this.wallId);
    return this.grid.snap(dot2d(nx, ny, dx, dy));
  }

  public NamedMessage(msg: NamedMessage, ) {
    switch (msg.name) {
      case 'push_wall': this.movingHandle.isActive() ? this.stop(false) : this.start(); return;
      case 'push_wall_copy': this.movingHandle.isActive() ? this.stop(true) : this.start(); return;
      case 'push_wall_stop': this.abort(); return;
    }
  }

  public Frame(msg: Frame) {
    if (this.movingHandle.isActive()) {
      const { start, dir } = this.view.dir();
      this.movingHandle.update(false, false, build2gl(start_, start), build2gl(dir_, dir));
    }
  }

  public Render(msg: Render) {
    if (!this.movingHandle.isActive()) return;
    this.updateWireframe();
    this.wireframe.accept(msg.consumer);
  }

  private updateWireframe() {
    const buff = this.wireframe.buff;
    const board = this.board();
    buff.allocate(8, 16);
    const normal = wallNormal(wallNormal_, board, this.wallId);
    const [nx, , ny] = vec3.scale(normal, normal, this.getDistance());
    const wall = board.walls[this.wallId];
    const wall2 = board.walls[wall.point2];
    const sectorId = sectorOfWall(board, this.wallId);
    const sector = board.sectors[sectorId];
    const x1 = wall.x + nx, y1 = wall.y + ny;
    const x2 = wall2.x + nx, y2 = wall2.y + ny;
    const slopeCalc = createSlopeCalculator(board, sectorId);
    const z1 = slopeCalc(x1, y1, sector.floorheinum) + sector.floorz;
    const z2 = slopeCalc(x1, y1, sector.ceilingheinum) + sector.ceilingz;
    const z3 = slopeCalc(x2, y2, sector.ceilingheinum) + sector.ceilingz;
    const z4 = slopeCalc(x2, y2, sector.floorheinum) + sector.floorz;
    const z5 = slopeCalc(wall.x, wall.y, sector.floorheinum) + sector.floorz;
    const z6 = slopeCalc(wall.x, wall.y, sector.ceilingheinum) + sector.ceilingz;
    const z7 = slopeCalc(wall2.x, wall2.y, sector.ceilingheinum) + sector.ceilingz;
    const z8 = slopeCalc(wall2.x, wall2.y, sector.floorheinum) + sector.floorz;
    buff.writePos(0, x1, z1 / ZSCALE, y1);
    buff.writePos(1, x1, z2 / ZSCALE, y1);
    buff.writePos(2, x2, z3 / ZSCALE, y2);
    buff.writePos(3, x2, z4 / ZSCALE, y2);
    buff.writePos(4, wall.x, z5 / ZSCALE, wall.y);
    buff.writePos(5, wall.x, z6 / ZSCALE, wall.y);
    buff.writePos(6, wall2.x, z7 / ZSCALE, wall2.y);
    buff.writePos(7, wall2.x, z8 / ZSCALE, wall2.y);
    for (let [i1, i2] of cyclicPairs(4)) buff.writeLine(i1 * 2, i1, i2);
    for (let i = 0; i < 4; i++) buff.writeLine(8 + i * 2, i, i + 4);
  }
}