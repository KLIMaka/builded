import { BuildReferenceTrackerImpl } from '../src/app/modules/default/reftracker';
import { Board, Wall } from '../src/build/board/structs';
import { clockwise, createInnerLoop, createNewSector, deleteLoop, deleteSector, deleteWall, fillInnerLoop, findContainingSector, findContainingSectorMidPoints, findSectorsAtPoint, innerSectors, isOuterLoop, loopInnerSectors, loopWallsFull, mergePoints, splitWall, wallInSector, walllen, wallsBetween } from '../src/build/boardutils';
import { ArtInfo, ArtInfoProvider, Attributes } from '../src/build/formats/art';
import { inPolygon, inSector } from '../src/build/utils';
import { map, wrap } from '../src/utils/collections';
import { splitSector } from '../src/build/board/splitsector';
import { saveBuildMap, loadBuildMap } from '../src/build/maploader';
import { saveBloodMap, loadBloodMap, cloneBoard } from '../src/build/blood/maploader';
import { loopPoints, loopWalls, loopStart } from '../src/build/board/internal';
import { Stream } from '../src/utils/stream';
import { BloodBoard } from '../src/build/blood/structs';

const REFS = new BuildReferenceTrackerImpl();
const ART_PROVIDER: ArtInfoProvider = {
  getInfo(picnum: number): ArtInfo {
    return { w: 64, h: 64, attrs: new Attributes(), img: null };
  }
}
function createEmptyBoard() {
  const board = new Board();
  board.cursectnum = board.ang = 0;
  board.posx = board.posy = board.posz = 0;
  board.version = 0;
  board.walls = [];
  board.sectors = [];
  board.sprites = [];
  board.numwalls = 0;
  board.numsectors = 0;
  board.numsprites = 0;
  return board;
}

function xy(x: number, y: number): [number, number] { return [x, y] }

function createBoardWSector() {
  const board = createEmptyBoard();
  const refs = new BuildReferenceTrackerImpl();
  createNewSector(board, wrap([[0, 0], [1024, 0], [1024, 1024], [0, 1024]]), refs);
  return board;
}

test('save_load', () => {
  const board = createBoardWSector();
  const buffer = saveBuildMap(board);
  expect(loadBuildMap(new Stream(buffer, true))).toStrictEqual(board);
})

test('save_load Blood', () => {
  const board = cloneBoard(<BloodBoard>createBoardWSector());
  const buffer = saveBloodMap(board);
  expect(loadBloodMap(new Stream(buffer, true))).toStrictEqual(board);
})

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
  const WALL_MAPPER = (w: Wall) => [w.x, w.y];

  expect([...map(wallsBetween(board, 1, 3), WALL_MAPPER)]).toStrictEqual([[1024, 0], [1024, 1024]]);
  expect([...map(wallsBetween(board, 0, 3), WALL_MAPPER)]).toStrictEqual([[0, 0], [1024, 0], [1024, 1024]]);
  expect([...map(wallsBetween(board, 3, 1), WALL_MAPPER)]).toStrictEqual([[0, 1024], [0, 0]]);
  expect([...map(wallsBetween(board, 0, 1), WALL_MAPPER)]).toStrictEqual([[0, 0]]);
  expect([...map(wallsBetween(board, 1, 2), WALL_MAPPER)]).toStrictEqual([[1024, 0]]);
  expect([...map(wallsBetween(board, 3, 0), WALL_MAPPER)]).toStrictEqual([[0, 1024]]);
  expect([...map(wallsBetween(board, 0, 0), WALL_MAPPER)]).toStrictEqual([]);

  expect([...loopPoints(board, 0)]).toStrictEqual([3]);
  expect([...loopWalls(board, 0)]).toStrictEqual([0, 1, 2, 3]);
  expect([...loopWalls(board, 1)]).toStrictEqual([0, 1, 2, 3]);
  expect([...loopWalls(board, 2)]).toStrictEqual([0, 1, 2, 3]);
  expect([...loopWalls(board, 3)]).toStrictEqual([0, 1, 2, 3]);
  expect(() => [...loopWalls(board, 4)]).toThrow();

  createInnerLoop(board, 0, wrap([[100, 100], [900, 100], [900, 900], [100, 900]]), REFS);
  createNewSector(board, wrap([[100, 100], [900, 100], [900, 900], [100, 900]]), REFS);
  expect(board.numsectors).toBe(2);
  expect(board.numwalls).toBe(12);
  expect([...loopPoints(board, 0)]).toStrictEqual([3, 7]);
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
  expect([...loopPoints(board, 0)]).toStrictEqual([3, 7]);
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


//        F*------------------*G
//         |        *A        |
//         |       /  \       |
//         |      /    \      |
//         |     /      \     |
//         |   B*--------*C   |
//         |    |        |    |
//         |   D*--------*E   |
//        H*------------------*J

test('splitSector', () => {
  const board = createBoardWSector();
  const A = xy(500, 50);
  const B = xy(100, 100);
  const C = xy(900, 100);
  const D = xy(100, 900);
  const E = xy(900, 900);
  const F = xy(0, 0);
  const G = xy(1024, 0);
  const H = xy(0, 1024);
  const J = xy(1024, 1024);

  const NEXT_SECTOR = (w: number): number => board.walls[w].nextsector;
  const NEXT_WALL = (w: number): number => board.walls[w].nextwall;
  const COORDS = (w: number): number[] => [board.walls[w].x, board.walls[w].y];

  createInnerLoop(board, 0, wrap([B, C, E, D]), REFS);
  fillInnerLoop(board, 4, REFS);
  splitSector(board, 0, wrap([C, A, B]), REFS);

  expect(board.numsectors).toBe(3);
  expect(board.numwalls).toBe(16);
  expect([...loopWalls(board, 4)]).toStrictEqual([4, 5, 6, 7, 8]);
  expect([...map(loopWalls(board, 0), COORDS)]).toStrictEqual([F, G, J, H]);
  expect([...map(loopWalls(board, 4), COORDS)]).toStrictEqual([C, A, B, D, E]);
  expect([...map(loopWalls(board, 9), COORDS)]).toStrictEqual([B, C, E, D]);
  expect([...map(loopWalls(board, 13), COORDS)]).toStrictEqual([C, B, A]);
  expect([...map(loopWalls(board, 0), NEXT_SECTOR)]).toStrictEqual([-1, -1, -1, -1]);
  expect([...map(loopWalls(board, 4), NEXT_SECTOR)]).toStrictEqual([2, 2, 1, 1, 1]);
  expect([...map(loopWalls(board, 9), NEXT_SECTOR)]).toStrictEqual([2, 0, 0, 0]);
  expect([...map(loopWalls(board, 13), NEXT_SECTOR)]).toStrictEqual([1, 0, 0]);
  expect([...map(loopWalls(board, 0), NEXT_WALL)]).toStrictEqual([-1, -1, -1, -1]);
  expect([...map(loopWalls(board, 4), NEXT_WALL)]).toStrictEqual([15, 14, 12, 11, 10]);
  expect([...map(loopWalls(board, 9), NEXT_WALL)]).toStrictEqual([13, 8, 7, 6]);
  expect([...map(loopWalls(board, 13), NEXT_WALL)]).toStrictEqual([9, 5, 4]);
  expect([...findContainingSector(board, wrap([B, E]))]).toStrictEqual([0, 1]);
  expect([...findContainingSectorMidPoints(board, wrap([B, E]))]).toStrictEqual([1]);

  splitSector(board, 1, wrap([E, B]), REFS);
  expect(board.numsectors).toBe(4);
  expect(board.numwalls).toBe(18);
  expect([...loopWalls(board, 4)]).toStrictEqual([4, 5, 6, 7, 8]);
  expect([...map(loopWalls(board, 0), COORDS)]).toStrictEqual([F, G, J, H]);
  expect([...map(loopWalls(board, 4), COORDS)]).toStrictEqual([C, A, B, D, E]);
  expect([...map(loopWalls(board, 9), COORDS)]).toStrictEqual([B, E, D]);
  expect([...map(loopWalls(board, 13), COORDS)]).toStrictEqual([C, B, A]);
  expect([...map(loopWalls(board, 16), COORDS)]).toStrictEqual([B, C, E]);
  expect([...map(loopWalls(board, 0), NEXT_SECTOR)]).toStrictEqual([-1, -1, -1, -1]);
  expect([...map(loopWalls(board, 4), NEXT_SECTOR)]).toStrictEqual([2, 2, 1, 1, 3]);
  expect([...map(loopWalls(board, 9), NEXT_SECTOR)]).toStrictEqual([3, 0, 0]);
  expect([...map(loopWalls(board, 13), NEXT_SECTOR)]).toStrictEqual([3, 0, 0]);
  expect([...map(loopWalls(board, 16), NEXT_SECTOR)]).toStrictEqual([2, 0, 1]);
  expect([...map(loopWalls(board, 0), NEXT_WALL)]).toStrictEqual([-1, -1, -1, -1]);
  expect([...map(loopWalls(board, 4), NEXT_WALL)]).toStrictEqual([14, 13, 11, 10, 16]);
  expect([...map(loopWalls(board, 9), NEXT_WALL)]).toStrictEqual([17, 7, 6]);
  expect([...map(loopWalls(board, 13), NEXT_WALL)]).toStrictEqual([15, 5, 4]);
  expect([...map(loopWalls(board, 16), NEXT_WALL)]).toStrictEqual([12, 8, 9]);

  expect([...findSectorsAtPoint(board, B[0], B[1])]).toStrictEqual([0, 1, 3, 2]);
  expect([...findContainingSector(board, wrap([B, [50, 500], D]))]).toStrictEqual([0]);
});

test('splitSector1', () => {
  const board = createBoardWSector();
  const NEXT_SECTOR = (w: number): number => board.walls[w].nextsector;
  const NEXT_WALL = (w: number): number => board.walls[w].nextwall;
  const COORDS = (w: number): number[] => [board.walls[w].x, board.walls[w].y];

  splitSector(board, 0, wrap([[0, 0], [1024, 1024]]), REFS);
  expect(board.numsectors).toBe(2);
  expect(board.numwalls).toBe(6);
  expect([...loopWalls(board, 0)]).toStrictEqual([0, 1, 2]);
  expect([...loopWalls(board, 3)]).toStrictEqual([3, 4, 5]);
  expect([...map(loopWalls(board, 0), COORDS)]).toStrictEqual([[1024, 1024], [0, 0], [1024, 0]]);
  expect([...map(loopWalls(board, 3), COORDS)]).toStrictEqual([[1024, 1024], [0, 1024], [0, 0]]);
  expect([...map(loopWalls(board, 0), NEXT_SECTOR)]).toStrictEqual([1, -1, -1]);
  expect([...map(loopWalls(board, 3), NEXT_SECTOR)]).toStrictEqual([-1, -1, 0]);
  expect([...map(loopWalls(board, 0), NEXT_WALL)]).toStrictEqual([5, -1, -1]);
  expect([...map(loopWalls(board, 3), NEXT_WALL)]).toStrictEqual([-1, -1, 0]);
});

test('splitSector2', () => {
  const board = createBoardWSector();
  const NEXT_SECTOR = (w: number): number => board.walls[w].nextsector;
  const NEXT_WALL = (w: number): number => board.walls[w].nextwall;
  const COORDS = (w: number): number[] => [board.walls[w].x, board.walls[w].y];

  createInnerLoop(board, 0, wrap([[100, 100], [100, 900], [900, 900], [900, 100]]), REFS);
  fillInnerLoop(board, 4, REFS);
  splitSector(board, 1, wrap([[900, 900], [100, 100]]), REFS);

  expect(board.numsectors).toBe(3);
  expect(board.numwalls).toBe(14);
  expect([...loopWalls(board, 0)]).toStrictEqual([0, 1, 2, 3]);
  expect([...loopWalls(board, 4)]).toStrictEqual([4, 5, 6, 7]);
  expect([...loopWalls(board, 8)]).toStrictEqual([8, 9, 10]);
  expect([...loopWalls(board, 11)]).toStrictEqual([11, 12, 13]);
  expect([...map(loopWalls(board, 0), COORDS)]).toStrictEqual([[0, 0], [1024, 0], [1024, 1024], [0, 1024]]);
  expect([...map(loopWalls(board, 4), COORDS)]).toStrictEqual([[100, 100], [100, 900], [900, 900], [900, 100]]);
  expect([...map(loopWalls(board, 8), COORDS)]).toStrictEqual([[100, 100], [900, 900], [100, 900]]);
  expect([...map(loopWalls(board, 11), COORDS)]).toStrictEqual([[100, 100], [900, 100], [900, 900]]);
  expect([...map(loopWalls(board, 0), NEXT_SECTOR)]).toStrictEqual([-1, -1, -1, -1]);
  expect([...map(loopWalls(board, 4), NEXT_SECTOR)]).toStrictEqual([1, 1, 2, 2]);
  expect([...map(loopWalls(board, 8), NEXT_SECTOR)]).toStrictEqual([2, 0, 0]);
  expect([...map(loopWalls(board, 11), NEXT_SECTOR)]).toStrictEqual([0, 0, 1]);
  expect([...map(loopWalls(board, 0), NEXT_WALL)]).toStrictEqual([-1, -1, -1, -1]);
  expect([...map(loopWalls(board, 4), NEXT_WALL)]).toStrictEqual([10, 9, 12, 11]);
  expect([...map(loopWalls(board, 8), NEXT_WALL)]).toStrictEqual([13, 5, 4]);
  expect([...map(loopWalls(board, 11), NEXT_WALL)]).toStrictEqual([7, 6, 8]);
});

test('inPolygon', () => {
  const LOOP = wrap(<[number, number][]>[[-256, 384], [-256, -384], [768, -256], [768, 384]]);
  expect(inPolygon(-1600, -800, LOOP)).toBe(false);
  expect(clockwise(LOOP)).toBe(true);
});