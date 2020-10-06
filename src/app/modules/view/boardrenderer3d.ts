import { Board } from '../../../build/board/structs';
import { AllBoardVisitorResult, createSectorCollector, createWallCollector, PvsBoardVisitorResult, unpackWallId, VisResult } from '../../../build/boardvisitor';
import { wallVisible, ZSCALE } from '../../../build/utils';
import { mat4, vec2, vec3 } from '../../../libs_js/glmatrix';
import { Deck } from '../../../utils/collections';
import { Dependency, Injector } from '../../../utils/injector';
import { dot2d } from '../../../utils/mathutils';
import * as PROFILE from '../../../utils/profiler';
import { mirrorBasis, normal2d, reflectPoint3d } from '../../../utils/vecmath';
import { BOARD, BoardProvider } from '../../apis/app';
import { BuildRenderableProvider, DrawCallConsumer, Renderable, SortingRenderable } from '../../apis/renderable';
import { RENDRABLES_CACHE } from '../geometry/cache';
import { BuildGl, BUILD_GL } from '../gl/buildgl';
import { View3d } from './view3d';

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
  rorLinks: () => RorLinks;
  isMirrorPic(picnum: number): boolean;
}
export const Implementation_ = new Dependency<Implementation>('Implementation');


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
const polyOffsetOn = (bgl: BuildGl) => { bgl.gl.polygonOffset(0, -8) };
const polyOffsetOff = (bgl: BuildGl) => { bgl.gl.polygonOffset(0, 0) };
const blendOn = (bgl: BuildGl) => { bgl.gl.enable(WebGLRenderingContext.BLEND) };
const blendOff = (bgl: BuildGl) => { bgl.gl.disable(WebGLRenderingContext.BLEND) };

function list() {
  const list = new Deck<Renderable>();
  const renderable = new SortingRenderable(list);
  return {
    add: (r: Renderable) => { list.push(r) },
    clear: () => list.clear(),
    drawCall: (consumer: DrawCallConsumer) => { renderable.drawCall(consumer) }
  }
}

export async function Renderer3D(injector: Injector) {
  const [impl, bgl, board, renderables] = await Promise.all([
    injector.getInstance(Implementation_),
    injector.getInstance(BUILD_GL),
    injector.getInstance(BOARD),
    injector.getInstance(RENDRABLES_CACHE),
  ]);
  return new Boardrenderer3D(impl, bgl, board, renderables.geometry);
}

export class Boardrenderer3D {
  constructor(
    private impl: Implementation,
    private bgl: BuildGl,
    private board: BoardProvider,
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

  public draw(view: View3d) {
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

  private drawGeometry(view: View3d) {
    PROFILE.startProfile('processing');
    const board = this.board();
    let result = view.sec == -1
      ? all.visit(board)
      : visible.visit(board, view, view.getForward());
    PROFILE.endProfile();

    this.bgl.setProjectionMatrix(view.getProjectionMatrix());
    this.drawMirrors(result, view);
    this.drawRor(result, view);

    this.bgl.setViewMatrix(view.getTransformMatrix());
    this.bgl.setPosition(view.getPosition());
    this.drawRooms(result);
  }


  private getLinkVis(link: RorLink) {
    let vis = rorViss.get(link);
    if (vis == undefined) {
      vis = new PvsBoardVisitorResult();
      rorViss.set(link, vis);
    }
    return vis;
  }

  private drawStack(view: View3d, link: RorLink, surface: Renderable, stencilValue: number) {
    if (!link) return;
    this.bgl.setViewMatrix(view.getTransformMatrix());
    this.bgl.setPosition(view.getPosition());
    this.writeStencilOnly(stencilValue);
    this.bgl.draw(surface);
    this.bgl.flush();

    const board = this.board();
    const src = board.sprites[link.srcSpriteId];
    const dst = board.sprites[link.dstSpriteId];
    vec3.set(srcPos, src.x, src.z / ZSCALE, src.y);
    vec3.set(dstPos, dst.x, dst.z / ZSCALE, dst.y);
    vec3.sub(diff, srcPos, dstPos);
    mat4.copy(stackTransform, view.getTransformMatrix());
    mat4.translate(stackTransform, stackTransform, diff);
    vec3.sub(npos, view.getPosition(), diff);

    mstmp.sec = dst.sectnum; mstmp.x = npos[0]; mstmp.y = npos[2]; mstmp.z = npos[1] * ZSCALE;
    this.bgl.setViewMatrix(stackTransform);
    this.bgl.setPosition(npos);
    this.writeStenciledOnly(stencilValue);
    this.drawRooms(this.getLinkVis(link).visit(this.board(), mstmp, view.getForward()));

    this.bgl.setViewMatrix(view.getTransformMatrix());
    this.bgl.setPosition(view.getPosition());
    this.writeDepthOnly();
    this.bgl.draw(surface);
    this.bgl.flush();
  }

  private rorSectorCollector = createSectorCollector((board: Board, sectorId: number) => this.impl.rorLinks().hasRor(sectorId));
  private drawRor(result: VisResult, view: View3d) {
    result.forSector(this.board(), this.rorSectorCollector.visit());
    PROFILE.get(null).inc('rors', this.rorSectorCollector.sectors.length());

    this.bgl.gl.enable(WebGLRenderingContext.STENCIL_TEST);
    for (let i = 0; i < this.rorSectorCollector.sectors.length(); i++) {
      const s = this.rorSectorCollector.sectors.get(i);
      const r = this.renderables.sector(s);
      this.drawStack(view, this.impl.rorLinks().ceilLinks[s], r.ceiling, i + 1);
      this.drawStack(view, this.impl.rorLinks().floorLinks[s], r.floor, i + 1);
    }
    this.bgl.gl.disable(WebGLRenderingContext.STENCIL_TEST);
    this.writeAll();
  }

  private mirrorWallsCollector = createWallCollector((board: Board, wallId: number, sectorId: number) => this.impl.isMirrorPic(board.walls[wallId].picnum));
  private drawMirrors(result: VisResult, view: View3d) {
    const board = this.board();
    result.forWall(board, this.mirrorWallsCollector.visit());
    PROFILE.get(null).inc('mirrors', this.mirrorWallsCollector.walls.length());
    this.bgl.gl.enable(WebGLRenderingContext.STENCIL_TEST);
    for (let i = 0; i < this.mirrorWallsCollector.walls.length(); i++) {
      const w = unpackWallId(this.mirrorWallsCollector.walls.get(i));
      if (!wallVisible(board, w, view)) continue;

      // draw mirror surface into stencil
      const r = this.renderables.wall(w);
      this.bgl.setViewMatrix(view.getTransformMatrix());
      this.bgl.setPosition(view.getPosition());
      this.writeStencilOnly(i + 127);
      this.bgl.draw(r);
      this.bgl.flush();

      // draw reflections in stenciled area
      const w1 = board.walls[w]; const w2 = board.walls[w1.point2];
      vec2.set(wallNormal, w2.x - w1.x, w2.y - w1.y);
      normal2d(wallNormal, wallNormal);
      vec3.set(mirrorNormal, wallNormal[0], 0, wallNormal[1]);
      const mirrorrD = -dot2d(wallNormal[0], wallNormal[1], w1.x, w1.y);
      mirrorBasis(mirroredTransform, view.getTransformMatrix(), view.getPosition(), mirrorNormal, mirrorrD);

      this.bgl.setViewMatrix(mirroredTransform);
      this.bgl.setClipPlane(mirrorNormal[0], mirrorNormal[1], mirrorNormal[2], mirrorrD);
      this.bgl.gl.cullFace(WebGLRenderingContext.FRONT);
      vec3.copy(mpos, view.getPosition());
      reflectPoint3d(mpos, mirrorNormal, mirrorrD, mpos);
      mstmp.sec = view.sec; mstmp.x = mpos[0]; mstmp.y = mpos[2]; mstmp.z = mpos[1];
      this.writeStenciledOnly(i + 127);
      this.drawRooms(mirrorVis.visit(board, mstmp, view.getForward()));
      this.bgl.gl.cullFace(WebGLRenderingContext.BACK);

      // seal reflections by writing depth of mirror surface
      this.bgl.setViewMatrix(view.getTransformMatrix());
      this.writeDepthOnly();
      this.bgl.setClipPlane(0, 0, 0, 0);
      this.bgl.draw(r);
      this.bgl.flush();
    }
    this.bgl.gl.disable(WebGLRenderingContext.STENCIL_TEST);
    this.writeAll();
  }

  private surfaces = list();
  private surfacesTrans = list();
  private sprites = list();
  private spritesTrans = list();

  private clearDrawLists() {
    this.surfaces.clear();
    this.surfacesTrans.clear();
    this.sprites.clear();
    this.spritesTrans.clear();
  }

  private _sectorVisitor = (board: Board, sectorId: number) => this.sectorVisitor(board, sectorId);
  private sectorVisitor(board: Board, sectorId: number) {
    const sector = this.renderables.sector(sectorId);
    if (this.impl.rorLinks().floorLinks[sectorId] == undefined)
      this.surfaces.add(sector.floor);
    if (this.impl.rorLinks().ceilLinks[sectorId] == undefined)
      this.surfaces.add(sector.ceiling);
    PROFILE.incCount('sectors');
  }

  private _wallVisitor = (board: Board, wallId: number, sectorId: number) => this.wallVisitor(board, wallId, sectorId);
  private wallVisitor(board: Board, wallId: number, sectorId: number) {
    if (this.impl.isMirrorPic(board.walls[wallId].picnum)) return;
    const wall = board.walls[wallId];
    const wallr = this.renderables.wall(wallId);
    if (wall.cstat.translucent == 1 || wall.cstat.translucentReversed == 1) {
      this.surfacesTrans.add(wallr.mid);
      this.surfaces.add(wallr.bot);
      this.surfaces.add(wallr.top);
    } else if (wall.nextwall == -1) {
      this.surfaces.add(wallr.mid);
    } else {
      this.surfaces.add(wallr);
    }
    PROFILE.incCount('walls');
  }

  private _spriteVisitor = (board: Board, spriteId: number) => this.spriteVisitor(board, spriteId);
  private spriteVisitor(board: Board, spriteId: number) {
    const spriter = this.renderables.sprite(spriteId);
    const sprite = board.sprites[spriteId];
    const trans = sprite.cstat.translucent == 1 || sprite.cstat.tranclucentReversed == 1;
    (trans ? this.spritesTrans : this.sprites).add(spriter);
    PROFILE.incCount('sprites');
  }

  private drawRooms(result: VisResult) {
    PROFILE.startProfile('processing');
    this.clearDrawLists();
    const board = this.board();
    result.forSector(board, this._sectorVisitor);
    result.forWall(board, this._wallVisitor);
    result.forSprite(board, this._spriteVisitor);
    PROFILE.endProfile();

    PROFILE.startProfile('draw');
    this.drawImpl();
    PROFILE.endProfile();
  }

  private drawImpl() {
    this.bgl.draw(this.surfaces);
    this.bgl.flush();
    polyOffsetOn(this.bgl);
    this.bgl.draw(this.sprites);
    this.bgl.flush();
    polyOffsetOff(this.bgl);
    blendOn(this.bgl);
    this.bgl.draw(this.surfacesTrans);
    this.bgl.flush();
    polyOffsetOn(this.bgl);
    this.bgl.draw(this.spritesTrans);
    this.bgl.flush();
    polyOffsetOff(this.bgl);
    blendOff(this.bgl);
  }
}