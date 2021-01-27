import { build2gl } from "../../../build/utils";
import { vec3 } from "../../../libs_js/glmatrix";
import { create, getInstances, lifecycle, Module, plugin } from "../../../utils/injector";
import { error } from "../../../utils/logger";
import { detuple0, detuple1 } from "../../../utils/mathutils";
import { STATE } from "../../apis/app";
import { busDisconnector, MessageHandler, NULL_MESSAGE_HANDLER } from "../../apis/handler";
import { RenderablesCache, RENDRABLES_CACHE } from "../../modules/geometry/cache";
import { EntityFactory, ENTITY_FACTORY } from "../context";
import { MovingHandle } from "../handle";
import { Commit, EndMove, Frame, Highlight, Move, Render, StartMove } from "../messages";
import { Selected, SELECTED } from "./selection";
import { DefaultTool, TOOLS_BUS } from "./toolsbus";

export async function TransformModule(module: Module) {
  module.bind(plugin('Transform'), lifecycle(async (injector, lifecycle) => {
    const [bus, state] = await getInstances(injector, TOOLS_BUS, STATE);
    const stateCleaner = async (s: string) => state.unregister(s);
    lifecycle(state.register(MOVE_STATE, false), stateCleaner);
    lifecycle(state.register(MOVE_COPY, false), stateCleaner);
    lifecycle(state.register(MOVE_VERTICAL, false), stateCleaner);
    lifecycle(state.register(MOVE_PARALLEL, false), stateCleaner);
    const transform = await create(injector, Transform, SELECTED, ENTITY_FACTORY, RENDRABLES_CACHE);
    lifecycle(bus.connect(transform), busDisconnector(bus));
  }));
}

const handle = new MovingHandle();
const MOVE = new Move(0, 0, 0);
const START_MOVE = new StartMove();
const END_MOVE = new EndMove();

const MOVE_STATE = 'move';
export const MOVE_COPY = 'move.copy';
export const MOVE_VERTICAL = 'move.vertical';
export const MOVE_PARALLEL = 'move.parallel';

const HIGHLIGHT = new Highlight();

const target_ = vec3.create();
const start_ = vec3.create();
const dir_ = vec3.create();

export class Transform extends DefaultTool {
  private valid = true;
  private handler: MessageHandler = NULL_MESSAGE_HANDLER;

  constructor(
    private selected: Selected,
    private factory: EntityFactory,
    private renderables: RenderablesCache,
    private ctx = factory.ctx
  ) { super() }

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
      this.handler.handle(END_MOVE);
      this.handler = NULL_MESSAGE_HANDLER;
      if (MOVE.dx != 0 || MOVE.dy != 0 || MOVE.dz != 0) this.ctx.bus.handle(new Commit('Move'));
      MOVE.dx = MOVE.dy = MOVE.dz = 0;
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

  public Render(msg: Render) {
    HIGHLIGHT.set.clear();
    this.handler.handle(HIGHLIGHT);
    for (const v of HIGHLIGHT.set.keys()) {
      const type = detuple0(v);
      const id = detuple1(v);
      const rs = this.renderables.helpers;
      switch (type) {
        case 0: msg.consumer(rs.sector(id).ceiling); break;
        case 1: msg.consumer(rs.sector(id).floor); break;
        case 2: msg.consumer(rs.wall(id)); break;
        case 3: msg.consumer(rs.wallPoint(id)); break;
        case 4: msg.consumer(rs.sprite(id)); break;
      }
    }
  }
}