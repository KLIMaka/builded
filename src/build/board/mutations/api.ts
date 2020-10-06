import { Board, Sector, Sprite, Wall } from "../structs";

export type BoardCloner = (board: Board) => Board;
export type WallCloner = (wall: Wall) => Wall;
export type SpriteCloner = (sprite: Sprite) => Sprite;
export type SectorCloner = (sector: Sector) => Sector;
export type WallCreator = () => Wall;
export type SpriteCreator = () => Sprite;
export type SectorCreator = () => Sector;
export type BoardCreator = () => Board;

export type EngineApi = {
  readonly cloneBoard: BoardCloner,
  readonly cloneWall: WallCloner,
  readonly cloneSprite: SpriteCloner,
  readonly cloneSector: SectorCloner,
  readonly newWall: WallCreator,
  readonly newSector: SectorCreator,
  readonly newSprite: SpriteCreator,
  readonly newBoard: BoardCreator,
}