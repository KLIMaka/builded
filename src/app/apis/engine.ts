import { Disconnector, Disposable, Source } from "@utils/callbacks";
import { EMPTY_COLLECTION, emptyMap } from "@utils/collections";
import { Stream } from "@utils/stream";
import { EngineApi } from "build/board/mutations/api";
import { Board, Sector, Sprite, Wall } from "build/board/structs";
import { ArtFile, ArtInfo, EMPTY_INFO } from "build/formats/art";
import { VoxelData } from "build/formats/kvx";
import Optional from "optional-js";
import { FileSystem } from "./fs";
import { Consumer, Function } from "@utils/types";
import { vec3 } from "gl-matrix";
import { Draft } from "immer";

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
  blends: Source<Function<number, GlBlend>>,
  parallaxInfo: Function<number, number>;

  loadBoard(stream: Stream): Promise<BoardContext<B>>;
}> & Disposable;

export type RorLink = Readonly<{
  dstSector: number;
  buildDiff: vec3;
  transparent: boolean;
}>;

export interface RorLinks {
  ceilLink(sectorId: number): RorLink;
  floorLink(sectorId: number): RorLink;
  hasRor(sectorId: number): boolean;
}

export const EMPTY_ROR_LINKS: RorLinks = {
  ceilLink: _ => undefined,
  floorLink: _ => undefined,
  hasRor: _ => false,
};

export type BuildRor = Readonly<{
  rorLinks: RorLinks;
  isMirrorPic(picnum: number): boolean;
}>;

export type BuildTror = Readonly<{
  ceiling(sectorId: number): number[];
  floor(sectorId: number): number[];
}>;

export type GridController = Readonly<{
  size: Source<number>;
  setGridSize(size: number): void;
  incGridSize(): void;
  decGridSize(): void;
  snap(x: number, mod?: number): number;
}>

export type BoardContext<B extends Board = Board> = Readonly<{
  board: Source<B>,
  grid: GridController,
  ror: BuildRor,
  tror: BuildTror,
  parallaxPicnums: number;
  spritesBySector(sectorId: number): number[];

  onWallsChange(c: Consumer<Set<number>>): Disconnector;
  onSectorsChange(c: Consumer<Set<number>>): Disconnector;
  onSpritesChange(c: Consumer<Set<number>>): Disconnector;

  modifyBoard(msg: string, mod: Consumer<Draft<B>>): void;
  undo(): void;
}> & Disposable;

export interface EngineContextFactory<B extends Board = Board> {
  create(fs: Source<FileSystem>): EngineContext<B>;
}

