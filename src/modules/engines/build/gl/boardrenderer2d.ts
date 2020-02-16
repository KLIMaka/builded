import * as GLM from '../../../../libs_js/glmatrix';
import { Deck } from '../../../collections';
import { Controller2D } from '../../../controller2d';
import * as PROFILE from '../../../profiler';
import { BuildContext } from '../api';
import { AllBoardVisitorResult, VisResult } from '../boardvisitor';
import { Board } from '../structs';
import { View2d } from '../view';
import { BuildRenderableProvider, GridBuilder, LayeredRenderable, LayeredRenderables, RenderableProvider, SolidBuilder, SortingRenderable } from './builders/renderable';
import { BuildGl } from './buildgl';

let grid: GridBuilder;
const scale = GLM.vec3.create();
const offset = GLM.vec3.create();
const gridMatrix = GLM.mat4.create();
function getGrid(controller: Controller2D) {
  if (grid != null) {
    const upp = controller.getUnitsPerPixel();
    const w = controller.getWidth();
    const h = controller.getHeight();
    const hw = w / 2;
    const hh = h / 2;
    const gridScale = context.gridScale;
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
    return grid;
  }
  const gridSolid = new SolidBuilder();
  gridSolid.trans = 0.5;
  const buff = gridSolid.buff;
  buff.allocate(4, 6);
  buff.writePos(0, -1, 1, 0);
  buff.writePos(1, 1, 1, 0);
  buff.writePos(2, 1, -1, 0);
  buff.writePos(3, -1, -1, 0);
  buff.writeTc(0, -1, 1);
  buff.writeTc(1, 1, 1);
  buff.writeTc(2, 1, -1);
  buff.writeTc(3, -1, 1);
  buff.writeQuad(0, 0, 1, 2, 3);
  grid = new GridBuilder();
  grid.gridTexMatProvider = (scale: number) => gridMatrix;
  grid.solid = gridSolid;
  return grid;
}

const idMat4 = GLM.mat4.create();
let context: BuildContext;
let BGL: BuildGl;
export function init(gl: WebGLRenderingContext, ctx: BuildContext, bgl: BuildGl) {
  context = ctx;
  BGL = bgl;
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

const visible = new AllBoardVisitorResult();
export function draw(view: View2d, campos: GLM.Vec3Array, dist: number, controller: Controller2D) {
  PROFILE.startProfile('processing');
  const result = visible.visit(context.board);
  PROFILE.endProfile();
  BGL.setProjectionMatrix(idMat4);
  BGL.setViewMatrix(idMat4);
  view.gl.disable(WebGLRenderingContext.DEPTH_TEST);
  view.gl.enable(WebGLRenderingContext.BLEND);
  BGL.draw(context, view.gl, getGrid(controller));
  BGL.flush(view.gl);
  view.gl.disable(WebGLRenderingContext.BLEND);

  BGL.setProjectionMatrix(view.getProjectionMatrix());
  BGL.setViewMatrix(view.getTransformMatrix());
  BGL.setPosition(view.getPosition());
  drawRooms(view, result);
  view.gl.enable(WebGLRenderingContext.DEPTH_TEST);
}

let renderables: BuildRenderableProvider;
const surfaces = new Deck<RenderableProvider<LayeredRenderable>>();
const pass = new SortingRenderable(new LayeredRenderables(surfaces));

function clearDrawLists() {
  surfaces.clear();
}

function sectorVisitor(board: Board, sectorId: number) {
  surfaces.push(renderables.sector(sectorId));
  PROFILE.incCount('sectors');
}

function wallVisitor(board: Board, wallId: number, sectorId: number) {
  surfaces.push(renderables.wall(wallId));
  PROFILE.incCount('walls');
}

function spriteVisitor(board: Board, spriteId: number) {
  surfaces.push(renderables.sprite(spriteId));
  PROFILE.incCount('sprites');
}

function drawRooms(view: View2d, result: VisResult) {
  PROFILE.startProfile('processing');
  renderables = view.renderables;
  clearDrawLists();
  result.forSector(context.board, sectorVisitor);
  result.forWall(context.board, wallVisitor);
  result.forSprite(context.board, spriteVisitor);
  PROFILE.endProfile();

  PROFILE.startProfile('draw');
  BGL.draw(context, view.gl, pass);
  BGL.flush(view.gl);
  PROFILE.endProfile();
}
