import { Disposable } from "ts-utils/callbacks";
import { iter } from "ts-utils/iter";
import { vec2, vec3 } from "gl-matrix";

export type SectorRecord = { sectorId: number, ceiling: number, floor: number };
export enum WallType { VOID, NONMASKED, MASKED, ONLY_MASKED, ONLY_UPPER, ONLY_LOWER };
export type WallRecord = { wallId: number, sectorId: number, type: WallType };
export type SpriteRecord = { spriteId: number };
export type VoxelRecord = { spriteId: number, voxelPicnum: number };
export type LineRecord = { start: vec3, end: vec3 };
export type ScreenSpriteRecord = { picnum: number, pos: vec3, off: vec2, size: vec2, tiles?: number, tileId?: number };
export type GridRecord = { a: vec3, b: vec3, c: vec3, d: vec3 };
export type Renderable = { render(gl: WebGL2RenderingContext): void } & Disposable;

export function renderables(...renderables: Renderable[]): Renderable {
  const render = (gl: WebGL2RenderingContext) => renderables.forEach(r => r.render(gl));
  const dispose = async () => renderables.forEach(r => r.dispose());
  return { render, dispose };
}

export const NOOP_RENDERABLE: Renderable = { render(_) { }, async dispose() { } }

export function printText(text: string, fontId: number, fontTiles: number, size: vec2, pos: vec3): ScreenSpriteRecord[] {
  const centerOffW = -(size[0] * text.length) / 2;
  const centerOffH = size[1] / 2;
  const topOff = vec2.fromValues(0, size[1]);
  return iter(text)
    .enumerate()
    .map<ScreenSpriteRecord[]>(([c, i]) => {
      const tileId = c.charCodeAt(0);
      const off = vec2.fromValues(centerOffW + i * size[0], centerOffH);
      const rtopOff = vec2.add(vec2.create(), off, topOff);
      return [
        { pos, picnum: fontId, tiles: fontTiles, size, tileId, off },
        { pos, picnum: fontId, tiles: fontTiles, size, tileId: 3, off: rtopOff }]
    })
    .flatten()
    .chain([
      { pos, picnum: fontId, tiles: fontTiles, size, tileId: 0, off: vec2.fromValues(centerOffW - size[0], centerOffH) },
      { pos, picnum: fontId, tiles: fontTiles, size, tileId: 2, off: vec2.fromValues(centerOffW - size[0], centerOffH + size[1]) },
      { pos, picnum: fontId, tiles: fontTiles, size, tileId: 1, off: vec2.fromValues(centerOffW + text.length * size[0], centerOffH) }])
    .collect();
}
