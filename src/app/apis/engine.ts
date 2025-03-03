import { Disposable, Source } from "@utils/callbacks";
import { EMPTY_COLLECTION, emptyMap } from "@utils/collections";
import { Stream } from "@utils/stream";
import { EngineApi } from "build/board/mutations/api";
import { Board } from "build/board/structs";
import { ArtFile, ArtInfo, EMPTY_INFO } from "build/formats/art";
import { VoxelData } from "build/formats/kvx";
import Optional from "optional-js";
import { BoardUtils } from "./app";
import { FileSystem } from "./fs";
import { Function } from "@utils/types";
import { vec3 } from "gl-matrix";

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

export type RorLink = Readonly<{
  dstSector: number,
  buildDiff: vec3;
}>;

export interface RorLinks {
  ceilLink(sectorId: number): RorLink;
  floorLink(sectorId: number): RorLink;
  hasRor(sectorId: number): boolean;
}
export const EMPTY_ROR_LINKS = {
  ceilLink: _ => undefined,
  floorLink: _ => undefined,
  hasRor: _ => false,
} as RorLinks;

export interface BuildRor {
  readonly rorLinks: RorLinks;
  isMirrorPic(picnum: number): boolean;
}

export interface BuildTror {
  ceiling(sectorId: number): number[];
  floor(sectorId: number): number[];
}

export type EngineSettings = {
  readonly spriteShadowOff: boolean;
  readonly trans1: number;
  readonly trans2: number;
}

export type VoxelSwap = (picnum: number) => Optional<VoxelData>;

export type GlBlend = { src: number, dst: number };

export interface EngineContext<B extends Board = Board> extends Disposable {
  readonly name: Source<string>,
  readonly api: EngineApi<B>,
  readonly settings: EngineSettings,
  readonly resources: Source<FileSystem>,
  readonly art: Source<NamedArtFile[]>,
  readonly artMap: Source<Map<number, ArtInfoExtended>>,
  readonly pal: Source<Uint8Array>,
  readonly plus: Source<Palette[]>,
  readonly maxPluId: Source<number>,
  readonly trans: Source<Uint8Array>,
  readonly picTags: Source<PicTags>,
  readonly shadowsteps: Source<number>,
  readonly aliases: Source<Aliases>,
  readonly spriteVoxelSwap: Source<VoxelSwap>,
  readonly blends: Source<Function<number, GlBlend>>,
  readonly parallaxInfo: Function<number, number>;

  // createBoardContext(): BoardContext<B>;
  loadBoard(stream: Stream): Promise<BoardContext<B>>;
}

export interface BoardContext<B extends Board = Board> {
  readonly board: B,
  readonly ror: BuildRor,
  readonly tror: BuildTror,
  readonly utils: BoardUtils,
  readonly lotagSectorText: (sectorId: number) => string;
  readonly lotagWallText: (wallId: number) => string;
  readonly lotagSpriteText: (spriteId: number) => string;
  readonly parallaxPicnums: number;
}

export interface EngineContextFactory<B extends Board = Board> {
  create(fs: Source<FileSystem>): EngineContext<B>;
}

