import { HasSymbols, createScripFile, defaultDefine, nestedRule, number, rules, rulesInclude, set, simpleRule, symbols, token, tuple } from "@utils/scriptfile";
import { Aliases, ArtInfoExtended, BoardContext, BuildRor, BuildTror, EMPTY_ALIASES, EMPTY_TAGS, EngineContext, EngineSettings, GlBlend, NamedArtFile, Palette, PicTags, RorLink, VoxelSwap } from "app/apis/engine";
import { FileSystem } from "app/apis/fs";
import { EngineApi } from "build/board/mutations/api";
import { isValidSectorId } from "build/board/query";
import { Board, Sector, Sprite, Wall } from "build/board/structs";
import { AnimationType } from "build/formats/art";
import { VoxelData, readKvx } from "build/formats/kvx";
import { cloneBoard, cloneSector, cloneSprite, cloneWall, loadBuildMap, newBoard, newSector, newSprite, newWall, saveBuildMap } from "build/maploader";
import { slope } from "build/utils";
import { vec3 } from "gl-matrix";
import Optional from "optional-js";
import { match } from "ts-pattern";
import { Source, ValuesContainer, createContainer } from "ts-utils/callbacks";
import { getOrCreate, getOrDefault, range, rect, reverseMap } from "ts-utils/collections";
import { palColorFinder } from "ts-utils/color";
import { LinearInterpolator, vector3 } from "ts-utils/interpolator";
import { iter } from "ts-utils/iter";
import { asyncMapOptional, field } from "ts-utils/objects";
import { NOOP_TASK_HANDLE } from "ts-utils/scheduler";
import { Stream } from "ts-utils/stream";
import { Function, tuple as asTuple, first, identity, nil, second } from "ts-utils/types";
import { Work, begin, tuple as tupleWork } from "ts-utils/work";
import { createBoardModifier } from "../default/board-context-utils";
import { loadArtWork, loadEditorPicAddons, loadMaxPluId, loadPicAddonsWork, openFileOptional } from "../default/engine-commons";
import { DefaultGridController } from "../default/grid";
import { stack, trackFilesSingle } from "../fs/fs";
import { EngineDefs, GrpInfo, loadEngineDefsWork, PalDef, PluDef } from "./defs";
import { SE_TAGS, sectorLotagText } from "./tags";

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
  return values.transformedAsync('aliases', fs, load, nil(), trackFilesSingle(files, load));
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
  return values.transformedAsync('tags', fs, load, nil(), trackFilesSingle(files, load));
}

function defaultEngineSettings(values: ValuesContainer, picnumOffset: Source<number>): Source<EngineSettings> {
  return values.transformed('engine-settings', picnumOffset, off => {
    const trans1 = 0.33;
    const trans2 = 0.66;
    const lotagSectorText = (sector: Sector) => sectorLotagText(sector.lotag);
    const lotagSpriteText = (sprite: Sprite) => sprite.picnum === 1 ? SE_TAGS[sprite.lotag] ?? '' : '';
    const lotagWallText = (wall: Wall) => '';
    return { spriteShadowOff: false, trans1, trans2, lotagWallText, lotagSectorText, lotagSpriteText, pointPicnum: off, fontPicnum: off + 1 };
  })
}

export async function loadGrpInfoFile(fileName: string, file: Optional<ArrayBuffer>): Promise<Optional<GrpInfo>> {
  return asyncMapOptional(file, ab =>
    createScripFile(fileName, ab)
      .parse<GrpInfo>({}, rules(
        nestedRule(['grpinfo'], tuple(), identity(), nil(), rules<GrpInfo>(
          simpleRule(['name'], tuple(token), set('name')),
          simpleRule(['defname'], tuple(token), set('defname')))))));
}


async function loadGrpInfo(values: ValuesContainer, fs: Source<FileSystem>, grpName: string): Promise<Source<GrpInfo>> {
  const fileName = `${grpName}.grpinfo`;
  const file = await openFileOptional(values, fileName, fs);
  return values.transformedAsync('grpinfo', file, o => loadGrpInfoFile(fileName, o)
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
      .groupEntries(field('file'), identity())
      .map(async ([file, d]) => asTuple(d, await fs.read(file)))
      .await_()
      .then(defs => defs
        .filter(([_, o]) => o.isPresent())
        .map(([def, file]) => def.map(def => ({ id: def.id, name: `PAL ${def.id}`, plu: loadPlu(def, file.get()) })))
        .flatten()
        .collect());
    iter(defs.plus)
      .filter(p => p.copyof !== undefined)
      .forEach(p => plus.push({ id: p.id, name: `PAL ${p.id} copy of ${p.copyof}`, plu: iter(plus).first(pp => pp.id === p.copyof).orElse(plus[0]).plu }));
    if (plus.length === 0) return DEFAULT_PLUS;
    const basePlu = iter(plus).first(p => p.id === 0).orElse(plus[0]);
    iter(plus).filter(p => p.plu.length === 256).forEach(p => p.plu = remapPal(basePlu.plu, p.plu));
    return plus;
  });
}

async function loadVoxels(values: ValuesContainer, defs: Source<EngineDefs>, fs: Source<FileSystem>): Promise<Source<VoxelSwap>> {
  const cache = new Map<number, Optional<VoxelData>>();
  return values.transformedAsyncTuple('voxels', [defs, fs], async ([defs, fs]) => {
    cache.clear();
    const files = await iter(defs.voxels)
      .map(async v => asTuple(v, await fs.read(v.file)))
      .await_()
      .then(defs => defs
        .filter(([_, buff]) => buff.isPresent())
        .map(([v, o]) => asTuple(v.picnum, o.get()))
        .toMap(first, second)
      );
    return picnum => getOrCreate(cache, picnum, _ => Optional.ofNullable(files.get(picnum)).map(buff => readKvx(new Stream(buff))));
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

async function generateFogPals(values: ValuesContainer, pal: Source<Uint8Array>, plus: Source<Palette[]>): Promise<Source<Palette[]>> {
  const findDefaultFogpalsOff = (plus: Palette[]): number => {
    const idMap = iter(plus).toMap(p => p.id, identity());
    for (let i = 0; i < 256 - 3; i++) {
      if (idMap.get(i) === undefined
        && idMap.get(i + 1) === undefined
        && idMap.get(i + 2) === undefined
        && idMap.get(i + 3) === undefined)
        return i;
    }
    return -1;
  }

  function createFogPal(basePal: Uint8Array, basePlu: Uint8Array, r: number, g: number, b: number): Uint8Array {
    const fogColor: [number, number, number] = [r, g, b];
    const pal = new Uint8Array(256 * 32);
    const finder = palColorFinder(basePal);
    const inter = vector3(LinearInterpolator)
    for (let shade = 0; shade < 32; shade++) {
      const t = shade / 31;
      for (let c = 0; c < 256; c++) {
        const colorId = basePlu[c];
        const r_ = basePal[colorId * 3];
        const g_ = basePal[colorId * 3 + 1];
        const b_ = basePal[colorId * 3 + 2];
        const [ir, ig, ib] = inter([r_, g_, b_], fogColor, t);
        pal[shade * 256 + c] = finder(ir, ig, ib);
      }
    }
    return pal;
  }

  return values.transformedTuple('plus with fog', [pal, plus], ([pal, plus]) => {
    const fogOff = findDefaultFogpalsOff(plus);
    if (fogOff < 0) return plus;
    const basePlu = iter(plus).first(p => p.id === 0).orElse(plus[0]).plu;
    return [...plus,
    { id: fogOff, name: `White Fog Pal`, plu: createFogPal(pal, basePlu, 60, 60, 60) },
    { id: fogOff + 1, name: `Red Fog Pal`, plu: createFogPal(pal, basePlu, 60, 0, 0) },
    { id: fogOff + 2, name: `Green Fog Pal`, plu: createFogPal(pal, basePlu, 0, 60, 0) },
    { id: fogOff + 3, name: `Blue Fog Pal`, plu: createFogPal(pal, basePlu, 0, 0, 60) }];
  });
}

function loadArtMap(values: ValuesContainer, defs: Source<EngineDefs>, arts: Source<NamedArtFile[]>, fs: Source<FileSystem>, pal: Source<Uint8Array>): Work<[], [Source<Map<number, ArtInfoExtended>>]> {
  return tupleWork(async handle => {
    let loadHandle = NOOP_TASK_HANDLE;
    const load = async ([artFiles, defs, fs, pal]: [NamedArtFile[], EngineDefs, FileSystem, Uint8Array]): Promise<Map<number, ArtInfoExtended>> => {
      const map = iter(artFiles)
        .map(file => iter(file.art.arts)
          .enumerate()
          .map(([info, i]) => asTuple(file.art.header.start + i, { ...info, artFile: file.name })))
        .flatten()
        .toMap(first, second);

      iter(defs.tiles)
        .zip(first(await loadPicAddonsWork(fs, pal, defs.tiles)(loadHandle)))
        .filter(([t, i]) => i.h !== 0 && i.w !== 0)
        .forEach(([t, i]) => map.set(t.picnum, i))

      iter(defs.animTileRanges)
        .forEach(({ start, end, speed, anim }) => {
          const picnum = anim === AnimationType.ANIMATE_BACKWARD ? end : start;
          const frames = Math.abs(start - end);
          const info = map.get(picnum);
          if (info === undefined) return;
          info.attrs.frames = frames;
          info.attrs.speed = speed;
          info.attrs.animType = anim;
        });

      return map;
    }

    loadHandle = handle;
    const value = await values.transformedAsyncTuple('artMap', [arts, defs, fs, pal], load);
    loadHandle = NOOP_TASK_HANDLE;
    return value;
  })
}

function loadBlends(values: ValuesContainer, defs: Source<EngineDefs>): Source<Function<number, GlBlend>> {
  return values.transformed('bleands', defs, defs => {
    const map = iter(defs.blends)
      .filter(b => b.forward !== undefined)
      .toMap<number, GlBlend>(b => b.id, b => ({ src: WebGL2RenderingContext[b.forward.src], dst: WebGL2RenderingContext[b.forward.dst] }));
    const def: GlBlend = { src: WebGL2RenderingContext.SRC_ALPHA, dst: WebGL2RenderingContext.ONE_MINUS_SRC_ALPHA };
    return blendId => getOrDefault(map, blendId, def);
  });
}

function getTror(board: Board): BuildTror {
  const sectorByCeilingBunch = iter(board.sectors)
    .enumerate()
    .filter(([s, _]) => s.ceilingstat.tror === 1)
    .group(([sec, _]) => sec.ceilingxpanning, ([_, s]) => s);
  const sectorByFloorBunch = iter(board.sectors)
    .enumerate()
    .filter(([s, _]) => s.floorstat.tror === 1)
    .group(([sec, _]) => sec.floorxpanning, ([_, s]) => s);
  const ceiling = (sectorId: number): number[] => {
    if (!isValidSectorId(board, sectorId)) return [];
    const sec = board.sectors[sectorId];
    if (sec.ceilingstat.tror !== 1) return [];
    return getOrDefault(sectorByFloorBunch, sec.ceilingxpanning, []);
  }
  const floor = (sectorId: number): number[] => {
    if (!isValidSectorId(board, sectorId)) return [];
    const sec = board.sectors[sectorId];
    if (sec.floorstat.tror !== 1) return [];
    return getOrDefault(sectorByCeilingBunch, sec.floorxpanning, []);
  }
  return { ceiling, floor }
}

function getRor(board: Board): BuildRor {
  const TRANSPORT_TAG = 7;
  const WATER_TAG = 1;
  const UNDERWATER_TAG = 2;
  const transportsByHitag = iter(board.sprites)
    .enumerate()
    .map(([spr, s]) => asTuple(spr, s, board.sectors[spr.sectnum]))
    .filter(([spr, s, sec]) => spr.lotag === TRANSPORT_TAG && (sec.lotag === WATER_TAG || sec.lotag === UNDERWATER_TAG))
    .group(([spr, s, sec]) => spr.hitag, identity());
  const floorLinks = new Map<number, RorLink>();
  const ceilingLinks = new Map<number, RorLink>();
  for (const links of transportsByHitag.values()) {
    if (links.length !== 2) continue;
    let [spr1, s1, sec1] = links[0];
    let [spr2, s2, sec2] = links[1];
    if (sec1.lotag === WATER_TAG) [spr1, spr2, s1, s2, sec1, sec2] = [spr2, spr1, s2, s1, sec2, sec1];
    board.sectors[spr1.sectnum].ceilingstat.type = 2;
    board.sectors[spr2.sectnum].floorstat.type = 2;
    const spr1z = slope(board, spr1.sectnum, spr1.x, spr1.y, true);
    const spr2z = slope(board, spr2.sectnum, spr2.x, spr2.y, false);
    const srcSpritePos = vec3.fromValues(spr1.x, spr1.y, spr1z);
    const dstSpritePos = vec3.fromValues(spr2.x, spr2.y, spr2z);
    const buildDiff = vec3.sub(vec3.create(), srcSpritePos, dstSpritePos);
    ceilingLinks.set(spr1.sectnum, { buildDiff, dstSector: spr2.sectnum, transparent: true });
    floorLinks.set(spr2.sectnum, { buildDiff: vec3.negate(vec3.create(), buildDiff), dstSector: spr1.sectnum, transparent: true });
  }
  const floorLink = (sectorId: number) => floorLinks.get(sectorId);
  const ceilLink = (sectorId: number) => ceilingLinks.get(sectorId);
  const hasRor = (sectorId: number) => floorLinks.has(sectorId) || ceilingLinks.has(sectorId);
  return { rorLinks: { floorLink, ceilLink, hasRor }, isMirrorPic: _ => false } as BuildRor;
}

function packOffs(offs: number[]): number {
  return iter(offs).enumerate().map(([o, i]) => (o & 0x7) << (i * 3)).reduce((a, b) => a | b, 0);
}

function defaultParallaxPicnums(picnum: number): number {
  return match(picnum)
    .with(80, () => packOffs([1, 0, 0, 2, 3, 0, 2]))
    .with(84, () => packOffs([1, 2, 3, 0, 0, 4, 0]))
    .with(89, () => packOffs([2, 3, 1, 2, 1, 2, 4]))
    .otherwise(() => 0);
}

function createloadBoard(values: ValuesContainer): Function<Stream, Promise<BoardContext>> {
  let boardId = 1;
  return async (stream: Stream, name?: string): Promise<BoardContext> => {
    const boardValues = values.createChild(`board-${boardId++}`);
    const board = boardValues.value('board', loadBuildMap(stream));
    const ror = getRor(board.get());
    const tror = getTror(board.get());
    const spritesBySectorMap = iter(board.get().sprites).map(field('sectnum')).enumerate().group(first, second);
    const spritesBySector = (sectorId: number) => getOrDefault(spritesBySectorMap, sectorId, []);
    const grid = DefaultGridController(values);
    const save = async () => saveBuildMap(board.get())
    const dispose = async () => boardValues.dispose();

    return { name, board, ror, tror, parallaxPicnums: 8, spritesBySector, ...createBoardModifier<Board>(board), save, grid, dispose };
  }
}

export type Eduke32ModsType = {
  grpName: string,
}

export const createEngineContextEduke32 = begin()
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
      .thenWorkPass(async (handler, grpInfo, defs, resources, [pal, trans, plus, spriteVoxelSwap, art, aliases, picTags]) => loadArtMap(values, defs, art, resources, pal)(handler))
      .thenWorkPass(async (handler, grpInfo, defs, resources, [pal, trans, plus, spriteVoxelSwap, art, aliases, picTags], artMap) => loadEditorPicAddons(values, artMap, resources, pal)(handle))
      .thenPass('Creating default Fog pals', (grpInfo, defs, resources, [pal, trans, plus, spriteVoxelSwap, art, aliases, picTags], artMap, addonArtMap) => generateFogPals(values, pal, plus))
      .then<EngineContext>('', async (grpInfo, defs, resources, [pal, trans, plus, spriteVoxelSwap, art, aliases, picTags], artMap, addonArtMap, plusWithFog) => {
        return {
          name: values.field('name', grpInfo, 'name'),
          resources,
          api: engineApi(),
          settings: defaultEngineSettings(values, addonArtMap.offset),
          pal,
          trans,
          picTags,
          plus: plusWithFog,
          maxPluId: loadMaxPluId(values, plusWithFog),
          art,
          artMap: addonArtMap.map,
          shadowsteps: values.const('shadowsteps', 32),
          aliases,
          spriteVoxelSwap,
          blends: loadBlends(values, defs),
          parallaxInfo: defaultParallaxPicnums,
          loadBoard: createloadBoard(values),
          dispose: () => values.dispose()
        }
      }).finish()(handle)
    )).finish();