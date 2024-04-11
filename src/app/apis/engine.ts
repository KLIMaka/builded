import { Source } from "@utils/callbacks";
import { Function } from "@utils/types";
import { EngineApi } from "build/board/mutations/api";
import { Board } from "build/board/structs";
import { ArtInfo } from "build/formats/art";
import Optional from "optional-js";

export interface PicTags {
  allTags(): Iterable<string>;
  tags(picnum: number): Iterable<string>;
}

export type Palette = { readonly name: string, readonly plu: Uint8Array }

export type ArtProvider = Function<number, Source<Optional<ArtInfo>>>;

export interface EngineContext<B extends Board> {
  readonly name: string,
  readonly api: EngineApi<B>,
  readonly art: Promise<ArtProvider>,
  readonly pal: Promise<Source<Uint8Array>>,
  readonly plus: Promise<Source<Map<number, Palette>>>,
  readonly trans: Promise<Source<Uint8Array>>,
  readonly picTags: Promise<Source<PicTags>>,

  // createBoardContext(): BoardContext<B>;
}

export interface BoardContext<B extends Board> {
  engine(): EngineContext<B>,
  board(): B,
}

export interface EngineContextFactory {
  create<B extends Board>(): EngineContext<B>;
}

