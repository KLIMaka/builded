import { create, Module } from "../../../utils/injector";
import { DefaultTool, TOOLS_BUS } from "./toolsbus";
import { EntityFactory, ENTITY_FACTORY } from "../context";
import { error } from "../../../utils/logger";
import { MovingHandle } from "../handle";
import { Move, StartMove, EndMove, Frame, COMMIT } from "../messages";
import { Selected, SELECTED } from "./selection";
import { MessageHandler, NULL_MESSAGE_HANDLER } from "../../apis/handler";
import { build2gl } from "../../../build/utils";
import { vec3 } from "../../../libs_js/glmatrix";

export async function TransformModule(module: Module) {
  module.execute(async injector => {
    const bus = await injector.getInstance(TOOLS_BUS);
    bus.connect(await create(injector, Transform, SELECTED, ENTITY_FACTORY));
  });
}

const handle = new MovingHandle();
const MOVE = new Move(0, 0, 0);
const START_MOVE = new StartMove();
const END_MOVE = new EndMove();

const MOVE_STATE = 'move';
export const MOVE_COPY = 'move.copy';
export const MOVE_VERTICAL = 'move.vertical';
export const MOVE_PARALLEL = 'move.parallel';

const target_ = vec3.create();
const start_ = vec3.create();
const dir_ = vec3.create();

export class Transform extends DefaultTool {
  private valid = true;
  private handler: MessageHandler = NULL_MESSAGE_HANDLER;

  constructor(
    private selected: Selected,
    private factory: EntityFactory,
    private ctx = factory.ctx
  ) {
    super();

    ctx.state.register(MOVE_STATE, false);
    ctx.state.register(MOVE_COPY, false);
    ctx.state.register(MOVE_VERTICAL, false);
    ctx.state.register(MOVE_PARALLEL, false);
  }

  public Frame(msg: Frame) {
    if (this.activeMove()) {
      this.activate();
      this.updateHandle();
      try {
        this.updateMove();
      } catch (e) {
        this.valid = false;
        error(e);
      }
    }
  }

  private isStartMove() {
    return !handle.isActive() && this.ctx.state.get(MOVE_STATE);
  }

  private activeMove() {
    const start = this.isStartMove();
    if (this.valid == false && start) this.valid = true;
    const move = handle.isActive() && this.ctx.state.get(MOVE_STATE);
    const end = handle.isActive() && !this.ctx.state.get(MOVE_STATE);
    return this.valid && (start || move || end);
  }

  private updateHandle() {
    const vertical = this.ctx.state.get<boolean>(MOVE_VERTICAL);
    const parallel = this.ctx.state.get<boolean>(MOVE_PARALLEL);
    const { start, dir } = this.ctx.view.dir();
    handle.update(vertical, parallel, build2gl(start_, start), build2gl(dir_, dir));
  }

  private updateMove() {
    if (this.isStartMove()) {
      handle.start(build2gl(target_, this.ctx.view.target().coords));
      this.handler = this.selected();
      this.handler.handle(START_MOVE);
    } else if (!this.ctx.state.get(MOVE_STATE)) {
      handle.stop();
      MOVE.dx = MOVE.dy = MOVE.dz = 0;
      this.handler.handle(END_MOVE);
      this.ctx.bus.handle(COMMIT);
      this.deactivate();
      return;
    }

    const delta = this.ctx.gridController.getGridSize() / 2;
    if (Math.abs(MOVE.dx - handle.dx) >= delta || Math.abs(MOVE.dy - handle.dy) >= delta || Math.abs(MOVE.dz - handle.dz) >= delta) {
      MOVE.dx = handle.dx;
      MOVE.dy = handle.dy;
      MOVE.dz = handle.dz;
      this.handler.handle(MOVE);
    }
  }
}