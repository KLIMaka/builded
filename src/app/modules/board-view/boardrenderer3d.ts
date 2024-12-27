import { BoardContext, BuildRor, RorLink } from 'app/apis/engine';
import { mat4, vec2, vec3 } from 'gl-matrix';
import { Board } from '../../../build/board/structs';
import { AllBoardVisitorResult, PvsBoardVisitorResult, VisResult, createSectorCollector, createWallCollector, unpackWallId } from '../../../build/boardvisitor';
import { ZSCALE, wallVisible } from '../../../build/utils';
import { Deck, getOrCreate } from '../../../utils/collections';
import { dot2d } from '../../../utils/mathutils';
import { mirrorBasis, normal2d, reflectPoint3d } from '../../../utils/vecmath';
import { BoardProvider, BoardUtils } from '../../apis/app';
import { BuildRenderableProvider, DrawCallConsumer, Renderable, Renderables, SortingRenderable } from '../../apis/renderable';
import { BuildGl } from '../gl/buildgl';
import { RenderablesCache } from '../gl/geometry/cache';
import { SolidBuilder } from '../gl/geometry/common';
import { ViewPosition } from './view';
import { SortedList } from '@utils/list';


export type View = Readonly<{
  viewPosition: ViewPosition,
  forward: vec3,
  projection: mat4,
  transform: mat4,
  position: vec3,
}>

const visible = new PvsBoardVisitorResult();
const all = new AllBoardVisitorResult();
const rorViss = new Map<RorLink, PvsBoardVisitorResult>();
const diff = vec3.create();
const stackTransform = mat4.create();
const srcPos = vec3.create();
const dstPos = vec3.create();
const npos = vec3.create();
const mstmp = { sec: 0, x: 0, y: 0, z: 0 };
const mirrorVis = new PvsBoardVisitorResult();
const wallNormal = vec2.create();
const mirrorNormal = vec3.create();
const mirroredTransform = mat4.create();
const mpos = vec3.create();
const transOn = (bgl: BuildGl) => { bgl.gl.enable(WebGLRenderingContext.BLEND); depthOff(bgl) };
const transOff = (bgl: BuildGl) => { bgl.gl.disable(WebGLRenderingContext.BLEND); depthOn(bgl) };
const depthOff = (bgl: BuildGl) => { bgl.gl.depthMask(false) };
const depthOn = (bgl: BuildGl) => { bgl.gl.depthMask(true) };

function list() {
  const list = new Deck<Renderable>();
  const renderable = new SortingRenderable(list);
  return {
    add: (r: Renderable) => { list.push(r) },
    clear: () => list.clear(),
    drawCall: (consumer: DrawCallConsumer) => { renderable.drawCall(consumer) }
  }
}

function sortedList() {
  const list = new SortedList<Renderable>();
  const renderable = new Renderables(list);
  return {
    add: (r: Renderable, z: number) => { list.add(r, z) },
    clear: () => list.clear(),
    drawCall: (consumer: DrawCallConsumer) => { renderable.drawCall(consumer) }
  }
}

export function createRenderer3D(bgl: BuildGl, boardCtx: BoardContext, cache: RenderablesCache): Boardrenderer3D {
  const board = () => boardCtx.board;
  return new Boardrenderer3D(boardCtx.ror, bgl, board, boardCtx.utils, cache.geometry);
}

export class Boardrenderer3D {
  constructor(
    private ror: BuildRor,
    private bgl: BuildGl,
    private board: BoardProvider,
    private boardUtils: BoardUtils,
    private renderables: BuildRenderableProvider
  ) { }

  public drawTools(p: Iterable<Renderable>) {
    this.bgl.gl.disable(WebGLRenderingContext.DEPTH_TEST);
    this.bgl.gl.enable(WebGLRenderingContext.BLEND);
    this.surfaces.clear().pushAll(p);
    this.bgl.modulation(0.984, 0.78, 0.118, 1);
    this.bgl.draw(this.surfaces);
    this.bgl.flush();
    this.bgl.gl.disable(WebGLRenderingContext.BLEND);
    this.bgl.gl.enable(WebGLRenderingContext.DEPTH_TEST);
  }

  public draw(view: View) {
    this.drawGeometry(view);
  }

  private writeStencilOnly(value: number) {
    this.bgl.gl.stencilFunc(WebGLRenderingContext.ALWAYS, value, 0xff);
    this.bgl.gl.stencilOp(WebGLRenderingContext.KEEP, WebGLRenderingContext.KEEP, WebGLRenderingContext.REPLACE);
    this.bgl.gl.stencilMask(0xff);
    this.bgl.gl.depthMask(false);
    this.bgl.gl.colorMask(false, false, false, false);
  }

  private writeStenciledOnly(value: number) {
    this.bgl.gl.stencilFunc(WebGLRenderingContext.EQUAL, value, 0xff);
    this.bgl.gl.stencilMask(0x0);
    this.bgl.gl.depthMask(true);
    this.bgl.gl.colorMask(true, true, true, true);
  }

  private writeDepthOnly() {
    this.bgl.gl.colorMask(false, false, false, false);
  }

  private writeAll() {
    this.bgl.gl.depthMask(true);
    this.bgl.gl.colorMask(true, true, true, true);
  }

  private drawGeometry(view: View) {
    const board = this.board();
    const viewPos = view.viewPosition;
    const result = viewPos.sec === -1
      ? all.visit(board, viewPos)
      : visible.visit(board, this.boardUtils, viewPos, view.forward);

    this.bgl.setProjectionMatrix(view.projection);
    this.drawMirrors(result, view);
    this.drawRor(result, view);

    this.bgl.setViewMatrix(view.transform);
    this.bgl.setPosition(view.position);
    this.drawRooms(result);
  }


  private getLinkVis(link: RorLink) {
    return getOrCreate(rorViss, link, _ => new PvsBoardVisitorResult());
  }

  private drawStack(view: View, link: RorLink, surface: Renderable, stencilValue: number) {
    if (!link) return;
    this.bgl.setViewMatrix(view.transform);
    this.bgl.setPosition(view.position);
    this.writeStencilOnly(stencilValue);
    this.bgl.draw(surface);
    this.bgl.flush();

    const board = this.board();
    const src = board.sprites[link.srcSpriteId];
    const dst = board.sprites[link.dstSpriteId];
    vec3.set(srcPos, src.x, src.z / ZSCALE, src.y);
    vec3.set(dstPos, dst.x, dst.z / ZSCALE, dst.y);
    vec3.sub(diff, srcPos, dstPos);
    mat4.copy(stackTransform, view.transform);
    mat4.translate(stackTransform, stackTransform, diff);
    vec3.sub(npos, view.position, diff);

    mstmp.sec = dst.sectnum; mstmp.x = npos[0]; mstmp.y = npos[2]; mstmp.z = npos[1] * ZSCALE;
    this.bgl.setViewMatrix(stackTransform);
    this.bgl.setPosition(npos);
    this.writeStenciledOnly(stencilValue);
    this.drawRooms(this.getLinkVis(link).visit(this.board(), this.boardUtils, mstmp, view.forward));

    this.bgl.setViewMatrix(view.transform);
    this.bgl.setPosition(view.position);
    this.writeDepthOnly();
    this.bgl.draw(surface);
    this.bgl.flush();
  }

  private rorSectorCollector = createSectorCollector((board: Board, sectorId: number) => this.ror.rorLinks.hasRor(sectorId));
  private drawRor(result: VisResult, view: View) {
    result.forSector(this.board(), this.rorSectorCollector.visit());
    if (this.rorSectorCollector.sectors.length() === 0) return;

    this.bgl.gl.enable(WebGLRenderingContext.STENCIL_TEST);
    for (let i = 0; i < this.rorSectorCollector.sectors.length(); i++) {
      const s = this.rorSectorCollector.sectors.get(i);
      const r = this.renderables.sector(s);
      this.drawStack(view, this.ror.rorLinks.ceilLink(s), r.ceiling, i + 1);
      this.drawStack(view, this.ror.rorLinks.floorLink(s), r.floor, i + 1);
    }
    this.bgl.gl.disable(WebGLRenderingContext.STENCIL_TEST);
    this.writeAll();
  }

  private mirrorWallsCollector = createWallCollector((board: Board, wallId: number, sectorId: number) => this.ror.isMirrorPic(board.walls[wallId].picnum));
  private drawMirrors(result: VisResult, view: View) {
    const board = this.board();
    const viewPos = view.viewPosition;
    result.forWall(board, this.mirrorWallsCollector.visit());
    if (this.mirrorWallsCollector.walls.length() === 0) return;

    this.bgl.gl.enable(WebGLRenderingContext.STENCIL_TEST);
    for (let i = 0; i < this.mirrorWallsCollector.walls.length(); i++) {
      const w = unpackWallId(this.mirrorWallsCollector.walls.get(i));
      if (!wallVisible(board, w, viewPos)) continue;

      // draw mirror surface into stencil
      const r = this.renderables.wall(w);
      this.bgl.setViewMatrix(view.transform);
      this.bgl.setPosition(view.position);
      this.writeStencilOnly(i + 127);
      this.bgl.draw(r);
      this.bgl.flush();

      // draw reflections in stenciled area
      const w1 = board.walls[w]; const w2 = board.walls[w1.point2];
      vec2.set(wallNormal, w2.x - w1.x, w2.y - w1.y);
      normal2d(wallNormal, wallNormal);
      vec3.set(mirrorNormal, wallNormal[0], 0, wallNormal[1]);
      const mirrorrD = -dot2d(wallNormal[0], wallNormal[1], w1.x, w1.y);
      mirrorBasis(mirroredTransform, view.transform, view.position, mirrorNormal, mirrorrD);

      this.bgl.setViewMatrix(mirroredTransform);
      this.bgl.setClipPlane(mirrorNormal[0], mirrorNormal[1], mirrorNormal[2], mirrorrD);
      this.bgl.gl.cullFace(WebGLRenderingContext.FRONT);
      vec3.copy(mpos, view.position);
      reflectPoint3d(mpos, mirrorNormal, mirrorrD, mpos);
      mstmp.sec = viewPos.sec; mstmp.x = mpos[0]; mstmp.y = mpos[2]; mstmp.z = mpos[1];
      this.writeStenciledOnly(i + 127);
      this.drawRooms(mirrorVis.visit(board, this.boardUtils, mstmp, view.forward));
      this.bgl.gl.cullFace(WebGLRenderingContext.BACK);

      // seal reflections by writing depth of mirror surface
      this.bgl.setViewMatrix(view.transform);
      this.writeDepthOnly();
      this.bgl.setClipPlane(0, 0, 0, 0);
      this.bgl.draw(r);
      this.bgl.flush();
    }
    this.bgl.gl.disable(WebGLRenderingContext.STENCIL_TEST);
    this.writeAll();
  }

  private skybox = list();
  private surfaces = list();
  private sprites = list();
  private trans = sortedList();

  private clearDrawLists() {
    this.skybox.clear();
    this.surfaces.clear();
    this.sprites.clear();
    this.trans.clear();
  }

  private _sectorVisitor = (board: Board, sectorId: number) => this.sectorVisitor(board, sectorId);
  private sectorVisitor(board: Board, sectorId: number) {
    const sector = this.renderables.sector(sectorId);
    // if (this.impl.rorLinks().floorLinks[sectorId] == undefined)
    //   this.surfaces.add(sector.floor);
    // if (this.impl.rorLinks().ceilLinks[sectorId] == undefined)
    //   this.surfaces.add(sector.ceiling);
    ((sector.ceiling as SolidBuilder).parallax ? this.skybox : this.surfaces).add(sector.ceiling);
    ((sector.floor as SolidBuilder).parallax ? this.skybox : this.surfaces).add(sector.floor);
  }

  private _wallVisitor = (board: Board, wallId: number, sectorId: number) => this.wallVisitor(board, wallId, sectorId);
  private wallVisitor(board: Board, wallId: number, dist: number) {
    if (this.ror.isMirrorPic(board.walls[wallId].picnum)) return;
    const wall = board.walls[wallId];
    const wallr = this.renderables.wall(wallId);
    if ((wallr.mid as SolidBuilder).trans !== 1) this.trans.add(wallr.mid, 1 / dist);
    else this.surfaces.add(wallr.mid);
    if (wall.nextsector !== -1) {
      ((wallr.top as SolidBuilder).parallax ? this.skybox : this.surfaces).add(wallr.top);
      ((wallr.bot as SolidBuilder).parallax ? this.skybox : this.surfaces).add(wallr.bot);
    }
  }

  private _spriteVisitor = (board: Board, spriteId: number, dist: number) => this.spriteVisitor(board, spriteId, dist);
  private spriteVisitor(board: Board, spriteId: number, dist: number) {
    const spriter = this.renderables.sprite(spriteId);
    const sprite = board.sprites[spriteId];
    const trans = sprite.cstat.translucent === 1 || sprite.cstat.tranclucentReversed === 1;
    if (trans) this.trans.add(spriter, 1 / dist);
    else this.sprites.add(spriter);
  }

  private drawRooms(result: VisResult) {
    this.clearDrawLists();
    const board = this.board();
    result.forSector(board, this._sectorVisitor);
    result.forWall(board, this._wallVisitor);
    result.forSprite(board, this._spriteVisitor);

    this.drawImpl();
  }

  private drawImpl() {
    depthOff(this.bgl);
    this.bgl.draw(this.skybox);
    this.bgl.flush();
    depthOn(this.bgl);
    this.bgl.draw(this.surfaces);
    this.bgl.draw(this.sprites);
    this.bgl.flush();
    transOn(this.bgl);
    this.bgl.draw(this.trans);
    this.bgl.flush();
    transOff(this.bgl);
  }
}