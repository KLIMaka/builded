import { build2gl } from "../../../build/utils";
import { vec3 } from "../../../libs_js/glmatrix";
import { Deck } from "../../../utils/collections";
import { View } from "../../apis/app";
import { MessageHandlerReflective } from "../../apis/handler";
import { BuildersFactory } from "../../modules/geometry/common";
import { MovingHandle } from "../handle";
import { Frame, NamedMessage, Render } from "../messages";

const target_ = vec3.create();
const start_ = vec3.create();
const dir_ = vec3.create();

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