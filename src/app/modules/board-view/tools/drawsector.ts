import { disposer, Source, ValuesContainer } from "ts-utils/callbacks";
import { Controller3D } from "@utils/camera/controller3d";
import { slidingPairs, wrap } from "ts-utils/collections";
import { iter } from "ts-utils/iter";
import { BoardContext, EngineContext, EngineSettings, gridSnap } from "app/apis/engine";
import { BuildReferenceTrackerImpl } from "app/modules/default/reftracker";
import { createNewSector } from "build/board/mutations/createsector";
import { createInnerLoop } from "build/board/mutations/sectors";
import { splitSector } from "build/board/mutations/splitsector";
import { findContainingSectorMidPoints, isValidSectorId, wallInSector } from "build/board/query";
import { Board } from "build/board/structs";
import { Target } from "build/hitscan";
import { ZSCALE } from "build/utils";
import { vec2, vec3 } from "gl-matrix";
import { match } from "ts-pattern";
import { LineRecord, NOOP_RENDERABLE, printText, Renderable, renderables, ScreenSpriteRecord } from "../api";
import { BoardRenderer3D } from "../boardRenderer3d";
import { pair } from "ts-utils/types";
import { Action, ActionDescriptors } from "app/apis/actions";

type VoidContour = {
  type: 'void'
}

type RectContour = {
  type: 'rect',
  z: number,
  p1: [number, number],
  p2: [number, number]
}

type PolyContour = {
  type: 'poly'
  z: number,
  points: [number, number][],
}

type Contour = VoidContour | RectContour | PolyContour;
type DrawType = Exclude<Contour['type'], 'void'>;

export type DrawSectorTool = {
  renderable: Source<Renderable>
  registerActions: (ad: ActionDescriptors) => Action[]
}


const EMPTY_CONTOUR: Contour = { type: "void" };

const POINT_OFF = vec2.fromValues(-2.5, 2.5);
const POINT_SIZE = vec2.fromValues(5, 5);
const FONT_SIZE = vec2.fromValues(8, 8);

function getPos(hitscan: Source<Target[]>, boardCtx: BoardContext): [number, number, number] {
  const [rawx, rawy, rawz] = hitscan.get()[0].coords;
  const gridSize = boardCtx.grid.size.get();
  const x = gridSnap(gridSize, rawx);
  const y = gridSnap(gridSize, rawy);
  const z = gridSnap(gridSize, rawz);
  return [x, y, z];
}

function findContainingSector(board: Board, points: [number, number][]): number {
  const sectors = findContainingSectorMidPoints(board, points);
  return sectors.size === 1 ? sectors.values().next().value : -1;
}

function isSplitSector(board: Board, points: [number, number][]): number {
  const sectorId = findContainingSector(board, points);
  if (sectorId === -1) return -1;
  const first = points.at(0);
  const last = points.at(-1);
  return wallInSector(board, sectorId, first[0], first[1]) !== -1
    && wallInSector(board, sectorId, last[0], last[1]) !== -1 ? sectorId : -1;
}

function polyRender(points: [number, number][], z: number, s: EngineSettings, r: BoardRenderer3D) {
  const picnum = s.pointPicnum;
  const lines = iter(slidingPairs(points))
    .map<LineRecord>(([[x1, y1], [x2, y2]]) => ({ start: vec3.fromValues(x1, z, y1), end: vec3.fromValues(x2, z, y2) }))
    .collect();
  const sprites = iter(points)
    .map<ScreenSpriteRecord>(([x, y]) => ({ pos: vec3.fromValues(x, z, y), off: POINT_OFF, size: POINT_SIZE, picnum }))
    .chain(iter(lines)
      .map(({ start, end }) => {
        const len = vec3.len(vec3.sub(vec3.create(), end, start)).toFixed(0);
        const mid = vec3.lerp(vec3.create(), start, end, 0.5);
        return printText(len, s.fontPicnum, 16, FONT_SIZE, mid)
      }).flatten())
    .collect();
  return renderables(r.writeLines(lines), r.writeScreenSprites(sprites));
}

function rect(x1: number, y1: number, x2: number, y2: number, closed: boolean): [number, number][] {
  return [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
    ...(closed ? [pair(x1, y1)] : [])
  ]
}

function createRenderable(values: ValuesContainer, contour: Source<Contour>, renderer: Source<BoardRenderer3D>, settings: Source<EngineSettings>): Source<Renderable> {
  return values.transformedTuple('contour-renderable', [contour, renderer, settings], ([c, r, s]) => match(c)
    .with({ type: 'void' }, () => NOOP_RENDERABLE)
    .with({ type: 'poly' }, ({ points, z }) => polyRender(points, z, s, r))
    .with({ type: 'rect' }, ({ p1: [x1, y1], p2: [x2, y2], z }) => polyRender(rect(x1, y1, x2, y2, true), z, s, r))
    .exhaustive()
    , { disposer: disposer() })
}

export function createDrawSectorTool(values: ValuesContainer, ctl: Controller3D, renderer: Source<BoardRenderer3D>, settings: Source<EngineSettings>, hitscan: Source<Target[]>, boardCtx: BoardContext, engine: EngineContext): DrawSectorTool {
  const contour = values.value<Contour>('contour', EMPTY_CONTOUR);
  const contourType = values.field('contour-type', contour, 'type');
  const renderable = createRenderable(values, contour, renderer, settings);

  values.handleStandalone([contourType, ctl.camera.position, ctl.forwardMouse], ([type, campos, camdir]) => {
    if (type === 'void') return;
    contour.modImmer(c => {
      const [x, y] = getPos(hitscan, boardCtx);
      if (c.type === 'poly') {
        c.points[c.points.length - 1] = [x, y];
      } else if (c.type === 'rect') {
        c.p2 = [x, y];
      }
    })
  });

  const draw = (type: DrawType) => {
    const c = contour.get();
    if (c.type === 'void') {
      const [x, y, buildZ] = getPos(hitscan, boardCtx);
      const z = buildZ / ZSCALE;
      contour.set(match(type)
        .returnType<Contour>()
        .with('rect', type => ({ type, z, p1: [x, y], p2: [x, y] }))
        .with('poly', type => ({ type, z, points: [[x, y], [x, y]] }))
        .exhaustive());
    } else {
      if (c.type === 'poly') {
        const { points } = c;
        const first = points[0];
        const last = points[points.length - 1];
        if (first[0] === last[0] && first[1] === last[1]) {
          const npoints = points.slice(0, -1);
          if (npoints.length >= 3)
            boardCtx.modifyBoard('Create sector', board => {
              const refs = new BuildReferenceTrackerImpl();
              const sectorId = findContainingSector(board, npoints);
              if (!isValidSectorId(board, sectorId)) return;
              createInnerLoop(board, sectorId, npoints, refs, engine.api);
              createNewSector(board, wrap(npoints), refs, engine.api);
            });
          contour.set(EMPTY_CONTOUR);
        } else {
          const board = boardCtx.board.get();
          const splitSectorId = isSplitSector(board, points);
          if (isValidSectorId(board, splitSectorId)) {
            const ref = new BuildReferenceTrackerImpl();
            boardCtx.modifyBoard(`Split sector ${splitSectorId}`, board =>
              splitSector(board, splitSectorId, wrap(points), ref, engine.api));
            contour.set(EMPTY_CONTOUR);
          } else contour.modImmer((c: PolyContour) => c.points.push(c.points[points.length - 1]));
        }
      } else if (c.type === 'rect') {
        const { p1: [x1, y1], p2: [x2, y2] } = c;
        if (x1 !== x2 && y1 !== y2) {
          boardCtx.modifyBoard('Create sector', board => {
            const refs = new BuildReferenceTrackerImpl();
            const points = rect(x1, y1, x2, y2, false);
            const sectorId = findContainingSector(board, points);
            if (!isValidSectorId(board, sectorId)) return;
            createInnerLoop(board, sectorId, points, refs, engine.api);
            createNewSector(board, wrap(points), refs, engine.api);
          });
        }
        contour.set(EMPTY_CONTOUR);
      }
    }
  }

  const back = () => {
    const c = contour.get();
    if (c.type === 'void') return;
    else if (c.type === 'rect' || (c.type === 'poly' && c.points.length === 2)) {
      contour.set(EMPTY_CONTOUR);
    } else if (c.type === 'poly') {
      const [x, y] = getPos(hitscan, boardCtx);
      contour.modImmer((c: PolyContour) => {
        c.points.pop();
        c.points[c.points.length - 1] = [x, y];
      })
    }
  }

  const registerActions = (desc: ActionDescriptors) => {
    return [
      desc.bindSync('draw', () => draw('poly')),
      desc.bindSync('draw-rect', () => draw('rect')),
      desc.bindSync('draw-back', () => back()),
    ];
  }

  return { renderable, registerActions }
}