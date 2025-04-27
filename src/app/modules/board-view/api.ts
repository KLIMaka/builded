import { Disposable } from "@utils/callbacks";
import { vec2, vec3 } from "gl-matrix";

export type SectorRecord = { sectorId: number, ceiling: boolean, floor: boolean };
export enum WallType { VOID, NONMASKED, MASKED, ONLY_MASKED };
export type WallRecord = { wallId: number, sectorId: number, type: WallType };
export type SpriteRecord = { spriteId: number };
export type VoxelRecord = { spriteId: number, voxelPicnum: number };
export type LineRecord = { start: vec3, end: vec3 };
export type ScreenSpriteRecord = { picnum: number, pos: vec3, off: vec2, size: vec2 };
export type Renderable = { render(gl: WebGL2RenderingContext): void } & Disposable;

export function renderables(...renderables: Renderable[]): Renderable {
  const render = (gl: WebGL2RenderingContext) => renderables.forEach(r => r.render(gl));
  const dispose = async () => renderables.forEach(r => r.dispose());
  return { render, dispose };
}

export const NOOP_RENDERABLE: Renderable = { render(_) { }, async dispose() { } }
