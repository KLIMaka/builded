import { BuildContext } from "../../api";
import { WireframeBuilder } from "../../gl/builders/renderable";
import { MessageHandlerReflective } from "../../handlerapi";
import { MovingHandle } from "../handle";
import { Frame, NamedMessage, Render } from "../messages";
import { vec3 } from "../../../../../libs_js/glmatrix";
import { build2gl } from "../../utils";
import { Deck } from "../../../../collections";

const target_ = vec3.create();
const start_ = vec3.create();
const dir_ = vec3.create();

export class DrawWall extends MessageHandlerReflective {
  private wallId = -1;
  private movingHandle = new MovingHandle();
  private wireframe = new WireframeBuilder();
  private upper = new Deck<number>();
  private lower = new Deck<number>();
  private points = new Deck<[number, number]>();

  private start(ctx: BuildContext) {
    const target = ctx.view.snapTarget();
    if (target.entity == null || !target.entity.isWall()) return;
    this.wallId = target.entity.id;
    this.movingHandle.start(build2gl(target_, target.coords));
  }

  private insertPoint(ctx: BuildContext) {
    if (this.wallId == -1) this.start(ctx);

  }

  private popPoint() {

  }

  public NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    switch (msg.name) {
      case 'draw_point': this.insertPoint(ctx); return;
      case 'undo_draw_point': this.popPoint(); return;
    }
  }

  public Frame(msg: Frame, ctx: BuildContext) {
    if (this.movingHandle.isActive()) {
      const { start, dir } = ctx.view.dir();
      this.movingHandle.update(false, false, build2gl(start_, start), build2gl(dir_, dir));
    }
  }

  public Render(msg: Render, ctx: BuildContext) {
    if (!this.movingHandle.isActive()) return;
    this.updateWireframe(ctx);
    msg.list.push(this.wireframe);
  }
}