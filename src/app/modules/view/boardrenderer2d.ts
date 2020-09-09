import { Board } from '../../../build/board/structs';
import { AllBoardVisitorResult, VisResult } from '../../../build/boardvisitor';
import { mat4, Vec3Array } from '../../../libs_js/glmatrix';
import { Controller2D } from '../../../utils/camera/controller2d';
import { Deck } from '../../../utils/collections';
import { Injector } from '../../../utils/injector';
import * as PROFILE from '../../../utils/profiler';
import { BOARD, BoardProvider } from '../../apis/app';
import { BuildRenderableProvider, HELPER_GRID, SPRITE_LABEL, Renderable, SortingRenderable } from '../../apis/renderable';
import { GRID_SECTOR_MATRIX } from '../geometry/builders/common';
import { RENDRABLES_CACHE } from '../geometry/cache';
import { BuildersFactory, BUILDERS_FACTORY, GridBuilder } from '../geometry/common';
import { BuildGl, BUILD_GL } from '../gl/buildgl';
import { View2d } from './view2d';

const visible = new AllBoardVisitorResult();

export async function Renderer2D(injector: Injector) {
  const [bgl, builders, renderables, board] = await Promise.all([
    injector.getInstance(BUILD_GL),
    injector.getInstance(BUILDERS_FACTORY),
    injector.getInstance(RENDRABLES_CACHE),
    injector.getInstance(BOARD),
  ]);
  return new BoardRenderer2D(bgl, builders, renderables.topdown, board);
}

export class BoardRenderer2D {
  private grid: GridBuilder;
  private upp = 1;
  private surfaces = new Deck<Renderable>();
  private pass = new SortingRenderable(this.surfaces, kind => {
    const spriteLabel = kind & SPRITE_LABEL && this.upp > 20;
    const gridHelper = kind & HELPER_GRID;
    return !spriteLabel && !gridHelper;
  });

  constructor(
    private bgl: BuildGl,
    private builders: BuildersFactory,
    private renderables: BuildRenderableProvider,
    private board: BoardProvider
  ) { }

  private getGrid() {
    if (this.grid != null) return this.grid;
    const gridSolid = this.builders.solid('utils');
    gridSolid.trans = 0.2;
    const buff = gridSolid.buff;
    const size = 1024 * 1024;
    buff.allocate(4, 6);
    buff.writePos(0, -size, 0, size);
    buff.writePos(1, size, 0, size);
    buff.writePos(2, size, 0, -size);
    buff.writePos(3, -size, 0, -size);
    buff.writeTcLighting(0, -1, 1);
    buff.writeTcLighting(1, 1, 1);
    buff.writeTcLighting(2, 1, -1);
    buff.writeTcLighting(3, -1, 1);
    buff.writeQuad(0, 3, 2, 1, 0);
    this.grid = this.builders.grid('');
    this.grid.range = size;
    mat4.copy(this.grid.gridTexMat, GRID_SECTOR_MATRIX);
    this.grid.solid = gridSolid;
    return this.grid;
  }

  public drawTools(p: Iterable<Renderable>) {
    this.bgl.gl.disable(WebGLRenderingContext.DEPTH_TEST);
    this.bgl.gl.enable(WebGLRenderingContext.BLEND);
    this.surfaces.clear().pushAll(p);
    this.bgl.modulation(0.984, 0.78, 0.118, 1);
    this.bgl.draw(this.pass);
    this.bgl.flush();
    this.bgl.gl.disable(WebGLRenderingContext.BLEND);
    this.bgl.gl.enable(WebGLRenderingContext.DEPTH_TEST);
  }

  public draw(view: View2d, campos: Vec3Array, dist: number, controller: Controller2D) {
    PROFILE.startProfile('processing');
    this.upp = controller.getUnitsPerPixel();
    const result = visible.visit(this.board());
    PROFILE.endProfile();

    this.bgl.setProjectionMatrix(view.getProjectionMatrix());
    this.bgl.setViewMatrix(view.getTransformMatrix());
    this.bgl.setPosition(view.getPosition());

    this.bgl.gl.disable(WebGLRenderingContext.DEPTH_TEST);
    this.bgl.gl.enable(WebGLRenderingContext.BLEND);
    this.bgl.draw(this.getGrid());
    this.bgl.flush();
    this.bgl.gl.disable(WebGLRenderingContext.BLEND);

    this.drawRooms(result);
    this.bgl.gl.enable(WebGLRenderingContext.DEPTH_TEST);
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

  private drawRooms(result: VisResult) {
    PROFILE.startProfile('processing');
    this.clearDrawLists();
    const board = this.board();
    result.forSector(board, this.sectorVisitor_);
    result.forWall(board, this.wallVisitor_);
    result.forSprite(board, this.spriteVisitor_);
    PROFILE.endProfile();

    PROFILE.startProfile('draw');
    this.bgl.draw(this.pass);
    this.bgl.flush();
    PROFILE.endProfile();
  }
}



