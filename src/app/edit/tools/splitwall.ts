import { vec2, vec3 } from "gl-matrix";
import { loopStart, sectorWalls } from "../../../build/board/loops";
import { EngineApi } from "../../../build/board/mutations/api";
import { sectorOfWall, wallInSector } from "../../../build/board/query";
import { createSlopeCalculator, rayIntersect, wallNormal, ZSCALE } from "../../../build/utils";
import { takeFirst } from "../../../utils/collections";
import { create, lifecycle, Module, plugin } from "../../../utils/injector";
import { cross2d, dot2d, int, len2d } from "utils/mathutils";
import { BOARD, BoardProvider, BuildReferenceTracker, ENGINE_API, REFERENCE_TRACKER, SnapType, View, VIEW } from "../../apis/app";
import { busDisconnector } from "../../apis/handler";
import { BuildersFactory, BUILDERS_FACTORY } from "../../modules/geometry/common";
import { LineBuilder } from "../../modules/gl/buffers";
import { NamedMessage, Render } from "../messages";
import { DefaultTool, TOOLS_BUS } from "./toolsbus";


export async function SplitWallModule(module: Module) {
  module.bind(plugin('SplitWall'), lifecycle(async (injector, lifecycle) => {
    const bus = await injector.getInstance(TOOLS_BUS);
    const pushWall = await create(injector, SplitWall, BUILDERS_FACTORY, ENGINE_API, VIEW, BOARD, REFERENCE_TRACKER);
    lifecycle(bus.connect(pushWall), busDisconnector(bus));
  }));
}

export class SplitWall extends DefaultTool {
  private wallId = -1;
  private pos = vec2.create();

  constructor(
    factory: BuildersFactory,
    private api: EngineApi,
    private view: View,
    private board: BoardProvider,
    private refs: BuildReferenceTracker,
    private wireframe = factory.wireframe('utils')
  ) {
    super();
  }

  private update(): boolean {
    const board = this.board();
    const target = this.view.snapTarget(SnapType.WALL);
    if (target.entity == null || !target.entity.isWall()) return false;

    const wallId = target.entity.id;
    const [sx, sy,] = target.coords;
    const [nx, , ny] = wallNormal(vec3.create(), board, wallId);
    const sectorId = sectorOfWall(board, wallId);
    const inters: { x: number, y: number, t: number, w: number }[] = [];
    for (const w of sectorWalls(board, sectorId)) {
      if (w == wallId) continue;
      const wall = board.walls[w];
      const wall2 = board.walls[wall.point2];
      const dx = wall.x - sx;
      const dy = wall.y - sy;
      const t = len2d(dx, dy);
      if (t > 0 && cross2d(nx, ny, dx, dy) == 0 && dot2d(nx, ny, dx, dy) > 0) {
        inters.push({ x: wall.x, y: wall.y, w, t });
      } else {
        const inter = rayIntersect(sx, sy, 0, nx, ny, 0, wall.x, wall.y, wall2.x, wall2.y);
        if (inter != null) {
          const [x, y, , t] = inter;
          if (t > 0) inters.push({ x: int(x), y: int(y), t, w });
        }
      }
    }

    inters.sort((l, r) => l.t - r.t);
    const closest = takeFirst(inters);
    if (closest == null) return false;
    if (loopStart(board, closest.w) != loopStart(board, wallId)) return false;
    const [ex, ey] = [closest.x, closest.y];
    const startWall = wallInSector(board, sectorId, sx, sy);
    const endWall = wallInSector(board, sectorId, ex, ey);
    if (startWall != -1 && endWall != -1 && (board.walls[startWall].point2 == endWall || board.walls[endWall].point2 == startWall)) return false;

    const slope = createSlopeCalculator(board, sectorId);
    const sector = board.sectors[sectorId];
    const z1 = (slope(sx, sy, sector.floorheinum) + sector.floorz) / ZSCALE;
    const z2 = (slope(ex, ey, sector.floorheinum) + sector.floorz) / ZSCALE;
    const z3 = (slope(ex, ey, sector.ceilingheinum) + sector.ceilingz) / ZSCALE;
    const z4 = (slope(sx, sy, sector.ceilingheinum) + sector.ceilingz) / ZSCALE;

    const line = new LineBuilder();
    this.wireframe.needToRebuild();
    line.segment(sx, z1, sy, ex, z2, ey);
    line.segment(ex, z2, ey, ex, z3, ey);
    line.segment(ex, z3, ey, sx, z4, sy);
    line.segment(sx, z4, sy, sx, z1, sy);
    line.build(this.wireframe.buff);

    return true;
  }

  private start() {
    if (this.isActive()) this.deactivate()
    else this.activate();
  }

  public NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'split_wall_line': this.start(); return;
    }
  }


  public Render(msg: Render) {
    if (!this.isActive()) return;
    if (this.update()) msg.consumer(this.wireframe);
  }
}