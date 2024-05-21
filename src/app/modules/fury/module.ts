import { Source, constSource, transformed } from "@utils/callbacks";
import { mapBuilder } from "@utils/collections";
import { EMPTY_TAGS, EngineContext, Palette } from "app/apis/engine";
import { FileSystem } from "app/apis/fs";
import { EngineApi } from "build/board/mutations/api";
import { Board } from "build/board/structs";
import { cloneBoard, cloneSector, cloneSprite, cloneWall, newBoard, newSector, newSprite, newWall } from "build/maploader";
import { packegeFs, loadArt, loadRaw, openFile } from "../default/engine-commons";
import { createZipFsArrayBuffer, stack } from "../fs/fs";

function engineApi(): EngineApi<Board> {
  return { cloneBoard, cloneWall, cloneSprite, cloneSector, newWall, newSector, newSprite, newBoard };
}

async function loadShadowsteps(pal: Source<ArrayBuffer>): Promise<Source<number>> {
  return transformed(pal, pal => pal.byteLength / 256)
}

async function loadPlus(lookup: Source<ArrayBuffer>): Promise<Source<Map<number, Palette>>> {
  return transformed(lookup, lookup => mapBuilder<number, Palette>().add(0, { name: 'PAL 0', plu: new Uint8Array(lookup) }).build());
}

export async function createEngineContext(fs: FileSystem): Promise<EngineContext<Board>> {
  const api = engineApi();
  const name = "Ion Fury";
  const grp = await packegeFs(fs, 'FURY.GRP', createZipFsArrayBuffer);
  const stackFs = transformed(grp, grp => stack(fs, grp));
  const palette = await openFile('palette/basepalette_000.raw', stackFs);
  const pal = loadRaw(palette);
  const trans = loadRaw(await openFile('palette/blendtable_000.raw', stackFs));
  const picTags = Promise.resolve(constSource(EMPTY_TAGS));
  const plus = loadPlus(await openFile('palette/palookup_000.raw', stackFs));
  const art = loadArt(stackFs);
  const shadowsteps = loadShadowsteps(palette);

  return { name, api, pal, trans, picTags, plus, art, shadowsteps }
}