import { Disconnector, Source, Value } from "ts-utils/callbacks";
import { BiConsumer, Consumer, notUndefined } from "ts-utils/types";
import { Board } from "build/board/structs";
import { applyPatches, Draft, Patch, produceWithPatches } from "immer";
import { BoardData } from "app/apis/engine";

type Changes = {
  sectors: Set<number>;
  walls: Set<number>;
  sprites: Set<number>;
}

function mergeChanges(lh: Changes, rh: Changes): Changes {
  const sectors = lh.sectors.union(rh.sectors);
  const walls = lh.walls.union(rh.walls);
  const sprites = lh.sprites.union(rh.sprites);
  return { sectors, walls, sprites };
}

type HistoryEntry = Readonly<{
  label: string,
  patches: Patch[];
  undoPatches: Patch[];
  changes: Changes,
}>;

function collectChanges(patches: Patch[]) {
  const sectors = new Set<number>();
  const walls = new Set<number>();
  const sprites = new Set<number>();
  patches.forEach(p => {
    const [field, idx] = p.path;
    if (field === 'sectors') sectors.add(idx as number);
    if (field === 'walls') walls.add(idx as number);
    if (field === 'sprites') sprites.add(idx as number);
  });
  return { sectors, walls, sprites };
}

function createHistoryEntry(label: string, patches: Patch[], undoPatches: Patch[], customChanges?: Changes): HistoryEntry {
  const changes = customChanges ?? collectChanges(patches);
  return { label, changes, patches, undoPatches };
}


export function createBoardModifier<B extends Board>(boardValue: Value<B>, boardData: Source<BoardData<B>>) {
  const sectorListeners = new Set<BiConsumer<BoardData<B>, Set<number>>>();
  const wallListeners = new Set<BiConsumer<BoardData<B>, Set<number>>>();
  const spriteListeners = new Set<BiConsumer<BoardData<B>, Set<number>>>();

  const onSectorsChange = (c: BiConsumer<BoardData<B>, Set<number>>): Disconnector => { sectorListeners.add(c); return () => sectorListeners.delete(c) };
  const onWallsChange = (c: BiConsumer<BoardData<B>, Set<number>>): Disconnector => { wallListeners.add(c); return () => wallListeners.delete(c) };
  const onSpritesChange = (c: BiConsumer<BoardData<B>, Set<number>>): Disconnector => { spriteListeners.add(c); return () => spriteListeners.delete(c) };

  const history: HistoryEntry[] = [];

  function sendNotifications(board: B, changes: Changes) {
    const data = boardData.get();
    if (changes.sectors.size !== 0) sectorListeners.forEach(l => l(data, changes.sectors));
    if (changes.walls.size !== 0) wallListeners.forEach(l => l(data, changes.walls));
    if (changes.sprites.size !== 0) spriteListeners.forEach(l => l(data, changes.sprites));
  }

  function modifyBoard(label: string, mod: Consumer<Draft<B>>) {
    const baseBaord = boardValue.get();
    const [nextBoard, patches, undoPatches] = produceWithPatches<B>(baseBaord, draft => { mod(draft) });
    if (patches.length === 0) return;
    if (history.length !== 0 && history[history.length - 1].label === label) {
      const prevEntry = notUndefined(history.pop());
      const prevBoard = applyPatches(baseBaord, prevEntry.undoPatches);
      const [newNextBoard, newPatches, newUndoPatches] = produceWithPatches(prevBoard, draft => applyPatches(draft, [...prevEntry.patches, ...patches]));
      boardValue.set(newNextBoard);
      if (newUndoPatches.length === 0) {
        sendNotifications(newNextBoard, prevEntry.changes);
      } else {
        const entry = createHistoryEntry(label, newPatches, newUndoPatches);
        history.push(entry);
        sendNotifications(newNextBoard, mergeChanges(entry.changes, prevEntry.changes));
      }
    } else {
      boardValue.set(nextBoard);
      const entry = createHistoryEntry(label, patches, undoPatches);
      history.push(entry);
      sendNotifications(nextBoard, entry.changes);
    }
  }

  function undo() {
    if (history.length === 0) return;
    const entry = notUndefined(history.pop());
    const undoBoard = applyPatches(boardValue.get(), entry.undoPatches);
    boardValue.set(undoBoard);
    sendNotifications(undoBoard, entry.changes);
  }

  return { modifyBoard, onSectorsChange, onWallsChange, onSpritesChange, undo };
}
