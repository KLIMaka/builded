import { BuildReferenceTrackerImpl } from '../src/app/modules/default/reftracker';
import { triangulate } from '../src/app/modules/geometry/builders/sector';
import { Board } from '../src/build/board/structs';
import { createNewSector } from '../src/build/boardutils';
import { wrap } from '../src/utils/collections';

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
  createNewSector(board, wrap([[0, 0], [1024, 0], [1024, 1024], [0, 1024]]), refs);
  return board;
}


test('triangulate', () => {
  const board = createBoardWSector();
  expect(triangulate(board, 0)).toStrictEqual([[[1024, 0], [1024, 1024], [0, 0], [0, 1024]], [0, 1, 2, 1, 3, 2]]);
});