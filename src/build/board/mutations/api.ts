import { Board, Sector, Sprite, Wall } from "../structs";

export type BoardCloner<T extends Board> = (board: T) => T;
export type WallCloner<T extends Wall> = (wall: T) => T;
export type SpriteCloner<T extends Sprite> = (sprite: T) => T;
export type SectorCloner<T extends Sector> = (sector: T) => T;
export type WallCreator<T extends Wall> = () => T;
export type SpriteCreator<T extends Sprite> = () => T;
export type SectorCreator<T extends Sector> = () => T;
export type BoardCreator<T extends Board> = () => T;

export type BoardWall<B extends Board> = B['walls'][number];
export type BoardSector<B extends Board> = B['sectors'][number];
export type BoardSprite<B extends Board> = B['sprites'][number];

export type EngineApi<B extends Board> = {
  readonly cloneBoard: BoardCloner<B>,
  readonly cloneWall: WallCloner<BoardWall<B>>,
  readonly cloneSprite: SpriteCloner<BoardSprite<B>>,
  readonly cloneSector: SectorCloner<BoardSector<B>>,
  readonly newWall: WallCreator<BoardWall<B>>,
  readonly newSector: SectorCreator<BoardSector<B>>,
  readonly newSprite: SpriteCreator<BoardSprite<B>>,
  readonly newBoard: BoardCreator<B>,
}

