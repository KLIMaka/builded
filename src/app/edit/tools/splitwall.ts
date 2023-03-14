import { closestWallPointDist } from "../../../build/board/distances";
import { EngineApi } from "../../../build/board/mutations/api";
import { createNewSector } from "../../../build/board/mutations/ceatesector";
import { createInnerLoop } from "../../../build/board/mutations/sectors";
import { splitSector } from "../../../build/board/mutations/splitsector";
import { findContainingSectorMidPoints, sectorOfWall, wallInSector } from "../../../build/board/query";
import { Board } from "../../../build/board/structs";
import { Target } from "../../../build/hitscan";
import { ZSCALE } from "../../../build/utils";
import { vec3 } from "gl-matrix";
import { Deck, wrap } from "../../../utils/collections";
import { create, lifecycle, Module, plugin } from "../../../utils/injector";
import { int, len2d } from "../../../utils/mathutils";
import { ART, ArtProvider, BOARD, BoardProvider, BuildReferenceTracker, ENGINE_API, REFERENCE_TRACKER, View, VIEW } from "../../apis/app";
import { BUS, busDisconnector, MessageBus } from "../../apis/handler";
import { NULL_RENDERABLE, Renderable, Renderables } from "../../apis/renderable";
import { writeText } from "../../modules/geometry/builders/common";
import { RenderablesCache, RENDRABLES_CACHE } from "../../modules/geometry/cache";
import { BuildersFactory, BUILDERS_FACTORY } from "../../modules/geometry/common";
import { LineBuilder, PointSpritesBuilder } from "../../modules/gl/buffers";
import { getClosestSectorZ } from "../editutils";
import { BoardInvalidate, Commit, Frame, NamedMessage, Render } from "../messages";
import { DefaultTool, TOOLS_BUS } from "./toolsbus";


export class SplitWall extends DefaultTool {

  constructor(
    factory: BuildersFactory,
    private api: EngineApi,
    private view: View,
    private board: BoardProvider,
    private refs: BuildReferenceTracker,
    private bus: MessageBus,
  ) {
    super();
  }

  private update() {
    if (!this.isActive()) return;


  }

  private start() {
    const target = this.view.target();
    if (target.entity == null || !target.entity.isWall()) return;
    this.activate();


  }

  public NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'split_wall_line': this.start(); return;
    }
  }

  public Frame(msg: Frame) { this.update() }
}