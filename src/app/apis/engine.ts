import { Source } from "@utils/callbacks";
import { EMPTY_COLLECTION } from "@utils/collections";
import { EngineApi } from "build/board/mutations/api";
import { Board } from "build/board/structs";
import { ArtFile } from "build/formats/art";

export interface PicTags {
  allTags(): Iterable<string>;
  tags(picnum: number): Iterable<string>;
}
export const EMPTY_TAGS: PicTags = { allTags: () => EMPTY_COLLECTION, tags: _ => EMPTY_COLLECTION };

export type Palette = { readonly name: string, readonly plu: Uint8Array }
export type NamedArtFile = { name: string, art: ArtFile }

export interface EngineContext<B extends Board> {
  readonly name: string,
  readonly api: EngineApi<B>,
  readonly art: Promise<Source<NamedArtFile[]>>,
  readonly pal: Promise<Source<Uint8Array>>,
  readonly plus: Promise<Source<Map<number, Palette>>>,
  readonly trans: Promise<Source<Uint8Array>>,
  readonly picTags: Promise<Source<PicTags>>,
  readonly shadowsteps: Promise<Source<number>>,

  // createBoardContext(): BoardContext<B>;
}

export interface BoardContext<B extends Board> {
  engine(): EngineContext<B>,
  board(): B,
}

export interface EngineContextFactory {
  create<B extends Board>(): EngineContext<B>;
}

