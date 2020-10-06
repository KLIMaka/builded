import { BuildReferenceTrackerImpl } from '../src/app/modules/default/reftracker';
import { triangulate } from '../src/app/modules/geometry/builders/sector';
import { createNewSector } from '../src/build/board/mutations/ceatesector';
import { Board } from '../src/build/board/structs';
import { wrap } from '../src/utils/collections';
import { cloneBoard, loadBloodMap, saveBloodMap, cloneSector, cloneWall, cloneSprite, newSector, newSprite, newWall } from '../src/build/blood/maploader';

const API = { cloneBoard, cloneSector, cloneWall, cloneSprite, newSector, newSprite, newWall };

function createEmptyBoard() {
  const board = new Board();
  board.walls = [];
  board.sectors = [];
  board.sprites = [];
  board.numwalls = 0;
  board.numsectors = 0;
  board.numsprites = 0;
  return board;
}

function createBoardWSector() {
  const board = createEmptyBoard();
  const refs = new BuildReferenceTrackerImpl();
  createNewSector(board, wrap([[0, 0], [1024, 0], [1024, 1024], [0, 1024]]), refs, API);
  return board;
}


test('triangulate', () => {
  const board = createBoardWSector();
  expect(triangulate(board, 0)).toStrictEqual([[[1024, 0], [1024, 1024], [0, 0], [0, 1024]], [0, 1, 2, 1, 3, 2]]);
});