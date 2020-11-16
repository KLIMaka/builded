import { BuildReferenceTrackerImpl } from '../src/app/modules/default/reftracker';
import { EngineApi } from '../src/build/board/mutations/api';
import { createNewSector } from "../src/build/board/mutations/ceatesector";
import { createInnerLoop } from "../src/build/board/mutations/sectors";
import { splitWall } from '../src/build/board/mutations/walls';
import { getPortals } from "../src/build/board/portalizer";
import { ArtInfo, ArtInfoProvider, Attributes } from '../src/build/formats/art';
import * as BUILD from '../src/build/maploader';
import { wrap } from '../src/utils/collections';

const REFS = new BuildReferenceTrackerImpl();
const INFO = { w: 64, h: 64, attrs: new Attributes(), img: null };
const ART_PROVIDER: ArtInfoProvider = { getInfo(picnum: number): ArtInfo { return INFO } }
const BUILD_API: EngineApi = {
  newBoard: BUILD.newBoard,
  cloneBoard: BUILD.cloneBoard,
  cloneSector: BUILD.cloneSector,
  cloneWall: BUILD.cloneWall,
  cloneSprite: BUILD.cloneSprite,
  newSector: BUILD.newSector,
  newSprite: BUILD.newSprite,
  newWall: BUILD.newWall
};

test('getPortals', () => {
  const board = BUILD_API.newBoard();
  createNewSector(board, wrap([[0, 0], [100, 0], [100, 100], [0, 100]]), REFS, BUILD_API);
  expect([...getPortals(board, 0)]).toStrictEqual([{ looppoint: 3, portals: [] }]);

  createNewSector(board, wrap([[100, 0], [200, 0], [200, 100], [100, 100]]), REFS, BUILD_API);
  expect([...getPortals(board, 0)]).toStrictEqual([{ looppoint: 3, portals: [[1]] }]);
  expect([...getPortals(board, 1)]).toStrictEqual([{ looppoint: 7, portals: [[7]] }]);

  splitWall(board, 1, 100, 50, ART_PROVIDER, REFS, BUILD_API.cloneWall);
  expect([...getPortals(board, 0)]).toStrictEqual([{ looppoint: 4, portals: [[1, 2]] }]);
  expect([...getPortals(board, 1)]).toStrictEqual([{ looppoint: 9, portals: [[8, 9]] }]);

  createNewSector(board, wrap([[200, 0], [300, 0], [300, 100], [200, 100]]), REFS, BUILD_API);
  expect([...getPortals(board, 0)]).toStrictEqual([{ looppoint: 4, portals: [[1, 2]] }]);
  expect([...getPortals(board, 1)]).toStrictEqual([{ looppoint: 9, portals: [[6], [8, 9]] }]);
  expect([...getPortals(board, 2)]).toStrictEqual([{ looppoint: 13, portals: [[13]] }]);

  createInnerLoop(board, 0, [[25, 25], [75, 25], [75, 75], [25, 75]], REFS, BUILD_API);
  expect([...getPortals(board, 0)]).toStrictEqual([{ looppoint: 4, portals: [[1, 2]] }, { looppoint: 8, portals: [] }]);

  splitWall(board, 8, 25, 35, ART_PROVIDER, REFS, BUILD_API.cloneWall);
  splitWall(board, 9, 25, 65, ART_PROVIDER, REFS, BUILD_API.cloneWall);
  createNewSector(board, wrap([[25, 35], [65, 35], [65, 65], [25, 65]]), REFS, BUILD_API);
  expect([...getPortals(board, 0)]).toStrictEqual([{ looppoint: 4, portals: [[1, 2]] }, { looppoint: 10, portals: [[9]] }]);
});