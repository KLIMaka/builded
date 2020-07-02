import { build2gl, slope, sectorOfWall, createSlopeCalculator } from "../../../build/utils";
import { vec3, Vec3Array } from "../../../libs_js/glmatrix";
import { Deck } from "../../../utils/collections";
import { View } from "../../apis/app";
import { MessageHandlerReflective } from "../../apis/handler";
import { BuildersFactory } from "../../modules/geometry/common";
import { MovingHandle } from "../handle";
import { Frame, NamedMessage, Render } from "../messages";
import { LayeredRenderables } from "../../apis/renderable";
import { Board } from "../../../build/board/structs";
import { nextwall } from "../../../build/boardutils";

const target_ = vec3.create();
const start_ = vec3.create();
const dir_ = vec3.create();

enum PortalType { UP, DOWN, MID };

class PortalModel {
  private wallId: number;
  private startPoint = vec3.create();
  private type: PortalType;

  constructor(
    factory: BuildersFactory,
    private contour = factory.wireframe('utils'),
    private contourPoints = factory.pointSprite('utils'),
    private length = factory.pointSprite('utils'),
    private renderable = new LayeredRenderables([contour, contourPoints, length])
  ) { }

  public getRenderable() { this.update(); return this.renderable }

  public start(board: Board, wallId: number, x: number, y: number, z: number) {
    this.wallId = wallId;
    const sectorId = sectorOfWall(board, wallId);
    const sector = board.sectors[sectorId];
    vec3.set(this.startPoint, x, y, z);
    const wall = board.walls[wallId];
    if (wall.nextsector == -1) {
      this.type = PortalType.MID;
    } else {
      const wall2 = board[wall.point2];
      const nextsectorId = wall.nextsector;
      const nextsector = board.sectors[nextsectorId];
      const curslope = createSlopeCalculator(board, sectorId);
      const nextslope = createSlopeCalculator(board, nextsectorId);
      const cz = curslope(x, y, sector.ceilingheinum) + sector.ceilingz;
      const cnz = nextslope(x, y, nextsector.ceilingheinum) + nextsector.ceilingz;
      const fz = curslope(x, y, sector.floorheinum) + sector.floorz;
      const fnz = nextslope(x, y, nextsector.floorheinum) + nextsector.floorz;
      if (z >= fnz && z <= fz) this.type = PortalType.DOWN;
      else if (z <= cnz && z >= cz) this.type = PortalType.UP;
      else throw new Error(`Invalid point`);
    }
  }

  public move(x: number, y: number, z: number) {

  }

  private update() {

  }
}

export class DrawWall extends MessageHandlerReflective {
  private wallId = -1;
  private movingHandle = new MovingHandle();
  private upper = new Deck<number>();
  private lower = new Deck<number>();
  private points = new Deck<[number, number]>();

  constructor(
    factory: BuildersFactory,
    private wireframe = factory.wireframe('utils'),
    private view: View,
  ) { super() }

  private start() {
    const target = this.view.snapTarget();
    if (target.entity == null || !target.entity.isWall()) return;
    this.wallId = target.entity.id;
    this.movingHandle.start(build2gl(target_, target.coords));
  }

  private insertPoint() {
    if (this.wallId == -1) this.start();

  }

  private popPoint() {

  }

  public NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'draw_point': this.insertPoint(); return;
      case 'undo_draw_point': this.popPoint(); return;
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
    this.wireframe.accept(msg.consumer);
  }
}