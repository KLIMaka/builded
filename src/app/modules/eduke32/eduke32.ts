import { Source, ValuesContainer, createContainer } from "@utils/callbacks";
import { getOrCreate, getOrDefault, range, rect, reverseMap } from "@utils/collections";
import { palColorFinder } from "@utils/color";
import { loadImageFromBuffer } from "@utils/imgutils";
import { LinearInterpolator, vector3 } from "@utils/interpolator";
import { iter } from "@utils/iter";
import { LazyValue, asyncMapOptional, field } from "@utils/objects";
import { HasSymbols, ScriptFile, boolRule, createScripFile, defaultDefine, nestedRule, number, numberRule, pushField, rule, rules, rulesInclude, set, simpleRule, stringRule, symbols, token, tuple } from "@utils/scriptfile";
import { Stream } from "@utils/stream";
import { Function, first, identity, nil, pair, second } from "@utils/types";
import { BoardUtils } from "app/apis/app";
import { NOOP_TASK_HANDLE } from "app/apis/app1";
import { Aliases, ArtInfoExtended, BoardContext, BuildRor, BuildTror, EMPTY_ALIASES, EMPTY_ROR_LINKS, EMPTY_TAGS, EngineContext, EngineSettings, GlBlend, NamedArtFile, Palette, PicTags, RorLink, VoxelSwap } from "app/apis/engine";
import { FileSystem } from "app/apis/fs";
import { EngineApi } from "build/board/mutations/api";
import { Board, Sector, Sprite } from "build/board/structs";
import { AnimationType, Attributes } from "build/formats/art";
import { VoxelData, readKvx } from "build/formats/kvx";
import { cloneBoard, cloneSector, cloneSprite, cloneWall, loadBuildMap, newBoard, newSector, newSprite, newWall } from "build/maploader";
import Optional from "optional-js";
import { match } from "ts-pattern";
import { loadArtWork, loadMaxPluId, openFile, openFileOptional } from "../default/engine-commons";
import { EMPTY, createGrpOrZipFsArrayBuffeer as createGrpOrZipFsArrayBuffer, stack, trackFiles, trackFilesSingle } from "../fs/fs";
import { Work, begin, tuple as tupleWork } from "../scheduler/work";
import { slope } from "build/utils";
import { vec3 } from "gl-matrix";

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

function defaultEngineSettings(): EngineSettings {
  const trans1 = 0.33;
  const trans2 = 0.66;
  return { spriteShadowOff: false, trans1, trans2 };
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

type FileDef = { file: string, offset?: number };
type VoxelDef = { picnum: number } & FileDef;
type PalDef = { id: number, shiftleft?: number } & FileDef;
type PluDef = { id: number, noshades?: boolean, floorpal?: boolean, copyof?: number } & FileDef;
type GlBlendDef = { src: string, dst: string };
type BlendDef = { id: number, forward?: GlBlendDef, reverse?: GlBlendDef } & FileDef;
type TileFromTexture = { picnum: number, file: string, alphacut?: number, xoff?: number, yoff?: number };
type AnimTileRange = { start: number, end: number, speed: number, anim?: number };
type EngineDefs = {
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

function cloneDefs(defs: EngineDefs): EngineDefs {
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

async function loadDefaultEngineDefs(values: ValuesContainer, root: Source<FileSystem>, mainGrp: Source<FileSystem>): Promise<Source<EngineDefs>> {
  const load = async ([root, mainGrp]: [FileSystem, FileSystem]): Promise<EngineDefs> => {
    const fs = stack(root, mainGrp);
    const voxels: VoxelDef[] = [];
    const plus: PluDef[] = [];
    const pals: PalDef[] = [];
    const blends: BlendDef[] = [];
    const addGrp = EMPTY;
    const tiles = [];
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
    .then('Creating transformer', async (fs, grpInfo, mainGrp, defs, init) =>
      values.transformedAsyncTupleImmediate('engine-defs', [defs, grpInfo], load, init, nil(), trackFiles(files, ([defs, _]) => defs.root, load)))
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
      .groupEntries(field('file'), identity())
      .map(async ([file, d]) => pair(d, await fs.read(file)))
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
      .map(async v => pair(v, await fs.read(v.file)))
      .await_()
      .then(defs => defs
        .filter(([_, buff]) => buff.isPresent())
        .map(([v, o]) => pair(v.picnum, o.get()))
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

async function loadArtMap(values: ValuesContainer, defs: Source<EngineDefs>, arts: Source<NamedArtFile[]>, fs: Source<FileSystem>, pal: Source<Uint8Array>) {
  return values.transformedAsyncTuple('artMap', [arts, defs, fs, pal], async ([artFiles, defs, fs, pal]) => {
    const toArtImg = new LazyValue(() => {
      const finder = palColorFinder(pal);
      return (w: number, h: number, img: Uint8Array, alphacut: number) => {
        const dst = new Uint8Array(w * h);
        for (const [xc, yc] of rect(w, h)) {
          const idx = yc * w + xc;
          if ((img[idx * 4 + 3] / 255) <= alphacut) {
            dst[xc * h + yc] = 255;
          } else {
            const r_ = img[idx * 4];
            const g_ = img[idx * 4 + 1];
            const b_ = img[idx * 4 + 2];
            dst[xc * h + yc] = finder(r_, g_, b_);
          }
        }
        return dst;
      }
    });

    const map = iter(artFiles)
      .map(file => iter(file.art.arts)
        .enumerate()
        .map(([info, i]) => pair(file.art.header.start + i, { ...info, artFile: file.name })))
      .flatten()
      .toMap(first, second);

    await iter(defs.tiles)
      .map(async t => pair(t, await fs.read(t.file)))
      .await_()
      .then(i => i
        .filter(([_, o]) => o.isPresent())
        .map(async ([t, o]) => pair(t, await loadImageFromBuffer(o.get())))
        .await_())
      .then(i => i
        .forEach(([t, [w, h, img]]) => {
          const attrs = new Attributes();
          attrs.xoff = t.xoff ?? 0;
          attrs.yoff = t.yoff ?? 0;
          const info: ArtInfoExtended = { w, h, img: toArtImg.get()(w, h, img, t.alphacut ?? 0.32), artFile: t.file, attrs };
          map.set(t.picnum, info);
        }));

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
  });
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

function sectorLotagText(lotag: number) {
  switch (lotag) {
    case 1: return "WATER";
    case 2: return "UNDERWATER";
    case 9: return "STAR TREK DOORS";
    case 15: return "ELEVATOR TRANSPORT (SE 17)";
    case 16: return "ELEVATOR PLATFORM DOWN";
    case 17: return "ELEVATOR PLATFORM UP";
    case 18: return "ELEVATOR DOWN";
    case 19: return "ELEVATOR UP";
    case 20: return "CEILING DOOR";
    case 21: return "FLOOR DOOR";
    case 22: return "SPLIT DOOR";
    case 23: return "SWING DOOR (SE 11)";
    case 25: return "SLIDE DOOR (SE 15)";
    case 26: return "SPLIT STAR TREK DOOR";
    case 27: return "BRIDGE (SE 20)";
    case 28: return "DROP FLOOR (SE 21)";
    case 29: return "TEETH DOOR (SE 22)";
    case 30: return "ROTATE RISE BRIDGE";
    case 31: return "2 WAY TRAIN (SE=30)";
    case 32767: return "SECRET AREA";
    case 65535: return "END OF LEVEL";
    default: if (lotag > 10000 && lotag < 32767) return "1 TIME SOUND";
  }
  return "";
}

const SE_TAGS = [
  "ROTATED SECTOR",                // 0
  "ROTATION PIVOT",
  "EARTHQUAKE",
  "RANDOM LIGHTS AFTER SHOT OUT",
  "RANDOM LIGHTS",
  "(UNKNOWN)",                     // 5
  "SUBWAY",
  "TRANSPORT",
  "RISING DOOR LIGHTS",
  "LOWERING DOOR LIGHTS",
  "DOOR CLOSE DELAY",              // 10
  "SWING DOOR PIVOT (ST 23)",
  "LIGHT SWITCH",
  "EXPLOSIVE",
  "SUBWAY CAR",
  "SLIDE DOOR (ST 25)",            // 15
  "ROTATE REACTOR SECTOR",
  "ELEVATOR TRANSPORT (ST 15)",
  "INCREMENTAL SECTOR RISE/FALL",
  "CEILING FALL ON EXPLOSION",
  "BRIDGE (ST 27)",                // 20
  "DROP FLOOR (ST 28)",
  "TEETH DOOR (ST 29)",
  "1-WAY TRANSPORT DESTINATION",
  "CONVEYOR BELT",
  "ENGINE",                        // 25
  "(UNKNOWN)",
  "DEMO CAMERA",
  "LIGHTNING (4890) CONTROLLER",
  "FLOAT",
  "2 WAY TRAIN (ST 31)",           // 30
  "FLOOR Z",
  "CEILING Z",
  "EARTHQUAKE DEBRIS",
];

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
    const sec = board.sectors[sectorId];
    if (sec.ceilingstat.tror !== 1) return [];
    return getOrDefault(sectorByFloorBunch, sec.ceilingxpanning, []);
  }
  const floor = (sectorId: number): number[] => {
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
    .map(([spr, s]) => [spr, s, board.sectors[spr.sectnum]] as [Sprite, number, Sector])
    .filter(([spr, s, sec]) => spr.lotag === TRANSPORT_TAG && (sec.lotag === WATER_TAG || sec.lotag === UNDERWATER_TAG))
    .group(([spr, s, sec]) => spr.hitag, identity());
  const floorLinks = new Map<number, RorLink>();
  const ceilingLinks = new Map<number, RorLink>();
  const floorLink = (sectorId: number) => floorLinks.get(sectorId);
  const ceilLink = (sectorId: number) => ceilingLinks.get(sectorId);
  const hasRor = (sectorId: number) => floorLinks.has(sectorId) || ceilingLinks.has(sectorId);
  for (const links of transportsByHitag.values()) {
    if (links.length !== 2) continue;
    let [spr1, s1, sec1] = links[0];
    let [spr2, s2, sec2] = links[1];
    if (sec1.lotag === WATER_TAG) [spr1, spr2, s1, s2, sec1, sec2] = [spr2, spr1, s2, s1, sec2, sec1];
    board.sectors[spr1.sectnum].ceilingstat.type = 2;
    board.sectors[spr2.sectnum].floorstat.type = 2;
    const spr1z = slope(board, spr1.sectnum, spr1.x, spr1.y, sec1.ceilingstat.slopped ? sec1.ceilingheinum : 0) + sec1.ceilingz;
    const spr2z = slope(board, spr2.sectnum, spr2.x, spr2.y, sec2.floorstat.slopped ? sec2.floorheinum : 0) + sec2.floorz;
    const srcSpritePos = vec3.fromValues(spr1.x, spr1.y, spr1z);
    const dstSpritePos = vec3.fromValues(spr2.x, spr2.y, spr2z);
    const buildDiff = vec3.sub(vec3.create(), srcSpritePos, dstSpritePos);
    ceilingLinks.set(spr1.sectnum, { buildDiff, dstSector: spr2.sectnum });
    floorLinks.set(spr2.sectnum, { buildDiff: vec3.negate(vec3.create(), buildDiff), dstSector: spr1.sectnum });
  }
  return { rorLinks: { floorLink, ceilLink, hasRor }, isMirrorPic: _ => false } as BuildRor;
}

async function loadBoard(stream: Stream): Promise<BoardContext> {
  const board = loadBuildMap(stream);
  const ror = getRor(board);
  const spritesBySector = iter(board.sprites).map(field('sectnum')).enumerate().group(first, second);
  const tror = getTror(board);
  const utils = { spritesBySector: (sectorId) => spritesBySector.get(sectorId) } as BoardUtils;
  const lotagSectorText = (sectorId: number) => sectorLotagText(board.sectors[sectorId].lotag);
  const lotagSpriteText = (spriteId: number) => { const spr = board.sprites[spriteId]; return spr.picnum === 1 ? SE_TAGS[spr.lotag] ?? '' : '' }
  const lotagWallText = (wallId: number) => '';
  return { board, ror, tror, utils, parallaxPicnums: 8, lotagSectorText, lotagSpriteText, lotagWallText };
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
        .thenPass('Loading additional Art Files', (grpInfo, defs, resources, [pal, trans, plus, spriteVoxelSwap, art, aliases, picTags]) => loadArtMap(values, defs, art, resources, pal))
        .thenPass('Creating default Fog pals', (grpInfo, defs, resources, [pal, trans, plus, spriteVoxelSwap, art, aliases, picTags], artMap) => generateFogPals(values, pal, plus))
        .then<EngineContext>('', async (grpInfo, defs, resources, [pal, trans, plus, spriteVoxelSwap, art, aliases, picTags], artMap, plusWithFog) => {
          const api = engineApi();
          const name = values.field('name', grpInfo, 'name');
          const settings = defaultEngineSettings();
          const shadowsteps = values.const('shadowsteps', 32);
          const maxPluId = loadMaxPluId(values, plusWithFog);
          const blends = loadBlends(values, defs);
          const parallaxInfo = defaultParallaxPicnums;
          const dispose = () => values.dispose();
          return { name, resources, api, settings, pal, trans, picTags, plus: plusWithFog, maxPluId, art, artMap, shadowsteps, aliases, spriteVoxelSwap, blends, parallaxInfo, loadBoard, dispose }
        }).finish()(handle)
      )).finish()
}