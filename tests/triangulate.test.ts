import { BuildReferenceTrackerImpl } from '../src/app/modules/default/reftracker';
import { triangulate } from '../src/app/modules/geometry/builders/sector';
import { createNewSector } from '../src/build/board/mutations/ceatesector';
import { cloneBoard, cloneSector, cloneSprite, cloneWall, newBoard, newSector, newSprite, newWall } from '../src/build/maploader';
import { wrap } from '../src/utils/collections';

const API = { cloneBoard, cloneSector, cloneWall, cloneSprite, newSector, newSprite, newWall, newBoard };

function createBoardWSector() {
  const board = API.newBoard();
  const refs = new BuildReferenceTrackerImpl();
  createNewSector(board, wrap([[0, 0], [1024, 0], [1024, 1024], [0, 1024]]), refs, API);
  return board;
}


test('triangulate', () => {
  const board = createBoardWSector();
  expect(triangulate(board, 0)).toStrictEqual([[[1024, 0], [1024, 1024], [0, 0], [0, 1024]], [0, 1, 2, 1, 3, 2]]);
});