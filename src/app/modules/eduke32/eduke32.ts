import { Source, ValuesContainer, createContainer } from "@utils/callbacks";
import { getOrCreate, getOrDefault, range, rect, repeat, reverseMap } from "@utils/collections";
import { iter } from "@utils/iter";
import { asyncMapOptional, field } from "@utils/objects";
import { HasSymbols, ScriptFile, boolRule, createScripFile, defaultDefine, nestedRule, number, numberRule, pushField, rule, rules, rulesInclude, set, simpleRule, stringRule, symbols, token, tuple } from "@utils/scriptfile";
import { Stream } from "@utils/stream";
import { first, identity, nil, pair, second } from "@utils/types";
import { BoardUtils } from "app/apis/app";
import { NOOP_TASK_HANDLE } from "app/apis/app1";
import { Aliases, BoardContext, BuildRor, EMPTY_ALIASES, EMPTY_ROR_LINKS, EMPTY_TAGS, EngineContext, EngineSettings, Palette, PicTags, VoxelSwap } from "app/apis/engine";
import { FileSystem } from "app/apis/fs";
import { EngineApi } from "build/board/mutations/api";
import { Board } from "build/board/structs";
import { VoxelData, readKvx } from "build/formats/kvx";
import { cloneBoard, cloneSector, cloneSprite, cloneWall, loadBuildMap, newBoard, newSector, newSprite, newWall } from "build/maploader";
import Optional from "optional-js";
import { match } from "ts-pattern";
import { loadArtMap, loadArtWork, openFile, openFileOptional } from "../default/engine-commons";
import { EMPTY, createGrpOrZipFsArrayBuffeer as createGrpOrZipFsArrayBuffer, stack, trackFiles, trackFilesSingle } from "../fs/fs";
import { Work, begin, tuple as tupleWork } from "../scheduler/work";

function engineApi(): EngineApi<Board> {
  return { cloneBoard, cloneWall, cloneSprite, cloneSector, newWall, newSector, newSprite, newBoard };
}

async function loadAliases(values: ValuesContainer, fs: Source<FileSystem>, fn: string): Promise<Source<Aliases>> {
  const files = new Set<string>();
  const load = async (fs: FileSystem): Promise<Aliases> => {
    files.clear();
    files.add(fn);
    const file = await fs.read(fn);
    return asyncMapOptional<ArrayBuffer, Aliases>(file, async file => {
      const names = await createScripFile(fn, file)
        .parse({ symbols: new Map() },
          rulesInclude<HasSymbols>(
            inc => fs.read(inc), files,
            defaultDefine()));
      const map = reverseMap(names.symbols);
      return { get: picnum => getOrDefault(map, picnum, ''), all: () => map }
    }).then(a => a.orElse(EMPTY_ALIASES))
  }
  return values.transformedAsync('aliases', fs, load, trackFilesSingle(files, load));
}

async function loadTags(values: ValuesContainer, fs: Source<FileSystem>, fn: string): Promise<Source<PicTags>> {
  type Tilegroup = { name: string, tiles: Set<number> };
  type Context = { groups: Tilegroup[] } & HasSymbols;
  const files = new Set<string>();
  const load = async (fs: FileSystem): Promise<PicTags> => {
    files.clear();
    files.add(fn);
    const fileParser = rulesInclude<Context>(
      inc => fs.read(inc), files,
      nestedRule(['tilegroup'], tuple(token),
        ({ symbols }, name) => ({ symbols, name, tiles: new Set<number>() }),
        (ctx, { name, tiles }) => ctx.groups.push({ name, tiles }), rules(
          simpleRule(['tiles'], symbols(), (tg, tokens) => iter(tokens).forEach(t => tg.tiles.add(t))),
          simpleRule(['tilerange'], tuple(number, number), (tg, start, end) => iter(range(start, end + 1)).forEach(i => tg.tiles.add(i)))
        )),
      defaultDefine());
    return asyncMapOptional<ArrayBuffer, PicTags>(await fs.read(fn), async tags => {
      const picTags = await createScripFile(fn, tags).parse({ groups: [], symbols: new Map() }, fileParser).then(field('groups'));
      return { allTags: () => picTags.map(p => p.name), tags: picnum => iter(picTags).filter(p => p.tiles.has(picnum)).map(p => p.name).collect() };
    }).then(o => o.orElse(EMPTY_TAGS))
  }
  return values.transformedAsync('tags', fs, load, trackFilesSingle(files, load));
}

function defaultEngineSettings(): EngineSettings<Board> {
  const spriteShadowOff = (board: Board, spriteId: number) => 0;
  const trans1 = 0.33;
  const trans2 = 0.66;
  return { spriteShadowOff, trans1, trans2 };
}

function defaultParallaxPicnums(picnum: number): number[] {
  return match(picnum)
    .with(80, () => [80, 81, 80, 80, 82, 83, 80, 82])
    .with(84, () => [84, 85, 86, 87, 84, 84, 88, 84])
    .with(89, () => [89, 91, 92, 90, 91, 90, 92, 93])
    .otherwise(() => [...repeat(picnum, 8)]);
}

type FileDef = { file: string, offset?: number };
type VoxelDef = { picnum: number } & FileDef;
type PalDef = { id: number, shiftleft?: number } & FileDef;
type PluDef = { id: number, noshades?: boolean } & FileDef;
type GlBlend = { src: string, dst: string };
type BlendDef = { id: number, forward?: GlBlend, reverse?: GlBlend } & FileDef;
type EngineDefs = {
  root: FileSystem
  mainGrp: FileSystem,
  addGrp: FileSystem,
  pals: PalDef[],
  blends: BlendDef[],
  plus: PluDef[],
  voxels: VoxelDef[],
}

function cloneDefs(defs: EngineDefs): EngineDefs {
  return {
    root: defs.root,
    mainGrp: defs.mainGrp,
    addGrp: defs.addGrp,
    blends: [...defs.blends],
    pals: [...defs.pals],
    plus: [...defs.plus],
    voxels: [...defs.voxels]
  }
}

async function loadDefaultEngineDefs(values: ValuesContainer, root: Source<FileSystem>, mainGrp: Source<FileSystem>): Promise<Source<EngineDefs>> {
  const load = async ([root, mainGrp]: [FileSystem, FileSystem]): Promise<EngineDefs> => {
    const fs = stack(root, mainGrp);
    const voxels: VoxelDef[] = [];
    const plus: PluDef[] = [];
    const pals: PalDef[] = [];
    const blends: BlendDef[] = [];
    const addGrp = EMPTY;
    await fs.read('palette.dat').then(o => o.ifPresent(ab => {
      pals.push({ id: 0, file: 'palette.dat', shiftleft: 2 });
      plus.push({ id: 0, file: 'palette.dat', offset: 0x300 + 2 })
      blends.push({ id: 0, file: 'palette.dat', offset: 0x300 + 2 + 32 * 0x100 });
    }));
    await fs.read('lookup.dat').then(o => o.ifPresent(ab => {
      const stream = new Stream(ab);
      const size = stream.readUByte();
      for (let i = 1; i < size; i++) {
        const id = stream.readUByte();
        plus.push({ id, file: 'lookup.dat', offset: stream.mark(), noshades: true });
        stream.skip(0x100);
      }
    }));
    return { root, mainGrp, addGrp, plus, voxels, pals, blends }
  }
  const files = ['palette.dat', 'lookup.dat'];
  return values.transformedAsyncTuple('default-engine-defs', [root, mainGrp], load, nil(), trackFiles(files, first, load))
}

async function openGrp(values: ValuesContainer, fs: Source<FileSystem>, grpName: String): Promise<Source<FileSystem>> {
  const fn = `${grpName}.grp`;
  const file = await openFile(values, fn, fs);
  return values.transformedAsync(fn, file, async ab => createGrpOrZipFsArrayBuffer(ab));
}

function loadEngineDefsWork(grpName: String, values: ValuesContainer): Work<[Source<FileSystem>, Source<GrpInfo>], [Source<EngineDefs>]> {
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
    const glBlendRule = rules<GlBlend>(
      simpleRule(['src'], tuple(token), set('src')),
      simpleRule(['dst'], tuple(token), set('dst')));
    const engineDefsRule = rulesInclude(inc => fs.read(inc), files,
      rule(['loadgrp'], tuple(token), loadGrp),
      nestedRule(['palookup'], tuple(number), (_, id) => ({ id }), pushField('plus'), rules<PluDef>(
        nestedRule(['raw'], tuple(), identity(), nil(), rules(
          stringRule('file'),
          numberRule('offset'),
          boolRule('noshades')
        )))),
      nestedRule(['voxel'], tuple(token), (_, file) => ({ file }), pushField('voxels'), rules<VoxelDef>(
        simpleRule(['tile', 'tile0'], tuple(number), set('picnum')))),
      nestedRule(['basepalette'], tuple(number), (_, id) => ({ id }), pushField('pals'), rules<PalDef>(
        nestedRule(['raw'], tuple(), identity(), nil(), rules(
          stringRule('file'),
          numberRule('offset'),
          numberRule('shiftleft')
        )))),
      nestedRule(['blendtable'], tuple(number), (_, id) => ({ id }), pushField('blends'), rules<BlendDef>(
        nestedRule(['raw'], tuple(), identity(), nil(), rules(
          stringRule('file'),
          numberRule('offset')
        )),
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

  async function load([defs, grpInfo]: [EngineDefs, GrpInfo]): Promise<EngineDefs> {
    return first(await loadWork(grpInfo, defs)(NOOP_TASK_HANDLE))
  }

  return begin()
    .multiInput<[Source<FileSystem>, Source<GrpInfo>]>()
    .thenPass('Open Grp', async (fs, grpInfo) => openGrp(values, fs, grpName))
    .thenPass('Loading default defs', async (fs, grpInfo, mainGrp) => loadDefaultEngineDefs(values, fs, mainGrp))
    .thenWorkPass(async (handle, fs, grpInfo, mainGrp, defs) => loadWork(grpInfo.get(), defs.get())(handle))
    .then('Creating transformer', async (fs, grpInfo, mainGrp, defDefs, init) =>
      values.transformedAsyncTupleImmediate('engine-defs', [defDefs, grpInfo], load, init, nil(), trackFiles(files, ([defs, _]) => defs.root, load)))
    .finish()
}

export type GrpInfo = { name?: string, defname?: string }
export async function loadGrpInfo1(fs: FileSystem, grpName: string): Promise<Optional<GrpInfo>> {
  const fileName = `${grpName}.grpinfo`;
  const o = await fs.read(fileName);
  return asyncMapOptional(o, ab =>
    createScripFile(fileName, ab)
      .parse<GrpInfo>({}, rules(
        nestedRule(['grpinfo'], tuple(), identity(), nil(), rules<GrpInfo>(
          simpleRule(['name'], tuple(token), set('name')),
          simpleRule(['defname'], tuple(token), set('defname')))))));
}


async function loadGrpInfo(values: ValuesContainer, fs: Source<FileSystem>, grpName: string): Promise<Source<GrpInfo>> {
  const fileName = `${grpName}.grpinfo`;
  const file = await openFileOptional(values, fileName, fs);
  return values.transformedAsync('grpinfo', file, o =>
    asyncMapOptional(o, ab =>
      createScripFile(fileName, ab).parse<GrpInfo>({}, rules(
        nestedRule(['grpinfo'], tuple(), identity(), nil(), rules<GrpInfo>(
          simpleRule(['name'], tuple(token), set('name')),
          simpleRule(['defname'], tuple(token), set('defname')))))))
      .then(o => o.orElse({ name: "Duke Nukem 3D", defname: `${grpName}.def` })))
}

function remapPal(basePlu: Uint8Array, remap: Uint8Array): Uint8Array {
  const result = new Uint8Array(256 * 32);
  for (let shade = 0; shade < 32; shade++) {
    for (let c = 0; c < 256; c++) {
      result[shade * 256 + c] = basePlu[shade * 256 + remap[c]]
    }
  }
  return result;
}
const DEFAULT_PLU: Palette = { id: 0, name: '', plu: new Uint8Array(256) };
const DEFAULT_PLUS: Palette[] = [DEFAULT_PLU]
async function loadPlus(values: ValuesContainer, defs: Source<EngineDefs>, fs: Source<FileSystem>): Promise<Source<Palette[]>> {
  const loadPlu = (def: PluDef, ab: ArrayBuffer): Uint8Array => {
    const size = (def.noshades || false) ? 256 : 256 * 32;
    return new Uint8Array(ab, def.offset || 0, Math.min(size, ab.byteLength));
  }
  return values.transformedAsyncTuple('plus', [defs, fs], async ([defs, fs]) => {
    const plus = await iter(defs.plus)
      .filter(d => d.file !== undefined)
      .map(async d => pair(d, await fs.read(d.file)))
      .await_()
      .then(defs => defs
        .filter(([_, o]) => o.isPresent())
        .map(([def, file]) => ({ id: def.id, name: `PAL ${def.id}`, plu: loadPlu(def, file.get()) }))
        .collect());
    if (plus.length === 0) return DEFAULT_PLUS;
    const basePlu = iter(plus).first(p => p.id === 0).orElse(plus[0]);
    iter(plus).filter(p => p.plu.length === 256).forEach(p => p.plu = remapPal(basePlu.plu, p.plu));
    return plus;
  });
}

async function loadVoxels(values: ValuesContainer, defs: Source<EngineDefs>, fs: Source<FileSystem>): Promise<Source<VoxelSwap<Board>>> {
  const cache = new Map<number, Optional<VoxelData>>();
  return values.transformedAsyncTuple('voxels', [defs, fs], async ([defs, fs]) => {
    cache.clear();
    const files = await iter(defs.voxels)
      .map(async v => pair(v, await fs.read(v.file)))
      .await_()
      .then(defs => defs
        .filter(([_, buff]) => buff.isPresent())
        .map(([v, o]) => pair(v.picnum, o.get()))
        .toMap(first, second)
      );
    return (board, spriteId) => {
      const picnum = board.sprites[spriteId].picnum;
      return getOrCreate(cache, picnum, _ => Optional.ofNullable(files.get(picnum)).map(buff => readKvx(new Stream(buff))));
    }
  });
}

const DEFAULT_PAL = new Uint8Array(iter(range(0, 256)).map(i => [i, i, i]).flatten().collect());
async function loadPal(values: ValuesContainer, defs: Source<EngineDefs>, fs: Source<FileSystem>): Promise<Source<Uint8Array>> {
  const loadPal = (def: PalDef, ab: ArrayBuffer): Uint8Array => {
    const pal = new Uint8Array(ab, def.offset ?? 0, 256 * 3);
    const shl = def.shiftleft ?? 0;
    return shl > 0 ? pal.map(x => x << shl) : pal;
  }
  return values.transformedAsyncTuple('pal', [defs, fs], async ([defs, fs]) => {
    const palDef = getOrDefault(iter(defs.pals).toMap(field('id'), identity()), 0, { id: 0, file: 'palette.dat' });
    const file = await fs.read(palDef.file);
    return file.map(buff => loadPal(palDef, buff)).orElse(DEFAULT_PAL);
  });
}

const DEFAULT_TRANS = new Uint8Array(iter(rect(256, 256)).map(first).collect())
async function loadTrans(values: ValuesContainer, defs: Source<EngineDefs>, fs: Source<FileSystem>): Promise<Source<Uint8Array>> {
  return values.transformedAsyncTuple('trans', [defs, fs], async ([defs, fs]) => {
    const blendDef = getOrDefault(iter(defs.blends).toMap(field('id'), identity()), 0, { id: 0, file: 'palette.dat', offset: 0x300 + 32 * 0x100 });
    const file = await fs.read(blendDef.file);
    return file.map(buff => new Uint8Array(buff, blendDef.offset ?? 0, 256 * 256)).orElse(DEFAULT_TRANS);
  });
}

async function loadBoard(stream: Stream): Promise<BoardContext> {
  const board = loadBuildMap(stream);
  const ror = { rorLinks: EMPTY_ROR_LINKS, isMirrorPic: _ => false } as BuildRor;
  const spritesBySector = iter(board.sprites).map(field('sectnum')).enumerate().group(first, second);
  const utils = { spritesBySector: (sectorId) => spritesBySector.get(sectorId) } as BoardUtils;
  const parallaxPicnums = defaultParallaxPicnums;
  return { board, ror, utils, parallaxPicnums };
}

export type Eduke32ModsType = {
  grpName: string,
}

export function createEngineContextEduke32(): Work<[Source<FileSystem>, Eduke32ModsType], [EngineContext]> {
  return begin()
    .multiInput<[Source<FileSystem>, Eduke32ModsType]>()
    .thenWork((handle, fs, { grpName }) =>
      createContainer('eduke32-module').initializeAsync(values => begin()
        .thenPass('Loading GrpInfo', () => loadGrpInfo(values, fs, grpName))
        .thenWorkPass((handle, grpInfo) => loadEngineDefsWork(grpName, values)(handle, fs, grpInfo))
        .thenPass('Loading Resources', async (_, defs) => values.transformed('resources', defs, defs => stack(defs.root, stack(defs.addGrp, defs.mainGrp))))
        .forkPass(p => p
          .thread('Loading Pal', (_, defs, res) => loadPal(values, defs, res))
          .thread('Loading Trans', (_, defs, res) => loadTrans(values, defs, res))
          .thread('Loading PLUs', (_, defs, res) => loadPlus(values, defs, res))
          .thread('Loading voxels', (_, defs, res) => loadVoxels(values, defs, res))
          .threadWork((handle, _, defs, res) => loadArtWork(handle, values, res))
          .thread('Loading aliases', (_, defs, res) => loadAliases(values, res, 'NAMES.H'))
          .thread('Loading tags', (_, defs, res) => loadTags(values, res, 'tiles.cfg')))
        .then<EngineContext>('', async (grpInfo, defs, resources, [pal, trans, plus, spriteVoxelSwap, art, aliases, picTags]) => {
          const api = engineApi();
          const name = values.field('name', grpInfo, 'name');
          const settings = defaultEngineSettings();
          const artMap = loadArtMap(values, art);
          const shadowsteps = values.const('shadowsteps', 32);
          const dispose = () => values.dispose();
          return { name, resources, api, settings, pal, trans, picTags, plus, art, artMap, shadowsteps, aliases, spriteVoxelSwap, loadBoard, dispose }
        }).finish()(handle)
      )).finish()
}