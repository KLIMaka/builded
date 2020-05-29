import { BuildReferenceTrackerImpl } from '../src/app/modules/default/reftracker';
import { Board } from '../src/build/board/structs';
import { createInnerLoop, createNewSector, deleteLoop, deleteSector, deleteWall, fillInnerLoop, innerSectors, isOuterLoop, loopInnerSectors, looppoints, loopStart, loopWalls, loopWallsFull, mergePoints, splitWall, wallInSector, walllen, wallLoop } from '../src/build/boardutils';
import { ArtInfo, ArtInfoProvider, Attributes } from '../src/build/formats/art';
import { inSector } from '../src/build/utils';
import { map, wrap } from '../src/utils/collections';

const REFS = new BuildReferenceTrackerImpl();
const ART_PROVIDER: ArtInfoProvider = {
  getInfo(picnum: number): ArtInfo {
    return { w: 64, h: 64, attrs: new Attributes(), img: null };
  }
}
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

test('createNewSector', () => {
  const board = createBoardWSector();

  expect(board.numsectors).toBe(1);
  expect(walllen(board, 0)).toBe(1024);
  expect(walllen(board, 1)).toBe(1024);
  expect(walllen(board, 2)).toBe(1024);
  expect(walllen(board, 3)).toBe(1024);
  expect(inSector(board, 0, 0, 0)).toBe(true);
  expect(inSector(board, 0, -1, 0)).toBe(false);
  expect(isOuterLoop(board, 0)).toBe(true);
});

test('deleteWall', () => {
  const board = createBoardWSector();

  const wallRefs = REFS.walls.start();
  const wall1 = wallRefs.ref(1);
  deleteWall(board, 0, REFS);
  expect(walllen(board, 2)).toBeCloseTo(1024 * Math.SQRT2);
  expect(wallRefs.val(wall1)).toBe(0);
  wallRefs.stop();
})

test('splitWall', () => {
  const board = createBoardWSector();

  const wallRefs = REFS.walls.start();
  const wall1 = wallRefs.ref(1);
  splitWall(board, 0, 512, 0, ART_PROVIDER, REFS);
  expect(board.numwalls).toBe(5);
  expect(walllen(board, 0)).toBe(512);
  expect(walllen(board, 1)).toBe(512);
  expect(wallInSector(board, 0, 512, 0)).toBe(1);
  expect(wallRefs.val(wall1)).toBe(2);
  wallRefs.stop();
})

test('mergePoints', () => {
  const board = createBoardWSector();
  splitWall(board, 0, 0, 0, ART_PROVIDER, REFS);
  expect(board.numwalls).toBe(5);
  expect(board.walls[1].x).toBe(0);

  const wallRefs = REFS.walls.start();
  const wall1 = wallRefs.ref(0);
  mergePoints(board, 0, REFS);
  expect(board.numwalls).toBe(4);
  expect(wallRefs.val(wall1)).toBe(-1);
  wallRefs.stop();
})

test('deleteSector', () => {
  const board = createBoardWSector();
  const sectorRefs = REFS.sectors.start();
  const sector0 = sectorRefs.ref(0);
  const wallRefs = REFS.walls.start();
  const wall1 = wallRefs.ref(1);
  deleteSector(board, 0, REFS);
  expect(board.numwalls).toBe(0);
  expect(board.numsectors).toBe(0);
  expect(sectorRefs.val(sector0)).toBe(-1);
  expect(wallRefs.val(wall1)).toBe(-1);
  sectorRefs.stop();
  wallRefs.stop();
})

test('loops', () => {
  const board = createBoardWSector();

  expect([...map(wallLoop(board, 1, 3), w => [w.x, w.y])]).toStrictEqual([[1024, 1024]]);
  expect([...map(wallLoop(board, 0, 3), w => [w.x, w.y])]).toStrictEqual([[1024, 0], [1024, 1024]]);
  expect([...map(wallLoop(board, 3, 1), w => [w.x, w.y])]).toStrictEqual([[0, 0]]);
  expect([...map(wallLoop(board, 0, 1), w => [w.x, w.y])]).toStrictEqual([]);
  expect([...map(wallLoop(board, 1, 2), w => [w.x, w.y])]).toStrictEqual([]);
  expect([...map(wallLoop(board, 3, 0), w => [w.x, w.y])]).toStrictEqual([]);
  expect([...map(wallLoop(board, 0, 0), w => [w.x, w.y])]).toStrictEqual([[1024, 0], [1024, 1024], [0, 1024]]);

  expect([...looppoints(board, 0)]).toStrictEqual([3]);
  expect([...loopWalls(board, 0)]).toStrictEqual([0, 1, 2, 3]);
  expect([...loopWalls(board, 1)]).toStrictEqual([0, 1, 2, 3]);
  expect([...loopWalls(board, 2)]).toStrictEqual([0, 1, 2, 3]);
  expect([...loopWalls(board, 3)]).toStrictEqual([0, 1, 2, 3]);
  expect(() => [...loopWalls(board, 4)]).toThrow();

  createInnerLoop(board, 0, wrap([[100, 100], [900, 100], [900, 900], [100, 900]]), REFS);
  createNewSector(board, wrap([[100, 100], [900, 100], [900, 900], [100, 900]]), REFS);
  expect(board.numsectors).toBe(2);
  expect(board.numwalls).toBe(12);
  expect([...looppoints(board, 0)]).toStrictEqual([3, 7]);
  expect([...loopWalls(board, 3)]).toStrictEqual([0, 1, 2, 3]);
  expect([...loopWalls(board, 5)]).toStrictEqual([4, 5, 6, 7]);
  expect([...loopWalls(board, 9)]).toStrictEqual([8, 9, 10, 11]);
  expect(() => [...loopWalls(board, -1)]).toThrow();
  expect(() => [...loopWalls(board, 12)]).toThrow();
  expect([...loopWallsFull(board, 4)]).toStrictEqual([4, 5, 6, 7]);
  expect(isOuterLoop(board, 8)).toBe(true);
  expect([...loopInnerSectors(board, 1)]).toStrictEqual([]);
  expect([...loopInnerSectors(board, 8)]).toStrictEqual([]);
  expect([...loopInnerSectors(board, 4)]).toStrictEqual([1]);
  expect([...innerSectors(board, 0)]).toStrictEqual([1]);

  createInnerLoop(board, 1, wrap([[200, 200], [800, 200], [800, 800], [200, 800]]), REFS);
  fillInnerLoop(board, 12, REFS);
  expect(board.numsectors).toBe(3);
  expect(board.numwalls).toBe(20);
  expect([...loopWallsFull(board, 4)]).toStrictEqual([4, 5, 6, 7, 12, 13, 14, 15]);
  expect(isOuterLoop(board, 8)).toBe(true);
  expect(isOuterLoop(board, 16)).toBe(true);
  expect([...loopInnerSectors(board, 1)]).toStrictEqual([]);
  expect([...loopInnerSectors(board, 4)]).toStrictEqual([1, 2]);
  expect([...loopInnerSectors(board, 8)]).toStrictEqual([]);
  expect([...innerSectors(board, 0)]).toStrictEqual([1, 2]);
  expect(loopStart(board, 0)).toBe(0);
  expect(loopStart(board, 5)).toBe(4);
  expect(loopStart(board, 17)).toBe(16);
  expect(loopStart(board, 19)).toBe(16);
  expect(() => loopStart(board, 20)).toThrow();

  expect(() => deleteLoop(board, 15, REFS)).toThrow();
  expect(() => deleteLoop(board, 16, REFS)).toThrow();
  expect(() => deleteLoop(board, 0, REFS)).toThrow();

  deleteSector(board, 2, REFS);
  deleteLoop(board, 15, REFS);
  expect(board.numsectors).toBe(2);
  expect(board.numwalls).toBe(12);
  expect([...looppoints(board, 0)]).toStrictEqual([3, 7]);
  expect([...loopWalls(board, 3)]).toStrictEqual([0, 1, 2, 3]);
  expect([...loopWalls(board, 5)]).toStrictEqual([4, 5, 6, 7]);
  expect([...loopWalls(board, 9)]).toStrictEqual([8, 9, 10, 11]);
  expect(() => [...loopWalls(board, -1)]).toThrow();
  expect(() => [...loopWalls(board, 12)]).toThrow();
  expect([...loopWallsFull(board, 4)]).toStrictEqual([4, 5, 6, 7]);
  expect(isOuterLoop(board, 8)).toBe(true);
  expect([...loopInnerSectors(board, 1)]).toStrictEqual([]);
  expect([...loopInnerSectors(board, 8)]).toStrictEqual([]);
  expect([...loopInnerSectors(board, 4)]).toStrictEqual([1]);
  expect([...innerSectors(board, 0)]).toStrictEqual([1]);
});