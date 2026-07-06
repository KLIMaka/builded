import { FileSystem } from "app/apis/fs";
import { Source, ValuesContainer } from "ts-utils/callbacks";
import { asyncMapOptional } from "ts-utils/objects";
import { Stream } from "ts-utils/stream";
import { first, identity, nil, typeToken } from "ts-utils/types";
import { DefFile, boolRule, createDefFile, nestedRule, number, numberRule, pushField, rule, rules, rulesInclude, set, simpleRule, stringRule, token, tuple } from "utils/deffile";
import { openFileOptional } from "../default/engine-commons";
import { EMPTY, createGrpOrZipFsArrayBuffer, stack, trackFiles } from "../fs/fs";
import { taskHandleContext } from "../scheduler/utils";
import { cookbook, cookbookInput } from "ts-utils/cookbook";
import { Task } from "ts-utils/scheduler";

export type FileDef = Partial<{ file: string, offset: number }>;
export type VoxelDef = Partial<{ picnum: number }> & FileDef;
export type PalDef = { id: number, shiftleft?: number } & FileDef;
export type PluDef = { id: number, noshades?: boolean, floorpal?: boolean, copyof?: number } & FileDef;
export type GlBlendDef = Partial<{ src: string, dst: string }>;
export type BlendDef = { id: number, forward?: GlBlendDef, reverse?: GlBlendDef } & FileDef;
export type TileFromTexture = Partial<{ picnum: number, file: string, alphacut: number, xoff: number, yoff: number }>;
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
export type GrpInfo = { name?: string, defname?: string, scriptname?: string }

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
    const animTileRanges: AnimTileRange[] = [];
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
  const file = await openFileOptional(values, fn, fs);
  return values.transformedAsync(fn, file, o => o.map(ab => createGrpOrZipFsArrayBuffer(fn, ab)).orElse(Promise.resolve(EMPTY)));
}

const glBlendRule = rules<GlBlendDef>(
  simpleRule(['src'], tuple(token), set('src')),
  simpleRule(['dst'], tuple(token), set('dst')));

export function loadEngineDefsWork(grpName: string, values: ValuesContainer): Task<Source<EngineDefs>, [Source<FileSystem>, Source<string>]> {
  const files = new Set<string>();

  function loadTask(defname: string, defs: EngineDefs): Task<EngineDefs> {
    files.clear();
    let fs = stack(defs.root, defs.mainGrp);
    const loadGrp = async (sf: DefFile, defs: EngineDefs, fn: string): Promise<void> => {
      const file = await defs.root.read(fn);
      await asyncMapOptional(file, ab => createGrpOrZipFsArrayBuffer(fn, ab))
        .then(o => o.ifPresent(grp => {
          defs.addGrp = stack(grp, defs.addGrp);
          fs = stack(defs.addGrp, fs);
          files.add(fn);
        }));
    }
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

    return cookbook(book => {
      const defFile = book.recepie('Loading def File', [], () => fs.read(defname));
      return book.recepie('Parsing def file', [defFile], async defFile => defFile
        .map(def => createDefFile(defname, def).parse(cloneDefs(defs), engineDefsRule))
        .orElse(Promise.resolve(defs)))
    })
  }

  return taskHandleContext(handle => {
    const load = ([defs, defname]: [EngineDefs, string]) => loadTask(defname, defs)(handle());
    return (fs, defname) => cookbookInput(typeToken<[Source<FileSystem>, Source<string>]>(), (book, input) => {
      const grp = book.recepie('Open Grp', [input], ([fs]) => openGrp(values, fs, grpName));
      const defaultDefs = book.recepie('Loading default defs', [input, grp], async ([fs], mainGrp) => loadDefaultEngineDefs(values, fs, mainGrp));
      return book.recepie('', [input, defaultDefs], ([_, defname], defs) =>
        values.transformedAsyncTuple('engine-defs', [defs, defname], load, nil(), trackFiles(files, ([defs, _]) => defs.root, load)));
    })(handle(), fs, defname);
  })
}

