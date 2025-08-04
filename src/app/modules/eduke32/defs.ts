import { Source, ValuesContainer } from "ts-utils/callbacks";
import { createGrpOrZipFsArrayBuffer, EMPTY, stack, trackFiles } from "../fs/fs";
import { first, identity, nil } from "ts-utils/types";
import { Stream } from "ts-utils/stream";
import { FileSystem } from "app/apis/fs";
import { ScriptFile, rules, simpleRule, token, set, rulesInclude, rule, nestedRule, number, pushField, stringRule, numberRule, boolRule, createScripFile, tuple } from "@utils/scriptfile";
import { asyncMapOptional } from "ts-utils/objects";
import { NOOP_TASK_HANDLE } from "ts-utils/scheduler";
import { Work, begin, tuple as tupleWork } from "ts-utils/work";
import { openFile } from "../default/engine-commons";

export type FileDef = { file: string, offset?: number };
export type VoxelDef = { picnum: number } & FileDef;
export type PalDef = { id: number, shiftleft?: number } & FileDef;
export type PluDef = { id: number, noshades?: boolean, floorpal?: boolean, copyof?: number } & FileDef;
export type GlBlendDef = { src: string, dst: string };
export type BlendDef = { id: number, forward?: GlBlendDef, reverse?: GlBlendDef } & FileDef;
export type TileFromTexture = { picnum: number, file: string, alphacut?: number, xoff?: number, yoff?: number };
export type AnimTileRange = { start: number, end: number, speed: number, anim?: number };
export type EngineDefs = {
  root: FileSystem
  mainGrp: FileSystem,
  addGrp: FileSystem,
  pals: PalDef[],
  blends: BlendDef[],
  plus: PluDef[],
  voxels: VoxelDef[],
  tiles: TileFromTexture[],
  animTileRanges: AnimTileRange[],
}
export type GrpInfo = { name?: string, defname?: string }

export function cloneDefs(defs: EngineDefs): EngineDefs {
  return {
    root: defs.root,
    mainGrp: defs.mainGrp,
    addGrp: defs.addGrp,
    blends: [...defs.blends],
    pals: [...defs.pals],
    plus: [...defs.plus],
    voxels: [...defs.voxels],
    tiles: [...defs.tiles],
    animTileRanges: [...defs.animTileRanges]
  }
}

export async function loadDefaultEngineDefs(values: ValuesContainer, root: Source<FileSystem>, mainGrp: Source<FileSystem>): Promise<Source<EngineDefs>> {
  const load = async ([root, mainGrp]: [FileSystem, FileSystem]): Promise<EngineDefs> => {
    const fs = stack(root, mainGrp);
    const voxels: VoxelDef[] = [];
    const plus: PluDef[] = [];
    const pals: PalDef[] = [];
    const blends: BlendDef[] = [];
    const addGrp = EMPTY;
    const tiles: TileFromTexture[] = [];
    const animTileRanges = [];
    await fs.read('palette.dat').then(o => o.ifPresent(ab => {
      pals.push({ id: 0, file: 'palette.dat', shiftleft: 2 });
      plus.push({ id: 0, file: 'palette.dat', offset: 0x300 + 2 })
      blends.push({ id: 0, file: 'palette.dat', offset: 0x300 + 2 + 32 * 0x100 });
    }));
    await fs.read('lookup.dat').then(o => o.ifPresent(ab => {
      const stream = new Stream(ab);
      const size = stream.readUByte();
      for (let i = 1; i <= size; i++) {
        const id = stream.readUByte();
        plus.push({ id, file: 'lookup.dat', offset: stream.mark(), noshades: true });
        stream.skip(0x100);
      }
    }));
    return { root, mainGrp, addGrp, plus, voxels, pals, blends, tiles, animTileRanges }
  }
  const files = ['palette.dat', 'lookup.dat'];
  return values.transformedAsyncTuple('default-engine-defs', [root, mainGrp], load, nil(), trackFiles(files, first, load))
}

async function openGrp(values: ValuesContainer, fs: Source<FileSystem>, grpName: string): Promise<Source<FileSystem>> {
  const fn = `${grpName}.grp`;
  const file = await openFile(values, fn, fs);
  return values.transformedAsync(fn, file, async ab => createGrpOrZipFsArrayBuffer(ab));
}

export function loadEngineDefsWork(grpName: string, values: ValuesContainer): Work<[Source<FileSystem>, Source<GrpInfo>], [Source<EngineDefs>]> {
  const files = new Set<string>();

  function loadWork(grpInfo: GrpInfo, defs: EngineDefs): Work<[], [EngineDefs]> {
    files.clear();
    let fs = stack(defs.root, defs.mainGrp);
    const loadGrp = async (sf: ScriptFile, defs: EngineDefs, fn: string): Promise<void> => {
      await begin()
        .then(`Loading ${fn}`, async () => defs.root.read(fn))
        .then(`Processing ${fn}`, async opt => asyncMapOptional(opt, ab => createGrpOrZipFsArrayBuffer(ab))
          .then(o => o.ifPresent(grp => {
            defs.addGrp = stack(grp, defs.addGrp);
            fs = stack(defs.addGrp, fs);
            files.add(fn);
          })))
        .finish()(sf.taskHandle);
    }
    const glBlendRule = rules<GlBlendDef>(
      simpleRule(['src'], tuple(token), set('src')),
      simpleRule(['dst'], tuple(token), set('dst')));
    const engineDefsRule = rulesInclude(inc => fs.read(inc), files,
      rule(['loadgrp'], tuple(token), loadGrp),
      nestedRule(['palookup'], tuple(number), (_, id) => ({ id }), pushField('plus'), rules<PluDef>(
        nestedRule(['raw'], tuple(), identity(), nil(), rules(
          stringRule('file'),
          numberRule('offset'),
          boolRule('noshades'))),
        simpleRule(['copy'], tuple(number), set('copyof')),
        boolRule('floorpal')
      )),
      nestedRule(['voxel'], tuple(token), (_, file) => ({ file }), pushField('voxels'), rules<VoxelDef>(
        simpleRule(['tile', 'tile0'], tuple(number), set('picnum')))),
      nestedRule(['basepalette'], tuple(number), (_, id) => ({ id }), pushField('pals'), rules<PalDef>(
        nestedRule(['raw'], tuple(), identity(), nil(), rules(
          stringRule('file'),
          numberRule('offset'),
          numberRule('shiftleft')
        )))),
      nestedRule(['tilefromtexture'], tuple(number), (_, picnum) => ({ picnum }), pushField('tiles'), rules<TileFromTexture>(
        stringRule('file', 'name'),
        numberRule('xoff', 'xoffset'),
        numberRule('yoff', 'yoffset'),
        numberRule('alphacut'),
      )),
      simpleRule(['definetexture'], tuple(number, number, number, number, number, number, token), (def, picnum, _1, _2, _3, _4, _5, file) => def.tiles.push({ picnum, file })),
      simpleRule(['animtilerange'], tuple(number, number, number, number), (c, start, end, speed, anim) => c.animTileRanges.push({ start, end, speed, anim })),
      nestedRule(['blendtable'], tuple(number), (_, id) => ({ id }), pushField('blends'), rules<BlendDef>(
        nestedRule(['raw'], tuple(), identity(), nil(), rules(stringRule('file'), numberRule('offset'))),
        nestedRule(['glblend'], tuple(), identity(), nil(), rules(
          nestedRule(['both', 'forward'], tuple(), _ => ({}), set('forward'), glBlendRule),
          nestedRule(['reverse'], tuple(), _ => ({}), set('reverse'), glBlendRule)
        )))));

    return !grpInfo.defname
      ? tupleWork(async () => defs)
      : begin()
        .thenPass('Loading def File', () => fs.read(grpInfo.defname))
        .thenWork(tupleWork((handle, defFile) =>
          defFile
            .map(def => createScripFile(grpInfo.defname, def, handle).parse(cloneDefs(defs), engineDefsRule))
            .orElse(Promise.resolve(defs))))
        .finish();
  }

  let loadHandle = NOOP_TASK_HANDLE;
  async function load([defs, grpInfo]: [EngineDefs, GrpInfo]): Promise<EngineDefs> {
    return first(await loadWork(grpInfo, defs)(loadHandle))
  }

  return begin()
    .multiInput<[Source<FileSystem>, Source<GrpInfo>]>()
    .thenPass('Open Grp', async (fs, grpInfo) => openGrp(values, fs, grpName))
    .thenPass('Loading default defs', async (fs, grpInfo, mainGrp) => loadDefaultEngineDefs(values, fs, mainGrp))
    .thenWork(tupleWork(async (handle, fs, grpInfo, mainGrp, defs) => {
      loadHandle = handle;
      const value = await values.transformedAsyncTuple('engine-defs', [defs, grpInfo], load, nil(), trackFiles(files, ([defs, _]) => defs.root, load));
      loadHandle = NOOP_TASK_HANDLE;
      return value;
    })).finish()
}

