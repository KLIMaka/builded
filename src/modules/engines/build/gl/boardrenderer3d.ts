import { dot2d } from '../../../../libs/mathutils';
import { mirrorBasis, normal2d, reflectPoint3d } from '../../../../libs/vecmath';
import * as GLM from '../../../../libs_js/glmatrix';
import { Deck, fastIterator } from '../../../collections';
import * as PROFILE from '../../../profiler';
import { BuildContext } from '../api';
import { unpackWallId } from '../boardutils';
import { AllBoardVisitorResult, createSectorCollector, createWallCollector, PvsBoardVisitorResult, VisResult } from '../boardvisitor';
import { Board } from '../structs';
import { wallVisible, ZSCALE } from '../utils';
import { View3d } from '../view';
import { BuildRenderableProvider, Renderable, WrapRenderable, Renderables, RenderableProvider, LayeredRenderable, RenderableConsumer } from './builders/renderable';
import { State } from '../../../stategl';
import { Dependency } from '../../../../libs/injector';
import { BuildGl } from './buildgl';

export class RorLink {
  constructor(readonly srcSpriteId: number, readonly dstSpriteId: number) { }
}

export class RorLinks {
  public ceilLinks: { [index: number]: RorLink } = {};
  public floorLinks: { [index: number]: RorLink } = {};

  public hasRor(sectorId: number) {
    return this.ceilLinks[sectorId] != undefined || this.floorLinks[sectorId] != undefined;
  }
}

export interface Implementation {
  rorLinks(): RorLinks;
  isMirrorPic(picnum: number): boolean;
}
export const Implementation_ = new Dependency<Implementation>('Implementation');


let implementation: Implementation;
let context: BuildContext;
let BGL: BuildGl;

export function init(gl: WebGLRenderingContext, ctx: BuildContext, impl: Implementation, bgl: BuildGl) {
  context = ctx;
  implementation = impl;
  BGL = bgl;
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

export function draw(view: View3d) {
  drawGeometry(view);
}

function writeStencilOnly(gl: WebGLRenderingContext, value: number) {
  gl.stencilFunc(WebGLRenderingContext.ALWAYS, value, 0xff);
  gl.stencilOp(WebGLRenderingContext.KEEP, WebGLRenderingContext.KEEP, WebGLRenderingContext.REPLACE);
  gl.stencilMask(0xff);
  gl.depthMask(false);
  gl.colorMask(false, false, false, false);
}

function writeStenciledOnly(gl: WebGLRenderingContext, value: number) {
  gl.stencilFunc(WebGLRenderingContext.EQUAL, value, 0xff);
  gl.stencilMask(0x0);
  gl.depthMask(true);
  gl.colorMask(true, true, true, true);
}

function writeDepthOnly(gl: WebGLRenderingContext, ) {
  gl.colorMask(false, false, false, false);
}

function writeAll(gl: WebGLRenderingContext, ) {
  gl.depthMask(true);
  gl.colorMask(true, true, true, true);
}

const visible = new PvsBoardVisitorResult();
const all = new AllBoardVisitorResult();
function drawGeometry(view: View3d) {
  PROFILE.startProfile('processing');
  let result = view.sec == -1
    ? all.visit(context.board)
    : visible.visit(context.board, view, view.getForward());
  PROFILE.endProfile();

  BGL.setProjectionMatrix(view.getProjectionMatrix());
  drawMirrors(result, view);
  drawRor(result, view);

  BGL.setViewMatrix(view.getTransformMatrix());
  BGL.setPosition(view.getPosition());
  drawRooms(view, result);
}

const rorViss = new Map<RorLink, PvsBoardVisitorResult>();
function getLinkVis(link: RorLink) {
  let vis = rorViss.get(link);
  if (vis == undefined) {
    vis = new PvsBoardVisitorResult();
    rorViss.set(link, vis);
  }
  return vis;
}

const diff = GLM.vec3.create();
const stackTransform = GLM.mat4.create();
const srcPos = GLM.vec3.create();
const dstPos = GLM.vec3.create();
const npos = GLM.vec3.create();
const mstmp = { sec: 0, x: 0, y: 0, z: 0 };

function drawStack(view: View3d, link: RorLink, surface: Renderable, stencilValue: number) {
  if (!link) return;
  BGL.setViewMatrix(view.getTransformMatrix());
  BGL.setPosition(view.getPosition());
  writeStencilOnly(view.gl, stencilValue);
  BGL.draw(context, view.gl, surface);
  BGL.flush(view.gl);

  const src = context.board.sprites[link.srcSpriteId];
  const dst = context.board.sprites[link.dstSpriteId];
  GLM.vec3.set(srcPos, src.x, src.z / ZSCALE, src.y);
  GLM.vec3.set(dstPos, dst.x, dst.z / ZSCALE, dst.y);
  GLM.vec3.sub(diff, srcPos, dstPos);
  GLM.mat4.copy(stackTransform, view.getTransformMatrix());
  GLM.mat4.translate(stackTransform, stackTransform, diff);
  GLM.vec3.sub(npos, view.getPosition(), diff);

  mstmp.sec = dst.sectnum; mstmp.x = npos[0]; mstmp.y = npos[2]; mstmp.z = npos[1] * ZSCALE;
  BGL.setViewMatrix(stackTransform);
  BGL.setPosition(npos);
  writeStenciledOnly(view.gl, stencilValue);
  drawRooms(view, getLinkVis(link).visit(context.board, mstmp, view.getForward()));

  BGL.setViewMatrix(view.getTransformMatrix());
  BGL.setPosition(view.getPosition());
  writeDepthOnly(view.gl);
  BGL.draw(context, view.gl, surface);
  BGL.flush(view.gl);
}

const rorSectorCollector = createSectorCollector((board: Board, sectorId: number) => implementation.rorLinks().hasRor(sectorId));
function drawRor(result: VisResult, view: View3d) {
  result.forSector(context.board, rorSectorCollector.visit());
  PROFILE.get(null).inc('rors', rorSectorCollector.sectors.length());

  view.gl.enable(WebGLRenderingContext.STENCIL_TEST);
  for (let i = 0; i < rorSectorCollector.sectors.length(); i++) {
    const s = rorSectorCollector.sectors.get(i);
    const r = view.renderables.sector(s);
    drawStack(view, implementation.rorLinks().ceilLinks[s], r.ceiling, i + 1);
    drawStack(view, implementation.rorLinks().floorLinks[s], r.floor, i + 1);
  }
  view.gl.disable(WebGLRenderingContext.STENCIL_TEST);
  writeAll(view.gl);
}

const mirrorWallsCollector = createWallCollector((board: Board, wallId: number, sectorId: number) => implementation.isMirrorPic(board.walls[wallId].picnum));
const mirrorVis = new PvsBoardVisitorResult();
const wallNormal = GLM.vec2.create();
const mirrorNormal = GLM.vec3.create();
const mirroredTransform = GLM.mat4.create();
const mpos = GLM.vec3.create();
function drawMirrors(result: VisResult, view: View3d) {
  result.forWall(context.board, mirrorWallsCollector.visit());
  PROFILE.get(null).inc('mirrors', mirrorWallsCollector.walls.length());
  view.gl.enable(WebGLRenderingContext.STENCIL_TEST);
  for (let i = 0; i < mirrorWallsCollector.walls.length(); i++) {
    const w = unpackWallId(mirrorWallsCollector.walls.get(i));
    if (!wallVisible(context.board, w, view))
      continue;

    // draw mirror surface into stencil
    const r = view.renderables.wall(w);
    BGL.setViewMatrix(view.getTransformMatrix());
    BGL.setPosition(view.getPosition());
    writeStencilOnly(view.gl, i + 127);
    BGL.draw(context, view.gl, r);
    BGL.flush(view.gl);

    // draw reflections in stenciled area
    const w1 = context.board.walls[w]; const w2 = context.board.walls[w1.point2];
    GLM.vec2.set(wallNormal, w2.x - w1.x, w2.y - w1.y);
    normal2d(wallNormal, wallNormal);
    GLM.vec3.set(mirrorNormal, wallNormal[0], 0, wallNormal[1]);
    const mirrorrD = -dot2d(wallNormal[0], wallNormal[1], w1.x, w1.y);
    mirrorBasis(mirroredTransform, view.getTransformMatrix(), view.getPosition(), mirrorNormal, mirrorrD);

    BGL.setViewMatrix(mirroredTransform);
    BGL.setClipPlane(mirrorNormal[0], mirrorNormal[1], mirrorNormal[2], mirrorrD);
    view.gl.cullFace(WebGLRenderingContext.FRONT);
    GLM.vec3.copy(mpos, view.getPosition());
    reflectPoint3d(mpos, mirrorNormal, mirrorrD, mpos);
    mstmp.sec = view.sec; mstmp.x = mpos[0]; mstmp.y = mpos[2]; mstmp.z = mpos[1];
    writeStenciledOnly(view.gl, i + 127);
    drawRooms(view, mirrorVis.visit(context.board, mstmp, view.getForward()));
    view.gl.cullFace(WebGLRenderingContext.BACK);

    // seal reflections by writing depth of mirror surface
    BGL.setViewMatrix(view.getTransformMatrix());
    writeDepthOnly(view.gl);
    BGL.setClipPlane(0, 0, 0, 0);
    BGL.draw(context, view.gl, r);
    BGL.flush(view.gl);
  }
  view.gl.disable(WebGLRenderingContext.STENCIL_TEST);
  writeAll(view.gl);
}

let renderables: BuildRenderableProvider;

function list() {
  const list = new Deck<Renderable>();
  const renderable = new Renderables(list);
  return {
    consumer: (r: LayeredRenderable) => { list.push(r) },
    clear: () => list.clear(),
    draw: (ctx: BuildContext, gl: WebGLRenderingContext, state: State) => { renderable.draw(ctx, gl, state) }
  }
}

const surfaces = list();
const surfacesTrans = list();
const sprites = list();
const spritesTrans = list();

function clearDrawLists() {
  surfaces.clear();
  surfacesTrans.clear();
  sprites.clear();
  spritesTrans.clear();
}

function sectorVisitor(board: Board, sectorId: number) {
  let sector = renderables.sector(sectorId);
  if (implementation.rorLinks().floorLinks[sectorId] == undefined)
    sector.floor.accept(surfaces.consumer);
  if (implementation.rorLinks().ceilLinks[sectorId] == undefined)
    sector.ceiling.accept(surfaces.consumer);
  PROFILE.incCount('sectors');
}

function wallVisitor(board: Board, wallId: number, sectorId: number) {
  if (implementation.isMirrorPic(board.walls[wallId].picnum)) return;
  let wall = board.walls[wallId];
  let wallr = renderables.wall(wallId);
  if (wall.cstat.translucent || wall.cstat.translucentReversed) {
    wallr.mid.accept(surfacesTrans.consumer);
    wallr.bot.accept(surfaces.consumer);
    wallr.top.accept(surfaces.consumer);
  } else {
    wallr.accept(surfaces.consumer);
  }
  PROFILE.incCount('walls');
}

function spriteVisitor(board: Board, spriteId: number) {
  let spriter = renderables.sprite(spriteId);
  let sprite = board.sprites[spriteId];
  let trans = sprite.cstat.tranclucentReversed == 1 || sprite.cstat.translucent == 1;
  spriter.accept((trans ? spritesTrans : sprites).consumer);
  PROFILE.incCount('sprites');
}

const polyOffsetOn = (ctx: BuildContext, gl: WebGLRenderingContext, state: State) => { (<View3d>ctx.view).gl.polygonOffset(-1, -8) };
const polyOffsetOff = (ctx: BuildContext, gl: WebGLRenderingContext, state: State) => { (<View3d>ctx.view).gl.polygonOffset(0, 0) };
const blendOn = (ctx: BuildContext, gl: WebGLRenderingContext, state: State) => { (<View3d>ctx.view).gl.enable(WebGLRenderingContext.BLEND) };
const blendOff = (ctx: BuildContext, gl: WebGLRenderingContext, state: State) => { (<View3d>ctx.view).gl.disable(WebGLRenderingContext.BLEND) };

const spriteSolids = new WrapRenderable(sprites, polyOffsetOn, polyOffsetOff);
const spriteTransparent = new WrapRenderable(spritesTrans, polyOffsetOn, polyOffsetOff);
const transparent = new WrapRenderable(new Renderables(fastIterator([surfacesTrans, spriteTransparent])), blendOn, blendOff);
const pass = new Renderables(fastIterator([surfaces, spriteSolids, transparent]));

function drawRooms(view: View3d, result: VisResult) {
  PROFILE.startProfile('processing');
  renderables = view.renderables;
  clearDrawLists();
  result.forSector(context.board, sectorVisitor);
  result.forWall(context.board, wallVisitor);
  result.forSprite(context.board, spriteVisitor);
  PROFILE.endProfile();

  PROFILE.startProfile('draw');
  BGL.draw(context, view.gl, pass);
  PROFILE.endProfile();
}