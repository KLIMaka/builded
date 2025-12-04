import { Aliases, ArtInfoExtended, BoardData, EngineSettings } from "app/apis/engine";
import { sectorWalls } from "build/board/loops";
import { sectorOfWall } from "build/board/query";
import { Board, FACE_SPRITE, FLOOR_SPRITE, Wall, WALL_SPRITE } from "build/board/structs";
import { EMPTY_ENTITY, Entity, EntityType } from "build/hitscan";
import { SpriteDescriptor } from "build/sprites";
import { createSlopeCalculator, slope, wallNormal, ZSCALE } from "build/utils";
import { vec2, vec3 } from "gl-matrix";
import { match } from "ts-pattern";
import { Iter } from "ts-utils/iter";
import { memoize } from "ts-utils/mathutils";
import { BoardGlContext } from "../gl/board-context";
import { LineRecord, NOOP_RENDERABLE, printText, Renderable, renderables, ScreenSpriteRecord, WallType } from "./api";
import { BoardRenderer3D } from "./boardRenderer3d";
import { notUndefined } from "ts-utils/types";

const POINT_OFF = vec2.fromValues(-2.5, 2.5);
const POINT_SIZE = vec2.fromValues(5, 5);
const FONT_SIZE = vec2.fromValues(8, 8);

function wallTypeSelect(wall: Wall, type: EntityType): WallType {
  return wall.nextsector === -1 ? WallType.VOID : type === EntityType.MID_WALL ? WallType.ONLY_MASKED : type === EntityType.LOWER_WALL ? WallType.ONLY_LOWER : WallType.ONLY_UPPER;
}

function getZs(board: Board, sectorId: number, nextsectorId: number, wall: Wall, wall2: Wall, type: EntityType) {
  if (type === EntityType.UPPER_WALL || type === EntityType.LOWER_WALL) {
    const ceiling = type === EntityType.UPPER_WALL;
    const slope = createSlopeCalculator(board, sectorId, ceiling);
    const nextSlope = createSlopeCalculator(board, nextsectorId, ceiling);
    return [
      slope(wall.x, wall.y),
      nextSlope(wall.x, wall.y),
      slope(wall2.x, wall2.y),
      nextSlope(wall2.x, wall2.y)];
  } else if (type === EntityType.MID_WALL && nextsectorId !== -1) {
    const nz1c = slope(board, nextsectorId, wall.x, wall.y, true);
    const nz1f = slope(board, nextsectorId, wall.x, wall.y, false);
    const nz2c = slope(board, nextsectorId, wall2.x, wall2.y, true);
    const nz2f = slope(board, nextsectorId, wall2.x, wall2.y, false);
    const sz1c = slope(board, sectorId, wall.x, wall.y, true);
    const sz1f = slope(board, sectorId, wall.x, wall.y, false);
    const sz2c = slope(board, sectorId, wall2.x, wall2.y, true);
    const sz2f = slope(board, sectorId, wall2.x, wall2.y, false);
    const [z1c, z2c] = nz1c < sz1c && nz2c < sz2c ? [sz1c, sz2c] : [nz1c, nz2c];
    const [z1f, z2f] = nz1f > sz1f && nz2f > sz2f ? [sz1f, sz2f] : [nz1f, nz2f];
    return [z1c, z1f, z2c, z2f];
  } else {
    const cslope = createSlopeCalculator(board, sectorId, true);
    const fslope = createSlopeCalculator(board, sectorId, false);
    return [
      cslope(wall.x, wall.y),
      fslope(wall.x, wall.y),
      cslope(wall2.x, wall2.y),
      fslope(wall2.x, wall2.y)];
  }
}

function sectorToWallEdge(board: Board, sectorId: number, wallId: number, ceiling: boolean, scale: number, renderer: BoardRenderer3D): Renderable {
  const wall1 = board.walls[wallId];
  const wall2 = board.walls[wall1.point2];
  const normal = vec3.scale(vec3.create(), wallNormal(vec3.create(), board, wallId), scale);
  const slope = createSlopeCalculator(board, sectorId, ceiling);
  const wallDir = vec3.fromValues(0, ceiling ? -scale : scale, 0);
  const w1 = vec3.fromValues(wall1.x, slope(wall1.x, wall1.y) / ZSCALE, wall1.y);
  const w2 = vec3.fromValues(wall2.x, slope(wall2.x, wall2.y) / ZSCALE, wall2.y);

  const grid = renderer.writeGrid([
    { a: w2, b: w1, c: vec3.add(vec3.create(), w1, normal), d: vec3.add(vec3.create(), w2, normal) },
    { a: w1, b: w2, c: vec3.add(vec3.create(), w2, wallDir), d: vec3.add(vec3.create(), w1, wallDir) }], 1);
  return renderables(renderer.writeLines([{ start: w1, end: w2 }]), grid);
}

function wallToSectorEdge(board: Board, sectorId: number, wallId: number, ceiling: boolean, scale: number, renderer: BoardRenderer3D): Renderable {
  const wall1 = board.walls[wallId];
  const wall2 = board.walls[wall1.point2];
  const wn = wallNormal(vec3.create(), board, wallId);
  const normal = vec3.negate(vec3.create(), vec3.scale(vec3.create(), wn, scale));
  const slope = createSlopeCalculator(board, sectorId, ceiling);
  const wallDir = vec3.fromValues(0, ceiling ? scale : -scale, 0);
  const w1 = vec3.fromValues(wall1.x, slope(wall1.x, wall1.y) / ZSCALE, wall1.y);
  const w2 = vec3.fromValues(wall2.x, slope(wall2.x, wall2.y) / ZSCALE, wall2.y);

  const grid = renderer.writeGrid([
    { a: w2, b: w1, c: vec3.add(vec3.create(), w1, normal), d: vec3.add(vec3.create(), w2, normal) },
    { a: w1, b: w2, c: vec3.add(vec3.create(), w2, wallDir), d: vec3.add(vec3.create(), w1, wallDir) }], 1);
  return renderables(renderer.writeLines([{ start: w1, end: w2 }]), grid);
}

function selectEdge(hitscan: Entity, board: Board, renderer: BoardRenderer3D): Renderable {
  const wallId = hitscan.id;
  const type = hitscan.type;
  const sectorId = sectorOfWall(board, wallId);

  if (type === EntityType.WALL_CEILING || type === EntityType.WALL_FLOOR) {
    const ceiling = type === EntityType.WALL_CEILING;
    return sectorToWallEdge(board, sectorId, wallId, ceiling, 64, renderer);
  } else {
    const ceiling = type === EntityType.WALL_NEXT_UPPER;
    return wallToSectorEdge(board, sectorId, wallId, ceiling, 64, renderer);
  }
}

function selectWall(hitscan: Entity, board: Board, renderer: BoardRenderer3D, boardGlCtx: BoardGlContext, settings: EngineSettings): Renderable {
  const wallId = hitscan.id;
  const type = hitscan.type;
  const wall = board.walls[wallId];
  const wall2 = board.walls[wall.point2];
  const sectorId = sectorOfWall(board, wallId);
  const nextsectorId = wall.nextsector;

  const [z1c, z1f, z2c, z2f] = getZs(board, sectorId, nextsectorId, wall, wall2, type);

  const p1c = vec3.fromValues(wall.x, z1c / ZSCALE, wall.y);
  const p1f = vec3.fromValues(wall.x, z1f / ZSCALE, wall.y);
  const p2c = vec3.fromValues(wall2.x, z2c / ZSCALE, wall2.y);
  const p2f = vec3.fromValues(wall2.x, z2f / ZSCALE, wall2.y);
  const cLabelPos = vec3.lerp(vec3.create(), p1c, p2c, 0.5);
  const fLabelPos = vec3.lerp(vec3.create(), p1f, p2f, 0.5);
  const w1LabelPos = vec3.lerp(vec3.create(), p1c, p1f, 0.5);
  const w2LabelPos = vec3.lerp(vec3.create(), p2c, p2f, 0.5);

  const lenLabel = vec2.length(vec2.fromValues(wall.x - wall2.x, wall.y - wall2.y)).toFixed(0);
  const dz1Label = Math.abs((z1c - z1f) / ZSCALE).toFixed(0);
  const dz2Label = Math.abs((z2c - z2f) / ZSCALE).toFixed(0);
  const off = POINT_OFF;
  const size = POINT_SIZE;

  const labels: ScreenSpriteRecord[] = [
    { picnum: settings.pointPicnum, off, size, pos: p1c },
    { picnum: settings.pointPicnum, off, size, pos: p1f },
    { picnum: settings.pointPicnum, off, size, pos: p2c },
    { picnum: settings.pointPicnum, off, size, pos: p2f },
    ...printText(lenLabel, settings.fontPicnum, 16, FONT_SIZE, cLabelPos),
    ...printText(lenLabel, settings.fontPicnum, 16, FONT_SIZE, fLabelPos),
    ...printText(dz1Label, settings.fontPicnum, 16, FONT_SIZE, w1LabelPos),
    ...printText(dz2Label, settings.fontPicnum, 16, FONT_SIZE, w2LabelPos)];
  const lines: LineRecord[] = [
    { start: p1c, end: p2c },
    { start: p2c, end: p2f },
    { start: p2f, end: p1f },
    { start: p1f, end: p1c }];
  return renderables(
    renderer.writeWallSelect([{ sectorId, wallId, type: wallTypeSelect(wall, type) }], boardGlCtx),
    renderer.writeLines(lines),
    renderer.writeScreenSprites(labels));
}

function selecSector(hitscan: Entity, board: Board, renderer: BoardRenderer3D, boardGlCtx: BoardGlContext, settings: EngineSettings): Renderable {
  const picnum = settings.pointPicnum;
  const sectorId = hitscan.id;
  const sector = board.sectors[sectorId];
  const ceiling = hitscan.type === EntityType.CEILING ? 1 : 0;
  const slope = createSlopeCalculator(board, sectorId, ceiling === 1);
  const pos = memoize((wallId: number) => {
    const wall = board.walls[wallId];
    const z = slope(wall.x, wall.y) / ZSCALE;
    return vec3.fromValues(wall.x, z, wall.y);
  });
  const points = Iter.range(sector.wallptr, sector.wallptr + sector.wallnum).map(w => ({ picnum, pos: pos(w), off: POINT_OFF, size: POINT_SIZE })).collect();
  const sectorR = renderer.writeSectorSelect([{ ceiling, floor: 1 - ceiling, sectorId }], boardGlCtx);
  const contour: LineRecord[] = [];
  let fw = sector.wallptr;
  sectorWalls(board, sectorId).forEach(w => {
    const wall = board.walls[w];
    if (fw !== w) contour.push({ start: pos(w - 1), end: pos(w) });
    if (wall.point2 === fw) {
      contour.push({ start: pos(w), end: pos(fw) });
      fw = w + 1;
    }
  });
  const firstWall = board.walls[sector.wallptr];
  const secondWall = board.walls[firstWall.point2];
  const [fwx, fwy] = vec2.lerp(vec2.create(), vec2.fromValues(firstWall.x, firstWall.y), vec2.fromValues(secondWall.x, secondWall.y), 0.5);
  const fwPos = vec3.fromValues(fwx, slope(fwx, fwy) / ZSCALE, fwy);
  const fwLabel = printText("F", settings.fontPicnum, 16, FONT_SIZE, fwPos);
  return renderables(sectorR, renderer.writeLines(contour), renderer.writeScreenSprites([...points, ...fwLabel]));
}

function getWallSprite(descriptor: SpriteDescriptor, renderer: BoardRenderer3D, settings: EngineSettings): Renderable {
  const ws = descriptor.wall();
  const a = vec3.fromValues(ws.x1, ws.ztop, ws.y1)
  const b = vec3.fromValues(ws.x2, ws.ztop, ws.y2);
  const c = vec3.fromValues(ws.x2, ws.zbottom, ws.y2);
  const d = vec3.fromValues(ws.x1, ws.zbottom, ws.y1);
  const wpos = vec3.lerp(vec3.create(), a, b, 0.5);
  const hpos = vec3.lerp(vec3.create(), a, d, 0.5);
  const labelw = printText(`${descriptor.info.w}`, settings.fontPicnum, 16, FONT_SIZE, wpos);
  const labelh = printText(`${descriptor.info.h}`, settings.fontPicnum, 16, FONT_SIZE, hpos);
  return renderables(renderer.writeLines([
    { start: a, end: b },
    { start: b, end: c },
    { start: c, end: d },
    { start: d, end: a },
  ]), renderer.writeScreenSprites([...labelw, ...labelh]));
}

function getFloorSprite(descriptor: SpriteDescriptor, renderer: BoardRenderer3D, settings: EngineSettings): Renderable {
  const fs = descriptor.floor();
  const a = vec3.fromValues(fs.x1, fs.z, fs.y1);
  const b = vec3.fromValues(fs.x2, fs.z, fs.y2);
  const c = vec3.fromValues(fs.x3, fs.z, fs.y3);
  const d = vec3.fromValues(fs.x4, fs.z, fs.y4);
  const wpos = vec3.lerp(vec3.create(), a, b, 0.5);
  const hpos = vec3.lerp(vec3.create(), a, d, 0.5);
  const labelw = printText(`${descriptor.info.w}`, settings.fontPicnum, 16, FONT_SIZE, wpos);
  const labelh = printText(`${descriptor.info.h}`, settings.fontPicnum, 16, FONT_SIZE, hpos);
  return renderables(renderer.writeLines([
    { start: a, end: b },
    { start: b, end: c },
    { start: c, end: d },
    { start: d, end: a },
  ]), renderer.writeScreenSprites([...labelw, ...labelh]));
}

function getFaceSprite(descripor: SpriteDescriptor, renderer: BoardRenderer3D): Renderable {
  const fs = descripor.face();
  const x = descripor.info.x;
  const y = descripor.info.y;
  const z = descripor.info.z;
  const a = vec3.fromValues(x + fs.left, z + fs.top, y + fs.left);
  const b = vec3.fromValues(x + fs.right, z + fs.top, y + fs.left);
  const c = vec3.fromValues(x + fs.right, z + fs.top, y + fs.right);
  const d = vec3.fromValues(x + fs.left, z + fs.top, y + fs.right);
  const a1 = vec3.fromValues(x + fs.left, z + fs.bottom, y + fs.left);
  const b1 = vec3.fromValues(x + fs.right, z + fs.bottom, y + fs.left);
  const c1 = vec3.fromValues(x + fs.right, z + fs.bottom, y + fs.right);
  const d1 = vec3.fromValues(x + fs.left, z + fs.bottom, y + fs.right);
  return renderer.writeLines([
    { start: a, end: b },
    { start: b, end: c },
    { start: c, end: d },
    { start: d, end: a },
    { start: a1, end: b1 },
    { start: b1, end: c1 },
    { start: c1, end: d1 },
    { start: d1, end: a1 },
    { start: a, end: a1 },
    { start: b, end: b1 },
    { start: c, end: c1 },
    { start: d, end: d1 },
  ]);
}

function selectSprite(hitscan: Entity, data: BoardData, renderer: BoardRenderer3D, boardGlCtx: BoardGlContext, settings: EngineSettings, aliases: Aliases, art: Map<number, ArtInfoExtended>): Renderable {
  const { board } = data;
  const sprite = board.sprites[hitscan.id];
  const descriptor = notUndefined(data.spriteDescriptor(hitscan.id));
  return match(sprite.cstat.type)
    .with(FACE_SPRITE, () => getFaceSprite(descriptor, renderer))
    .with(WALL_SPRITE, () => getWallSprite(descriptor, renderer, settings))
    .with(FLOOR_SPRITE, () => getFloorSprite(descriptor, renderer, settings))
    .otherwise(() => NOOP_RENDERABLE);
}

export function getOverlay(boardGlCtx: BoardGlContext) {
  return ([hitscan, data, settings, renderer, aliases, art]: [Entity, BoardData, EngineSettings, BoardRenderer3D, Aliases, Map<number, ArtInfoExtended>]) => match(hitscan)
    .with(EMPTY_ENTITY, () => NOOP_RENDERABLE)
    .when(h => h.isSector(), h => selecSector(h, data.board, renderer, boardGlCtx, settings))
    .when(h => h.isWall(), h => selectWall(h, data.board, renderer, boardGlCtx, settings))
    .when(h => h.isSprite(), h => selectSprite(h, data, renderer, boardGlCtx, settings, aliases, art))
    .when(h => h.isEdge(), h => selectEdge(h, data.board, renderer))
    .otherwise(() => NOOP_RENDERABLE)
}