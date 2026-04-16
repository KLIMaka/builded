import { BoardContext, BoardData, EngineContext, GlBlend, RorLink, SectorSurfaceType, SectorSettings, VoxelSwap } from "app/apis/engine";
import { Board, Wall } from "build/board/structs";
import { visitFromSector, VisResult } from "build/boardvisitor";
import { build2gl } from "build/utils";
import { mat4, vec3 } from "gl-matrix";
import { Source, ValuesContainer } from "ts-utils/callbacks";
import { getOrCreate, range } from "ts-utils/collections";
import { Iter, iter } from "ts-utils/iter";
import { first, Fn, pair } from "ts-utils/types";
import { BoardGlContext } from "../gl/board-context";
import { NOOP_RENDERABLE, Renderable, SectorRecord, SpriteRecord, VoxelRecord, WallRecord, WallType } from "./api";
import { BoardRenderer3D } from "./boardRenderer3d";
import { ViewPosition } from "./view";


type RorDrawData = Readonly<{
  drawData: DrawData,
  diff: vec3,
  cap: Renderable,
}>

type DrawData = Readonly<{
  sectors: Renderable,
  walls: Renderable,
  sprites: Renderable,
  transSectors: Renderable,
  transWalls: Renderable,
  transSprites: Renderable,
  blendSprites: Map<number, Renderable>,
  voxels: Renderable,
  rors: RorDrawData[],
}>;

function disposeDrawData(data: DrawData) {
  data.sectors.dispose();
  data.walls.dispose();
  data.sprites.dispose();
  data.transSprites.dispose();
  data.transWalls.dispose();
  data.transSectors.dispose();
  data.blendSprites.values().forEach(s => s.dispose());
  data.voxels.dispose();
  data.rors.forEach(d => { d.cap.dispose(); disposeDrawData(d.drawData) });
}

export function createToRender(renderer: Source<BoardRenderer3D>, boardCtx: BoardContext, boardGlCtx: BoardGlContext, engine: EngineContext, values: ValuesContainer, viewPosition: Source<ViewPosition>, fwd: Source<vec3>) {
  const all = values.transformedTuple('all', [boardCtx.data, renderer], ([data, renderer]) => createAll(renderer, data.board, boardGlCtx), { disposer: dd => disposeDrawData(dd) });
  return values.transformedTuple('toRender', [renderer, viewPosition, fwd, all, boardCtx.data, engine.spriteVoxelSwap], ([renderer, pos, forward, all, data, spriteVoxelSwap]): DrawData => {
    if (pos.sec === -1) return all;
    const visibleRes = visitFromSector(pos, forward, data);
    return getDrawData(spriteVoxelSwap, data, boardCtx, renderer, boardGlCtx, visibleRes, pos, forward, new Set());
  },
    { disposer: dd => { if (dd !== all.get()) disposeDrawData(dd) } })
}
type RorLinkData = Readonly<{
  sectorId: number,
  link: RorLink,
  type: SectorSurfaceType,
}>

type SectorData = Readonly<{
  rors: RorLinkData[];
  solid: SectorRecord[];
  trans: SectorRecord[];
}>

function checkSector(settings: SectorSettings, type: 'ceiling' | 'floor', solidRecord: SectorRecord, transRecord: SectorRecord) {
  if (settings[type] === 'normal') solidRecord[type] = 1;
  else if (settings[type] === 'trans1') transRecord[type] = 2;
  else if (settings[type] === 'trans2') transRecord[type] = 3;
}

function getSectorData(data: BoardData, result: VisResult, visited: Set<number>): SectorData {
  const { ror, sectorSettings } = data;
  const rors: RorLinkData[] = [];
  const solid: SectorRecord[] = [];
  const trans: SectorRecord[] = [];
  result.forSector(sectorId => {
    visited.add(sectorId);
    const solidRecord: SectorRecord = { sectorId, ceiling: 0, floor: 0 };
    const transRecord: SectorRecord = { sectorId, ceiling: 0, floor: 0 };
    const settings = sectorSettings(sectorId);
    checkSector(settings, 'ceiling', solidRecord, transRecord);
    checkSector(settings, 'floor', solidRecord, transRecord);
    if (solidRecord.ceiling || solidRecord.floor) solid.push(solidRecord);
    if (transRecord.ceiling || transRecord.floor) trans.push(transRecord);

    const ceilingLink = ror.rorLinks.ceilLink(sectorId);
    const floorLink = ror.rorLinks.floorLink(sectorId);
    if (ceilingLink?.transparent) rors.push({ sectorId, link: ceilingLink, type: 'ceiling' });
    if (floorLink?.transparent) rors.push({ sectorId, link: floorLink, type: 'floor' });
  });
  return { rors, solid, trans };
}

type WallData = Readonly<{
  trans: [WallRecord, number][];
  solid: WallRecord[];
}>

function getWallData(data: BoardData, result: VisResult): WallData {
  const { board } = data;
  const trans: [WallRecord, number][] = [];
  const solid: WallRecord[] = [];
  result.forWall((wallId, sectorId, dist) => {
    const wall = board.walls[wallId];
    if (wall.nextsector === -1) {
      solid.push({ wallId, sectorId, type: WallType.VOID });
    } else {
      if (wall.cstat.masking || wall.cstat.oneWay) {
        if (wall.cstat.translucent || wall.cstat.translucentReversed) {
          solid.push({ wallId, sectorId, type: WallType.NONMASKED });
          trans.push([{ wallId, sectorId, type: WallType.ONLY_MASKED }, dist]);
        } else solid.push({ wallId, sectorId, type: WallType.MASKED });
      } else solid.push({ wallId, sectorId, type: WallType.NONMASKED });
    }
  });
  return { solid, trans };
}

type SpriteData = Readonly<{
  solid: SpriteRecord[];
  trans: [SpriteRecord, number][];
  blend: Map<number, SpriteRecord[]>;
  voxel: VoxelRecord[];
}>

function getSpriteData(data: BoardData, result: VisResult, voxelSwap: VoxelSwap): SpriteData {
  const { board } = data;
  const solid: SpriteRecord[] = [];
  const trans: [SpriteRecord, number][] = [];
  const blend = new Map<number, SpriteRecord[]>();
  const voxel: VoxelRecord[] = [];
  result.forSprite((spriteId, dist) => {
    const sprite = board.sprites[spriteId];
    const voxelPicnum = sprite.picnum;
    voxelSwap(voxelPicnum).ifPresentOrElse(
      _ => voxel.push({ spriteId, voxelPicnum }),
      () => {
        if (sprite.cstat.translucent || sprite.cstat.tranclucentReversed) {
          if (sprite.blend !== 0) getOrCreate(blend, sprite.blend, _ => []).push({ spriteId });
          else trans.push([{ spriteId }, dist]);
        } else solid.push({ spriteId });
      }
    );
  });
  return { blend, solid, trans, voxel };
}

function rorMapper(voxelSwap: VoxelSwap, data: BoardData, boardCtx: BoardContext, renderer: BoardRenderer3D, boardGlCtx: BoardGlContext, result: VisResult, pos: ViewPosition, forward: vec3, visited: Set<number>): Fn<RorLinkData, RorDrawData> {
  return ({ sectorId, link: { buildDiff, dstSector }, type }) => {
    const diff = build2gl(vec3.create(), buildDiff);
    const npos = vec3.sub(vec3.create(), vec3.fromValues(pos.x, pos.y, pos.z), buildDiff);
    const ms = { sec: dstSector, x: npos[0], y: npos[1], z: npos[2] }
    const result = visitFromSector(ms, forward, data);
    const drawData = getDrawData(voxelSwap, data, boardCtx, renderer, boardGlCtx, result, ms, forward, visited);
    const ceiling = type === 'ceiling' ? 1 : 0;
    const floor = type === 'floor' ? 1 : 0;
    const cap = renderer.writeSectors([{ sectorId, ceiling, floor }], boardGlCtx);
    return { diff, drawData, cap };
  }
}

function getDrawData(voxelSwap: VoxelSwap, data: BoardData, boardCtx: BoardContext, renderer: BoardRenderer3D, boardGlCtx: BoardGlContext, result: VisResult, pos: ViewPosition, forward: vec3, visited: Set<number>): DrawData {
  const sectorData = getSectorData(data, result, visited);
  const wallData = getWallData(data, result);
  const spriteData = getSpriteData(data, result, voxelSwap);

  const sectors = renderer.writeSectors(sectorData.solid, boardGlCtx);
  const walls = renderer.writeWalls(wallData.solid, boardGlCtx);
  const sprites = renderer.writeSprites(spriteData.solid, boardGlCtx);
  const transWalls = renderer.writeWalls(wallData.trans.sort((l, r) => r[1] - l[1]).map(first), boardGlCtx);
  const transSprites = renderer.writeSprites(spriteData.trans.sort((l, r) => r[1] - l[1]).map(first), boardGlCtx);
  const transSectors = renderer.writeSectors(sectorData.trans, boardGlCtx);
  const blendSprites = iter(spriteData.blend.entries()).toMap(first, ([_, sprs]) => renderer.writeSprites(sprs, boardGlCtx));
  const voxels = renderer.writeVoxels(spriteData.voxel, boardGlCtx);
  const rors = sectorData.rors
    .filter(({ link: { dstSector } }) => !visited.has(dstSector))
    .map(rorMapper(voxelSwap, data, boardCtx, renderer, boardGlCtx, result, pos, forward, visited));

  return { sectors, sprites, walls, transSprites, transWalls, transSectors, blendSprites, voxels, rors };
}

function createAll(renderer: BoardRenderer3D, board: Board, boardGlCtx: BoardGlContext): DrawData {
  const sectors = renderer.writeSectors(Iter.range(0, board.numsectors)
    .map(sectorId => ({ sectorId, ceiling: 1, floor: 1 })), boardGlCtx);
  const walls = renderer.writeWalls(iter(range(0, board.numsectors))
    .map(s => pair(board.sectors[s], s))
    .map(([sec, sectorId]) => Iter.range(sec.wallptr, sec.wallptr + sec.wallnum)
      .map(wallId => ({ wallId, sectorId, type: wallType(board.walls[wallId]) })))
    .flatten(), boardGlCtx);
  const sprites = renderer.writeSprites(Iter.range(0, board.numsprites).map(spriteId => ({ spriteId })), boardGlCtx);
  return {
    sectors,
    walls,
    sprites,
    transSprites: NOOP_RENDERABLE,
    transWalls: NOOP_RENDERABLE,
    transSectors: NOOP_RENDERABLE,
    blendSprites: new Map(),
    voxels: NOOP_RENDERABLE,
    rors: []
  };
}

function wallType(wall: Wall): WallType {
  return wall.nextsector === -1 ? WallType.VOID : (wall.cstat.masking || wall.cstat.oneWay) ? WallType.MASKED : WallType.NONMASKED;
}

export function drawImpl(renderer: BoardRenderer3D, gl: WebGL2RenderingContext, blends: Fn<number, GlBlend>, rootView: mat4, data: DrawData, view: mat4) {
  gl.enable(WebGLRenderingContext.STENCIL_TEST);
  drawImpl1(renderer, gl, blends, rootView, data, view, 0);
  gl.disable(WebGLRenderingContext.STENCIL_TEST);
  writeAll(gl);
  renderer.view(rootView);
}

export function drawImpl1(renderer: BoardRenderer3D, gl: WebGL2RenderingContext, blends: Fn<number, GlBlend>, rootView: mat4, data: DrawData, view: mat4, idx: number) {
  writeStenciledOnly(gl, idx);
  renderer.view(view);

  data.walls.render(gl);
  data.sectors.render(gl);
  data.sprites.render(gl);
  data.voxels.render(gl);

  data.rors.forEach(({ diff, drawData, cap }, i) => {
    const nextIdx = idx + i + 1;
    renderer.view(view);
    writeStencilOnly(gl, nextIdx);
    cap.render(gl);

    const rorView = mat4.translate(mat4.create(), rootView, diff);
    drawImpl1(renderer, gl, blends, rootView, drawData, rorView, nextIdx);
  });

  writeStenciledOnly(gl, idx);
  renderer.view(view);

  gl.enable(gl.BLEND);
  gl.blendFunc(blends(0).src, blends(0).dst);
  gl.depthMask(false);

  data.transSprites.render(gl);
  data.transWalls.render(gl);
  data.transSectors.render(gl);

  data.blendSprites.forEach((renderable, blend) => {
    gl.blendFunc(blends(blend).src, blends(blend).dst);
    renderable.render(gl);
  });

  gl.blendFunc(blends(0).src, blends(0).dst);
  gl.disable(gl.BLEND);
  gl.depthMask(true);
}

function writeStencilOnly(gl: WebGL2RenderingContext, value: number) {
  gl.stencilFunc(WebGLRenderingContext.ALWAYS, value, 0xff);
  gl.stencilOp(WebGLRenderingContext.KEEP, WebGLRenderingContext.KEEP, WebGLRenderingContext.REPLACE);
  gl.stencilMask(0xff);
  gl.depthMask(false);
  gl.colorMask(false, false, false, false);
}

function writeStenciledOnly(gl: WebGL2RenderingContext, value: number) {
  gl.stencilFunc(WebGLRenderingContext.LEQUAL, value, 0xff);
  gl.stencilMask(0x0);
  gl.depthMask(true);
  gl.colorMask(true, true, true, true);
}

function writeAll(gl: WebGL2RenderingContext) {
  gl.depthMask(true);
  gl.colorMask(true, true, true, true);
}