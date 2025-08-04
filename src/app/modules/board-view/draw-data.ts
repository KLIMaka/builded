import { BoardContext, EngineContext, GlBlend, RorLink } from "app/apis/engine";
import { visitFromSector, VisResult } from "build/boardvisitor";
import { mat4, vec3 } from "gl-matrix";
import { Source, ValuesContainer } from "ts-utils/callbacks";
import { BoardGlContext } from "../gl/board-context";
import { NOOP_RENDERABLE, Renderable, SectorRecord, SpriteRecord, VoxelRecord, WallRecord, WallType } from "./api";
import { BoardRenderer3D } from "./boardRenderer3d";
import { ViewPosition } from "./view";
import { Board, Wall } from "build/board/structs";
import { build2gl } from "build/utils";
import { getOrCreate, range } from "ts-utils/collections";
import { iter } from "ts-utils/iter";
import { first, Function, pair } from "ts-utils/types";


type RorDrawData = {
  drawData: DrawData,
  diff: vec3,
}

type DrawData = {
  sectors: Renderable,
  walls: Renderable,
  sprites: Renderable,
  transSectors: Renderable,
  transWalls: Renderable,
  transSprites: Renderable,
  blendSprites: Map<number, Renderable>,
  voxels: Renderable,
  rors: RorDrawData[],
};

function disposeDrawData(data: DrawData) {
  data.sectors.dispose();
  data.walls.dispose();
  data.sprites.dispose();
  data.transSprites.dispose();
  data.transWalls.dispose();
  data.transSectors.dispose();
  data.blendSprites.values().forEach(s => s.dispose());
  data.voxels.dispose();
  data.rors.forEach(d => disposeDrawData(d.drawData));
}

export function createToRender(renderer: Source<BoardRenderer3D>, boardCtx: BoardContext, boardGlCtx: BoardGlContext, engine: EngineContext, values: ValuesContainer, viewPosition: Source<ViewPosition>, fwd: Source<vec3>) {
  const all = values.transformedTuple('all', [boardCtx.board, renderer], ([board, renderer]) => createAll(renderer, board, boardGlCtx), { disposer: dd => disposeDrawData(dd) });
  return values.transformedTuple('toRender', [renderer, viewPosition, fwd, all, boardCtx.board], ([renderer, pos, forward, all, board]): DrawData => {
    if (pos.sec === -1) return all;
    const visibleRes = visitFromSector(pos, forward, board, boardCtx.tror, boardCtx.spritesBySector);
    return getDrawData(engine, board, boardCtx, renderer, boardGlCtx, visibleRes, pos, forward, new Set());
  },
    { disposer: dd => { if (dd !== all.get()) disposeDrawData(dd) } })
}

function getDrawData(engine: EngineContext, board: Board, boardCtx: BoardContext, renderer: BoardRenderer3D, boardGlCtx: BoardGlContext, result: VisResult, pos: ViewPosition, forward: vec3, visited: Set<number>): DrawData {
  const rorsArr: [number, RorLink][] = [];
  const sectorsArr: SectorRecord[] = [];
  const transSectorArr: SectorRecord[] = [];
  result.forSector(sectorId => {
    visited.add(sectorId);
    const sector = board.sectors[sectorId];
    const ceilingLink = boardCtx.ror.rorLinks.ceilLink(sectorId);
    if (ceilingLink?.transparent) rorsArr.push([sectorId, ceilingLink]);
    const floorLink = boardCtx.ror.rorLinks.floorLink(sectorId);
    if (floorLink?.transparent) rorsArr.push([sectorId, floorLink]);
    const transCeiling = sector.ceilingstat.type >= 2;
    const transFloor = sector.floorstat.type >= 2;
    if (transCeiling || transFloor) transSectorArr.push({ sectorId, ceiling: transCeiling, floor: transFloor });
    if (!transCeiling || !transFloor) sectorsArr.push({ sectorId, ceiling: !transCeiling, floor: !transFloor })
  });

  const transWallsArr: [WallRecord, number][] = [];
  const wallsArr: WallRecord[] = [];
  result.forWall((wallId, sectorId, dist) => {
    const wall = board.walls[wallId];
    if (wall.nextsector === -1) {
      wallsArr.push({ wallId, sectorId, type: WallType.VOID });
    } else {
      if (wall.cstat.masking || wall.cstat.oneWay) {
        if (wall.cstat.translucent || wall.cstat.translucentReversed) {
          wallsArr.push({ wallId, sectorId, type: WallType.NONMASKED });
          transWallsArr.push([{ wallId, sectorId, type: WallType.ONLY_MASKED }, dist]);
        } else wallsArr.push({ wallId, sectorId, type: WallType.MASKED });
      } else wallsArr.push({ wallId, sectorId, type: WallType.NONMASKED });
    }
  });

  const spritesArr: SpriteRecord[] = [];
  const transSpritesArr: [SpriteRecord, number][] = [];
  const blendSpritesMap = new Map<number, SpriteRecord[]>();
  const voxelsArr: VoxelRecord[] = [];
  result.forSprite((spriteId, dist) => {
    const sprite = board.sprites[spriteId];
    const voxelPicnum = sprite.picnum;
    const voxel = engine.spriteVoxelSwap.get()(voxelPicnum);
    if (voxel.isPresent()) voxelsArr.push({ spriteId, voxelPicnum });
    else {
      if (sprite.cstat.translucent || sprite.cstat.tranclucentReversed) {
        if (sprite.blend !== 0) getOrCreate(blendSpritesMap, sprite.blend, _ => []).push({ spriteId });
        else transSpritesArr.push([{ spriteId }, dist]);
      } else spritesArr.push({ spriteId });
    }
  });

  const sectors = renderer.writeSectors(sectorsArr, boardGlCtx);
  const walls = renderer.writeWalls(wallsArr, boardGlCtx);
  const sprites = renderer.writeSprites(spritesArr, boardGlCtx);
  const transWalls = renderer.writeWalls(transWallsArr.sort((l, r) => r[1] - l[1]).map(first), boardGlCtx);
  const transSprites = renderer.writeSprites(transSpritesArr.sort((l, r) => r[1] - l[1]).map(first), boardGlCtx);
  const transSectors = renderer.writeSectors(transSectorArr, boardGlCtx);
  const blendSprites = iter(blendSpritesMap.entries()).toMap(first, ([_, sprs]) => renderer.writeSprites(sprs, boardGlCtx));
  const voxels = renderer.writeVoxels(voxelsArr, boardGlCtx);
  const rors = rorsArr
    .filter(([, { dstSector }]) => !visited.has(dstSector))
    .map(([sectorId, { buildDiff, dstSector }]) => {
      const diff = build2gl(vec3.create(), buildDiff);
      const npos = vec3.sub(vec3.create(), vec3.fromValues(pos.x, pos.y, pos.z), buildDiff);
      const ms = { sec: dstSector, x: npos[0], y: npos[1], z: npos[2] }
      const result = visitFromSector(ms, forward, board, boardCtx.tror, boardCtx.spritesBySector);
      const drawData = getDrawData(engine, board, boardCtx, renderer, boardGlCtx, result, ms, forward, visited);
      return { diff, drawData };
    });

  return { sectors, sprites, walls, transSprites, transWalls, transSectors, blendSprites, voxels, rors };
}

function createAll(renderer: BoardRenderer3D, board: Board, boardGlCtx: BoardGlContext): DrawData {
  const sectors = renderer.writeSectors(iter(range(0, board.numsectors))
    .map(sectorId => ({ sectorId, ceiling: true, floor: true }))
    .collect(), boardGlCtx);
  const walls = renderer.writeWalls(iter(range(0, board.numsectors))
    .map(s => pair(board.sectors[s], s))
    .map(([sec, sectorId]) => iter(range(sec.wallptr, sec.wallptr + sec.wallnum))
      .map(wallId => ({ wallId, sectorId, type: wallType(board.walls[wallId]) }))
      .collect())
    .flatten()
    .collect(), boardGlCtx);
  const sprites = renderer.writeSprites(iter(range(0, board.numsprites)).map(spriteId => ({ spriteId })).collect(), boardGlCtx);
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

export function drawImpl(renderer: BoardRenderer3D, gl: WebGL2RenderingContext, blends: Function<number, GlBlend>, rootView: mat4, data: DrawData, view: mat4) {
  data.rors.forEach(ror => {
    const view = mat4.translate(mat4.create(), rootView, ror.diff);
    drawImpl(renderer, gl, blends, rootView, ror.drawData, view)
  });

  renderer.view(view);

  data.walls.render(gl);
  data.sectors.render(gl);
  data.sprites.render(gl);
  data.voxels.render(gl);

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
  gl.flush();
}