import { Disconnector, Value } from "ts-utils/callbacks";
import { Consumer } from "ts-utils/types";
import { Board } from "build/board/structs";
import { applyPatches, Draft, Patch, produceWithPatches } from "immer";

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


export function createBoardModifier<B extends Board>(boardValue: Value<B>) {
  const sectorListeners = new Set<Consumer<Set<number>>>();
  const wallListeners = new Set<Consumer<Set<number>>>();
  const spriteListeners = new Set<Consumer<Set<number>>>();
  const onSectorsChange = (c: Consumer<Set<number>>): Disconnector => { sectorListeners.add(c); return () => sectorListeners.delete(c) };
  const onWallsChange = (c: Consumer<Set<number>>): Disconnector => { wallListeners.add(c); return () => wallListeners.delete(c) };
  const onSpritesChange = (c: Consumer<Set<number>>): Disconnector => { spriteListeners.add(c); return () => spriteListeners.delete(c) };
  const history: HistoryEntry[] = [];

  function sendNotifications(changes: Changes) {
    if (changes.sectors.size !== 0) sectorListeners.forEach(l => l(changes.sectors));
    if (changes.walls.size !== 0) wallListeners.forEach(l => l(changes.walls));
    if (changes.sprites.size !== 0) spriteListeners.forEach(l => l(changes.sprites));
  }

  function modifyBoard(label: string, mod: Consumer<Draft<B>>) {
    const baseBaord = boardValue.get();
    const [nextBoard, patches, undoPatches] = produceWithPatches<B>(baseBaord, draft => { mod(draft) });
    if (patches.length === 0) return;
    if (history.length !== 0 && history[history.length - 1].label === label) {
      const prevEntry = history.pop();
      const prevBoard = applyPatches(baseBaord, prevEntry.undoPatches);
      const [newNextBoard, newPatches, newUndoPatches] = produceWithPatches(prevBoard, draft => applyPatches(draft, [...prevEntry.patches, ...patches]));
      boardValue.set(newNextBoard);
      if (newUndoPatches.length === 0) {
        sendNotifications(prevEntry.changes);
      } else {
        const entry = createHistoryEntry(label, newPatches, newUndoPatches);
        history.push(entry);
        sendNotifications(mergeChanges(entry.changes, prevEntry.changes));
      }
    } else {
      boardValue.set(nextBoard);
      const entry = createHistoryEntry(label, patches, undoPatches);
      history.push(entry);
      sendNotifications(entry.changes);
    }
  }

  function undo() {
    if (history.length === 0) return;
    const entry = history.pop();
    const undoBoard = applyPatches(boardValue.get(), entry.undoPatches);
    boardValue.set(undoBoard);
    sendNotifications(entry.changes);
  }

  return { modifyBoard, onSectorsChange, onWallsChange, onSpritesChange, undo };
}
