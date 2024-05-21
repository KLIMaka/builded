import { Source, constSource, transformed, tuple } from "@utils/callbacks";
import { range } from "@utils/collections";
import { iter } from "@utils/iter";
import { first, second } from "@utils/types";
import { EMPTY_TAGS, EngineContext, Palette } from "app/apis/engine";
import { FileSystem } from "app/apis/fs";
import { EngineApi } from "build/board/mutations/api";
import { Board } from "build/board/structs";
import { createPalette, loadPlus as loadPlusGrp, loadShadeTables, loadTrans as loadTransGrp } from "build/formats/grp";
import { cloneBoard, cloneSector, cloneSprite, cloneWall, newBoard, newSector, newSprite, newWall } from "build/maploader";
import Optional from "optional-js";
import { packegeFs, loadArt, openFile, openFileOptional } from "../default/engine-commons";
import { createGrpFsArrayuBuffer, stack } from "../fs/fs";

function engineApi(): EngineApi<Board> {
  return { cloneBoard, cloneWall, cloneSprite, cloneSector, newWall, newSector, newSprite, newBoard };
}

async function loadPal(pal: Source<ArrayBuffer>): Promise<Source<Uint8Array>> {
  return transformed(pal, pal => createPalette(pal))
}

async function loadShadowsteps(pal: Source<ArrayBuffer>): Promise<Source<number>> {
  return transformed(pal, pal => loadShadeTables(pal).length)
}

async function loadPlus(lookup: Source<Optional<ArrayBuffer>>, pal: Source<ArrayBuffer>): Promise<Source<Map<number, Palette>>> {
  return transformed(tuple(lookup, pal), ([lookup, pal]) => {
    const plus = lookup.map(lookup => loadPlusGrp(lookup)).orElseGet(() => [new Uint8Array([...range(0, 256)])]);
    const shadowTables = loadShadeTables(pal);
    const shadowSteps = shadowTables.length;
    return iter(plus).enumerate().map<[number, Palette]>(([plu, pluid]) => {
      const shadowedPlu = new Uint8Array(256 * shadowSteps);
      iter(shadowTables).enumerate().forEach(([st, i]) => shadowedPlu.set(iter(st).map(s => plu[s]).collect(), 256 * i))
      return [pluid, { name: `PAL ${pluid}`, plu: shadowedPlu } as Palette];
    }).toMap(first, second);
  });
}

async function loadTrans(pal: Source<ArrayBuffer>) {
  return transformed(pal, pal => loadTransGrp(pal));
}

export async function createEngineContext(fs: FileSystem): Promise<EngineContext<Board>> {
  const api = engineApi();
  const name = "Duke 3d";
  const grp = await packegeFs(fs, 'DUKE3D.GRP', async buff => createGrpFsArrayuBuffer(buff));
  const stackFs = transformed(grp, grp => stack(fs, grp));
  const palette = await openFile('PALETTE.DAT', stackFs);
  const pal = loadPal(palette);
  const trans = loadTrans(palette);
  const picTags = Promise.resolve(constSource(EMPTY_TAGS));
  const plus = loadPlus(await openFileOptional('LOOKUP.DAT', stackFs), palette);
  const art = loadArt(stackFs);
  const shadowsteps = loadShadowsteps(palette);

  return { name, api, pal, trans, picTags, plus, art, shadowsteps }
}