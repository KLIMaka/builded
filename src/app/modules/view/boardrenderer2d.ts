import { AllBoardVisitorResult, VisResult } from '../../../build/boardvisitor';
import { Board } from '../../../build/structs';
import { mat4, vec3, Vec3Array } from '../../../libs_js/glmatrix';
import { Controller2D } from '../../../utils/camera/controller2d';
import { Deck } from '../../../utils/collections';
import { Injector } from '../../../utils/injector';
import * as PROFILE from '../../../utils/profiler';
import { BOARD, BoardProvider } from '../../apis/app';
import { BuildRenderableProvider, HintRenderable, LayeredRenderables, RenderableProvider, SortingRenderable, SPRITE_LABEL, HELPER_GRID } from '../../apis/renderable';
import { GridController, GRID } from '../context';
import { RENDRABLES_CACHE } from '../geometry/cache';
import { BuildersFactory, BUILDERS_FACTORY, GridBuilder } from '../geometry/common';
import { BuildGl, BUILD_GL } from '../gl/buildgl';
import { View2d } from './view2d';

const scale = vec3.create();
const offset = vec3.create();
const gridMatrix = mat4.create();
const idMat4 = mat4.create();
const visible = new AllBoardVisitorResult();

export async function Renderer2D(injector: Injector) {
  const [bgl, builders, renderables, grid, board] = await Promise.all([
    injector.getInstance(BUILD_GL),
    injector.getInstance(BUILDERS_FACTORY),
    injector.getInstance(RENDRABLES_CACHE),
    injector.getInstance(GRID),
    injector.getInstance(BOARD),
  ]);
  return new BoardRenderer2D(bgl, builders, renderables.topdown, grid, board);
}

export class BoardRenderer2D {
  private grid: GridBuilder;
  private upp = 1;
  private surfaces = new Deck<RenderableProvider<HintRenderable>>();
  private pass = new SortingRenderable(new LayeredRenderables(this.surfaces), r => {
    const spriteLabel = r.kind & SPRITE_LABEL && this.upp > 10;
    const gridHelper = r.kind & HELPER_GRID;
    return !spriteLabel && !gridHelper;
  });

  constructor(
    private bgl: BuildGl,
    private builders: BuildersFactory,
    private renderables: BuildRenderableProvider,
    private gridController: GridController,
    private board: BoardProvider
  ) { }

  private getGrid(controller: Controller2D) {
    if (this.grid != null) {
      const upp = controller.getUnitsPerPixel();
      const w = controller.getWidth();
      const h = controller.getHeight();
      const hw = w / 2;
      const hh = h / 2;
      const gridScale = this.gridController.getGridSize();
      const xs = (hw * upp) / gridScale;
      const ys = (hh * upp) / gridScale;
      const x = controller.getPosition()[0];
      const y = controller.getPosition()[2];
      const xo = x / upp / hw;
      const yo = y / upp / hh;

      vec3.set(scale, xs, ys, 1);
      vec3.set(offset, xo, -yo, 0);
      mat4.identity(gridMatrix);
      mat4.scale(gridMatrix, gridMatrix, scale);
      mat4.translate(gridMatrix, gridMatrix, offset);
      return this.grid;
    }
    const gridSolid = this.builders.solid('utils');
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
    this.grid = new GridBuilder(this.gridController);
    this.grid.gridTexMatProvider = (scale: number) => gridMatrix;
    this.grid.solid = gridSolid;
    return this.grid;
  }

  public drawTools(gl: WebGLRenderingContext, p: RenderableProvider<HintRenderable>) {
    gl.disable(WebGLRenderingContext.DEPTH_TEST);
    gl.enable(WebGLRenderingContext.BLEND);
    this.surfaces.clear().push(p);
    this.bgl.draw(gl, this.pass);
    this.bgl.flush(gl);
    gl.disable(WebGLRenderingContext.BLEND);
    gl.enable(WebGLRenderingContext.DEPTH_TEST);
  }

  public draw(view: View2d, campos: Vec3Array, dist: number, controller: Controller2D) {
    PROFILE.startProfile('processing');
    this.upp = controller.getUnitsPerPixel();
    const result = visible.visit(this.board());
    PROFILE.endProfile();
    this.bgl.setProjectionMatrix(idMat4);
    this.bgl.setViewMatrix(idMat4);
    view.gl.disable(WebGLRenderingContext.DEPTH_TEST);
    view.gl.enable(WebGLRenderingContext.BLEND);
    this.bgl.draw(view.gl, this.getGrid(controller));
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
    const board = this.board();
    result.forSector(board, this.sectorVisitor_);
    result.forWall(board, this.wallVisitor_);
    result.forSprite(board, this.spriteVisitor_);
    PROFILE.endProfile();

    PROFILE.startProfile('draw');
    this.bgl.draw(view.gl, this.pass);
    this.bgl.flush(view.gl);
    PROFILE.endProfile();
  }
}



