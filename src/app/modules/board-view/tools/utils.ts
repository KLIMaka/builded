import { Source } from "ts-utils/callbacks";
import { Action, ActionDescriptors } from "app/apis/actions";
import { BoardContext, EngineContext, gridSnap } from "app/apis/engine";
import { Flip, NamedMessage, PanRepeat, ResetPanRepeat, Rotate, SetPicnum, Shade } from "app/edit/messages";
import { BuildReferenceTrackerImpl } from "app/modules/default/reftracker";
import { splitWall } from "build/board/mutations/walls";
import { sectorOfWall, snapWall } from "build/board/query";
import { Target } from "build/hitscan";
import { Selection } from "../tools";
import { splitSectorFromPoint } from "build/board/mutations/splitsector";
import { deleteLoop, deleteLoopFull, deleteSectorFull, fillInnerLoop, setFirstWall } from "build/board/mutations/sectors";
import { selectPicnum } from "app/modules/arteditor/art-select-model";
import { Injector } from "ts-utils/injector";

export type UtilsTool = {
  registerActions: (ad: ActionDescriptors) => Action[]
}

function firstTarget(targets: Source<Target[]>): Target {
  return targets.get()[0];
}

const refs = new BuildReferenceTrackerImpl();

export function createUtilsTool(boardCtx: BoardContext, selection: Source<Selection>, hitscan: Source<Target[]>, engine: EngineContext, injector: Injector): UtilsTool {

  const grid = (scale = 1) => boardCtx.grid.size.get() * scale;

  const doSplitWall = () => {
    const t = firstTarget(hitscan);
    if (!t.entity.isWall()) return;
    const { entity: { id: w }, coords: [cx, cy] } = t;
    const gridSize = boardCtx.grid.size.get();
    const [x, y] = snapWall(boardCtx.board.get(), w, cx, cy, x => gridSnap(gridSize, x));
    boardCtx.modifyBoard(`Split wall ${w} on ${x},${y}`,
      board => splitWall(board, w, x, y, p => engine.artMap.get().get(p), refs, engine.api.cloneWall));
  }

  const doSplitSectorPoint = () => {
    const t = firstTarget(hitscan);
    if (!t.entity.isWall()) return;
    const { entity: { id: w }, coords: [cx, cy] } = t;
    const gridSize = boardCtx.grid.size.get();
    const [x, y] = snapWall(boardCtx.board.get(), w, cx, cy, x => gridSnap(gridSize, x));
    boardCtx.modifyBoard(`Split Sector on Wall ${w} from point [${x}, ${y}]`,
      board => splitSectorFromPoint(board, w, [x, y], p => engine.artMap.get().get(p), refs, engine.api));
  }

  const doFillInnerLoop = () => {
    const t = firstTarget(hitscan);
    if (!t.entity.isWall()) return;
    const { entity: { id: w } } = t;
    boardCtx.modifyBoard(`Fill Loop on ${w}`, board => fillInnerLoop(board, w, refs, engine.api));
  }

  const doDeleteLoop = () => {
    const t = firstTarget(hitscan);
    if (!t.entity.isWall()) return;
    const { entity: { id: w } } = t;
    boardCtx.modifyBoard(`Delete loop ${w}`, board => deleteLoop(board, w, refs));
  }

  const doDeleteFull = () => {
    const t = firstTarget(hitscan);
    if (t.entity.isWall()) {
      const { entity: { id: w } } = t;
      boardCtx.modifyBoard(`Delete Full Loop on wall ${w}`, board => deleteLoopFull(board, w, refs));
    } else if (t.entity.isSector()) {
      const { entity: { id: s } } = t;
      boardCtx.modifyBoard(`Delete Sector ${s}`, board => deleteSectorFull(board, s, refs));
    }
  }

  const doSetFirstWall = () => {
    const t = firstTarget(hitscan);
    if (!t.entity.isWall()) return;
    const { entity: { id: w } } = t;
    boardCtx.modifyBoard(`Set First Wall ${w}`, board => setFirstWall(board, sectorOfWall(board, w), w, refs));
  }


  const registerActions = (desc: ActionDescriptors) => {
    return [
      desc.bindSync('pan-up', () => selection.get().handle(new PanRepeat(0, grid(), 0, 0))),
      desc.bindSync('pan-down', () => selection.get().handle(new PanRepeat(0, -grid(), 0, 0))),
      desc.bindSync('pan-right', () => selection.get().handle(new PanRepeat(-grid(), 0, 0, 0))),
      desc.bindSync('pan-left', () => selection.get().handle(new PanRepeat(grid(), 0, 0, 0))),

      desc.bindSync('pan-up-one', () => selection.get().handle(new PanRepeat(0, 1, 0, 0, false))),
      desc.bindSync('pan-down-one', () => selection.get().handle(new PanRepeat(0, -1, 0, 0, false))),
      desc.bindSync('pan-right-one', () => selection.get().handle(new PanRepeat(-1, 0, 0, 0, false))),
      desc.bindSync('pan-left-one', () => selection.get().handle(new PanRepeat(1, 0, 0, 0, false))),

      desc.bindSync('repeat-up', () => selection.get().handle(new PanRepeat(0, 0, 0, 1))),
      desc.bindSync('repeat-down', () => selection.get().handle(new PanRepeat(0, 0, 0, -1))),
      desc.bindSync('repeat-right', () => selection.get().handle(new PanRepeat(0, 0, 1, 0))),
      desc.bindSync('repeat-left', () => selection.get().handle(new PanRepeat(0, 0, -1, 0))),

      desc.bindSync('pan-repeat-reset', () => selection.get().handle(new ResetPanRepeat())),

      desc.bindSync('flip', () => selection.get().handle(new Flip())),
      desc.bindSync('delete', () => selection.get().handle(new NamedMessage('delete'))),
      desc.bindSync('up', () => selection.get().handle(new NamedMessage('up'))),
      desc.bindSync('down', () => selection.get().handle(new NamedMessage('down'))),
      desc.bindSync('rot-up', () => selection.get().handle(new Rotate(128))),
      desc.bindSync('rot-down', () => selection.get().handle(new Rotate(-128))),

      desc.bindSync('shadow-up', () => selection.get().handle(new Shade(-1))),
      desc.bindSync('shadow-down', () => selection.get().handle(new Shade(1))),
      desc.bindSync('shadow-up-fast', () => selection.get().handle(new Shade(-8))),
      desc.bindSync('shadow-down-fast', () => selection.get().handle(new Shade(8))),

      desc.bindSync('split-wall', () => doSplitWall()),
      desc.bindSync('split-sector', () => doSplitSectorPoint()),
      desc.bindSync('fill-loop', () => doFillInnerLoop()),
      desc.bindSync('delete-loop', () => doDeleteLoop()),
      desc.bindSync('delete-full', () => doDeleteFull()),
      desc.bindSync('set-first-wall', () => doSetFirstWall()),

      desc.bind('set-picnum', async () => {
        const sel = selection.get();
        const picnum = await selectPicnum(injector, engine, boardCtx);
        picnum.ifPresent(picnum => sel.handle(new SetPicnum(picnum)));
      })
    ];
  }

  return { registerActions }
}