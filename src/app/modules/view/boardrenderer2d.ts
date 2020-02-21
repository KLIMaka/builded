import { AllBoardVisitorResult, VisResult } from '../../../build/boardvisitor';
import { Board } from '../../../build/structs';
import * as GLM from '../../../libs_js/glmatrix';
import { Controller2D } from '../../../utils/camera/controller2d';
import { Deck } from '../../../utils/collections';
import * as PROFILE from '../../../utils/profiler';
import { BuildContext } from '../../apis/app';
import { BuildGl } from '../gl/buildgl';
import { View2d } from './view';
import { GridBuilder, BuildersFactory } from '../geometry/common';
import { RenderableProvider, HintRenderable, SortingRenderable, LayeredRenderables, BuildRenderableProvider } from '../../apis/renderable';

const scale = GLM.vec3.create();
const offset = GLM.vec3.create();
const gridMatrix = GLM.mat4.create();
const idMat4 = GLM.mat4.create();
const visible = new AllBoardVisitorResult();

export class BoardRenderer2D {
  private grid: GridBuilder;
  private surfaces = new Deck<RenderableProvider<HintRenderable>>();
  private pass = new SortingRenderable(new LayeredRenderables(this.surfaces));

  constructor(
    private bgl: BuildGl,
    private builders: BuildersFactory,
    private ctx: BuildContext,
    private renderables: BuildRenderableProvider
  ) { }

  private getGrid(controller: Controller2D) {
    if (this.grid != null) {
      const upp = controller.getUnitsPerPixel();
      const w = controller.getWidth();
      const h = controller.getHeight();
      const hw = w / 2;
      const hh = h / 2;
      const gridScale = this.ctx.gridScale;
      const xs = (hw * upp) / gridScale;
      const ys = (hh * upp) / gridScale;
      const x = controller.getPosition()[0];
      const y = controller.getPosition()[2];
      const xo = x / upp / hw;
      const yo = y / upp / hh;

      GLM.vec3.set(scale, xs, ys, 1);
      GLM.vec3.set(offset, xo, -yo, 0);
      GLM.mat4.identity(gridMatrix);
      GLM.mat4.scale(gridMatrix, gridMatrix, scale);
      GLM.mat4.translate(gridMatrix, gridMatrix, offset);
      return this.grid;
    }
    const gridSolid = this.builders.solid();
    gridSolid.trans = 0.5;
    const buff = gridSolid.buff;
    buff.allocate(4, 6);
    buff.writePos(0, -1, 1, 0);
    buff.writePos(1, 1, 1, 0);
    buff.writePos(2, 1, -1, 0);
    buff.writePos(3, -1, -1, 0);
    buff.writeTcLighting(0, -1, 1);
    buff.writeTcLighting(1, 1, 1);
    buff.writeTcLighting(2, 1, -1);
    buff.writeTcLighting(3, -1, 1);
    buff.writeQuad(0, 0, 1, 2, 3);
    this.grid = new GridBuilder();
    this.grid.gridTexMatProvider = (scale: number) => gridMatrix;
    this.grid.solid = gridSolid;
    return this.grid;
  }

  public draw(view: View2d, campos: GLM.Vec3Array, dist: number, controller: Controller2D) {
    PROFILE.startProfile('processing');
    const result = visible.visit(this.ctx.board);
    PROFILE.endProfile();
    this.bgl.setProjectionMatrix(idMat4);
    this.bgl.setViewMatrix(idMat4);
    view.gl.disable(WebGLRenderingContext.DEPTH_TEST);
    view.gl.enable(WebGLRenderingContext.BLEND);
    this.bgl.draw(this.ctx, view.gl, this.getGrid(controller));
    this.bgl.flush(view.gl);
    view.gl.disable(WebGLRenderingContext.BLEND);

    this.bgl.setProjectionMatrix(view.getProjectionMatrix());
    this.bgl.setViewMatrix(view.getTransformMatrix());
    this.bgl.setPosition(view.getPosition());
    this.drawRooms(view, result);
    view.gl.enable(WebGLRenderingContext.DEPTH_TEST);
  }

  private clearDrawLists() {
    this.surfaces.clear();
  }

  private sectorVisitor_ = (board: Board, sectorId: number) => this.sectorVisitor(board, sectorId);
  private sectorVisitor(board: Board, sectorId: number) {
    this.surfaces.push(this.renderables.sector(sectorId));
    PROFILE.incCount('sectors');
  }

  private wallVisitor_ = (board: Board, wallId: number, sectorId: number) => this.wallVisitor(board, wallId, sectorId);
  private wallVisitor(board: Board, wallId: number, sectorId: number) {
    this.surfaces.push(this.renderables.wall(wallId));
    PROFILE.incCount('walls');
  }

  private spriteVisitor_ = (board: Board, spriteId: number) => this.spriteVisitor(board, spriteId);
  private spriteVisitor(board: Board, spriteId: number) {
    this.surfaces.push(this.renderables.sprite(spriteId));
    PROFILE.incCount('sprites');
  }

  private drawRooms(view: View2d, result: VisResult) {
    PROFILE.startProfile('processing');
    this.clearDrawLists();
    result.forSector(this.ctx.board, this.sectorVisitor_);
    result.forWall(this.ctx.board, this.wallVisitor_);
    result.forSprite(this.ctx.board, this.spriteVisitor_);
    PROFILE.endProfile();

    PROFILE.startProfile('draw');
    this.bgl.draw(this.ctx, view.gl, this.pass);
    this.bgl.flush(view.gl);
    PROFILE.endProfile();
  }
}



