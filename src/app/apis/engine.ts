import { Disconnector, Disposable, Source } from "ts-utils/callbacks";
import { EMPTY_COLLECTION, emptyMap } from "ts-utils/collections";
import { Stream } from "ts-utils/stream";
import { EngineApi } from "build/board/mutations/api";
import { Board, Sector, Sprite, Wall } from "../../build/board/structs";
import { ArtFile, ArtInfo, EMPTY_INFO } from "../../build/formats/art";
import { VoxelData } from "build/formats/kvx";
import Optional from "optional-js";
import { FileSystem } from "./fs";
import { BiConsumer, Consumer, Fn } from "ts-utils/types";
import { vec3 } from "gl-matrix";
import { Draft } from "immer";
import { SpriteDescriptor } from "build/sprites";

export interface PicTags {
  allTags(): Iterable<string>;
  tags(picnum: number): Iterable<string>;
}
export const EMPTY_TAGS = { allTags: () => EMPTY_COLLECTION, tags: _ => EMPTY_COLLECTION } as PicTags;

export type Aliases = {
  get(picnum: number): string;
  all(): Map<number, string>;
}
export const EMPTY_ALIASES = { get: _ => '', all: emptyMap } as Aliases;

export type Palette = { readonly id: number, readonly name: string, readonly plu: Uint8Array }
export type NamedArtFile = { readonly name: string, readonly art: ArtFile }
export type ArtInfoExtended = ArtInfo & { readonly artFile: string }
export const EMPTY_INFO_EXTENDED = { ...EMPTY_INFO, artFile: '' } as ArtInfoExtended;

export type EngineSettings = Readonly<{
  spriteShadowOff: boolean;
  trans1: number;
  trans2: number;
  lotagSectorText: (sector: Sector) => string;
  lotagWallText: (wall: Wall) => string;
  lotagSpriteText: (sprite: Sprite) => string;

  fontPicnum: number,
  pointPicnum: number,
}>;

export type VoxelSwap = (picnum: number) => Optional<VoxelData>;

export type GlBlend = { src: number, dst: number };
export const DEFAULT_BLEND: GlBlend = { src: WebGL2RenderingContext.SRC_ALPHA, dst: WebGL2RenderingContext.ONE_MINUS_SRC_ALPHA };

export type EngineContext<B extends Board = Board> = Readonly<{
  name: Source<string>,
  api: EngineApi<B>,
  settings: Source<EngineSettings>,
  resources: Source<FileSystem>,
  art: Source<NamedArtFile[]>,
  artMap: Source<Map<number, ArtInfoExtended>>,
  pal: Source<Uint8Array>,
  plus: Source<Palette[]>,
  maxPluId: Source<number>,
  trans: Source<Uint8Array>,
  picTags: Source<PicTags>,
  shadowsteps: Source<number>,
  aliases: Source<Aliases>,
  spriteVoxelSwap: Source<VoxelSwap>,
  blends: Source<Fn<number, GlBlend>>,
  parallaxInfo: Fn<number, number>;

  loadBoard(stream: Stream, name?: string): Promise<BoardContext<B>>;
}> & Disposable;

export type SectorDrawType = 'normal' | 'nodraw' | 'trans1' | 'trans2';
export type SectorSurfaceType = 'ceiling' | 'floor';
export type SectorSettings = Record<SectorSurfaceType, SectorDrawType>;
export const DEFAULT_SECTOR_SETTING: SectorSettings = { ceiling: 'normal', floor: 'normal' };

export type RorLink = Readonly<{
  dstSector: number;
  buildDiff: vec3;
  transparent: boolean;
}>;

export interface RorLinks {
  ceilLink(sectorId: number): RorLink | undefined;
  floorLink(sectorId: number): RorLink | undefined;
}

export const EMPTY_ROR_LINKS: RorLinks = {
  ceilLink: _ => undefined,
  floorLink: _ => undefined,
};

export type BuildRor = Readonly<{
  rorLinks: RorLinks;
  isMirrorPic(picnum: number): boolean;
}>;

export type BuildTror = Readonly<{
  ceiling(sectorId: number): number[];
  floor(sectorId: number): number[];
}>;

export function gridSnap(gridSize: number, x: number, mod = 1) {
  const size = gridSize * mod;
  return Math.round(x / size) * size;
}

export type GridController = Readonly<{
  size: Source<number>;
  setGridSize(size: number): void;
  incGridSize(): void;
  decGridSize(): void;
}>

export type BoardData<B extends Board = Board> = {
  board: B,
  ror: BuildRor,
  tror: BuildTror,
  parallaxPicnums: number,
  sectorSettings: Fn<number, SectorSettings>,
  spritesBySector: Fn<number, number[] | undefined>,
  spriteDescriptor: Fn<number, SpriteDescriptor | undefined>,
}

export type BoardContext<B extends Board = Board> = Readonly<{
  name?: string,
  grid: GridController,
  data: Source<BoardData<B>>,

  onWallsChange(c: BiConsumer<BoardData<B>, Set<number>>): Disconnector;
  onSectorsChange(c: BiConsumer<BoardData<B>, Set<number>>): Disconnector;
  onSpritesChange(c: BiConsumer<BoardData<B>, Set<number>>): Disconnector;

  modifyBoard(msg: string, mod: Consumer<Draft<B>>): void;
  undo(): void;
  save(): Promise<ArrayBuffer>;
}> & Disposable;

export interface EngineContextFactory<B extends Board = Board> {
  create(fs: Source<FileSystem>): EngineContext<B>;
}

