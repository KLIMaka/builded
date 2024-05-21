import { Source, constSource, transformed, tuple } from "@utils/callbacks";
import { EMPTY_COLLECTION } from "@utils/collections";
import { iter } from "@utils/iter";
import { second } from "@utils/types";
import { EMPTY_TAGS, EngineContext, Palette, PicTags } from "app/apis/engine";
import { FileSystem } from "app/apis/fs";
import { BloodBoard } from "build/blood/structs";
import { EngineApi } from "build/board/mutations/api";
import { cloneBoard, cloneSector, cloneSprite, cloneWall, newBoard, newSector, newSprite, newWall } from '../../../build/blood/maploader';
import { packegeFs, loadArt, loadRaw, openFile, openFileOptional } from "../default/engine-commons";
import { createRffFsArrayBuffer, stack, watchFile } from "../fs/fs";

function engineApi(): EngineApi<BloodBoard> {
  return { cloneBoard, cloneWall, cloneSprite, cloneSector, newWall, newSector, newSprite, newBoard };
}

function genDefaultPlu(): Uint8Array {
  const plu = new Uint8Array(256 * 64);
  for (let s = 0; s < 64; s++) {
    for (let i = 0; i < 256; i++) plu[s * 256 + i] = i;
  }
  return plu;
}

async function loadPlus(fs: Source<FileSystem>): Promise<Source<Map<number, Palette>>> {
  const defaultPlu = genDefaultPlu();
  const palettes = ['NORMAL', 'SATURATE', 'BEAST', 'TOMMY', 'SPIDER3', 'GRAY', 'GRAYISH', 'SPIDER1', 'SPIDER2', 'FLAME', 'COLD', 'P1', 'P2', 'P3', 'P4'];
  const loadPals = await Promise.all(palettes.map(p => openFileOptional(`${p}.PLU`, fs)));
  return transformed(tuple(...loadPals), p => {
    return iter(p)
      .enumerate()
      .toMap(second, ([p, i]) => { return { name: palettes[i], plu: p.map(ab => new Uint8Array(ab)).orElse(defaultPlu) } as Palette });
  });
}

async function loadPicTags(fs: FileSystem): Promise<Source<PicTags>> {
  return transformed(await watchFile('SURFACE.DAT', fs), s => s
    .map(f => loadTags(f))
    .orElse(EMPTY_TAGS)
  );
}

function loadTags(surfaceDat: ArrayBuffer): PicTags {
  const surface = new Uint8Array(surfaceDat);
  const tags = ['None', 'Stone', 'Metal', 'Wood', 'Flesh', 'Water', 'Dirt', 'Clay', 'Snow', 'Ice', 'Leaves', 'Cloth', 'Plant', 'Goo', 'Lava'];
  return { allTags: () => tags, tags: id => surface.length <= id ? EMPTY_COLLECTION : [tags[surface[id]]] };
}


export async function createEngineContext(fs: FileSystem): Promise<EngineContext<BloodBoard>> {
  const api = engineApi();
  const name = "Blood";
  const bloodRff = await packegeFs(fs, 'BLOOD.RFF', async buff => createRffFsArrayBuffer(buff));
  const stackFs = transformed(bloodRff, bloodRff => stack(fs, bloodRff));
  const pal = loadRaw(await openFile('BLOOD.PAL', stackFs));
  const trans = loadRaw(await openFile('TRANS.TLU', stackFs));
  const picTags = loadPicTags(fs);
  const plus = loadPlus(stackFs);
  const art = loadArt(stackFs);
  const shadowsteps = Promise.resolve(constSource(64));

  return { name, api, pal, trans, picTags, plus, art, shadowsteps }
}