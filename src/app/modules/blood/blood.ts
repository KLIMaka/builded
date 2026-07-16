import { ArtInfoExtended, BoardContext, BuildRor, BuildTror, DEFAULT_BLEND, DEFAULT_SECTOR_SETTING, EMPTY_ALIASES, EMPTY_TAGS, EngineContext, EngineSettings, GlBlend, Palette, PicTags, Sound, VoxelSwap } from "app/apis/engine";
import { FileSystem } from "app/apis/fs";
import { BloodBoard } from "build/blood/structs";
import { loadRorLinks, MIRROR_PIC } from "build/blood/utils";
import { EngineApi } from "build/board/mutations/api";
import { Sector, Sprite, Wall } from "build/board/structs";
import { readKvx, VoxelData } from "build/formats/kvx";
import { EMPTY_RFF_FILE, FatRecord, RffFile, RffFileType } from "build/formats/rff";
import { spriteInfo } from "build/sprites";
import Optional from "optional-js";
import { Source, ValuesContainer } from "ts-utils/callbacks";
import { EMPTY_COLLECTION, getOrCreate, getOrDefault } from "ts-utils/collections";
import { cookbookImmediate, cookbookInput } from "ts-utils/cookbook";
import { Iter, iter } from "ts-utils/iter";
import { field } from "ts-utils/objects";
import { Task } from "ts-utils/scheduler";
import { builder, int, Stream, string } from "ts-utils/stream";
import { first, Fn, identity, second, Supplier, typeToken } from "ts-utils/types";
import { cloneBoard, cloneSector, cloneSprite, cloneWall, loadBloodMap, newBoard, newSector, newSprite, newWall, saveBloodMap } from '../../../build/blood/maploader';
import { createBoardModifier } from "../default/board-context-utils";
import { loadEngineDefsWork } from "../default/def-utils";
import { loadAddonJson, loadArtMapTask, loadArtTask, loadEditorPicAddons, loadMaxPluId, loadRaw, openFile, openFileOptional, packegeFs } from "../default/engine-commons";
import { DefaultGridController } from "../default/grid";
import { createRffFsArrayBuffer, createRffFsFile, stack, watchFile, watchFileNamed } from "../fs/fs";
import { SECTOR_TAGS, SPRITE_TAGS, WALL_TAGS } from "./texts";

function engineApi(): EngineApi<BloodBoard> {
  return { cloneBoard, cloneWall, cloneSprite, cloneSector, newWall, newSector, newSprite, newBoard };
}

function genDefaultPlu() {
  const plu = new Uint8Array(256 * 64);
  for (let s = 0; s < 64; s++)
    for (let i = 0; i < 256; i++)
      plu[s * 256 + i] = i;
  return plu;
}

async function loadPlus(values: ValuesContainer, fs: Source<FileSystem>): Promise<Source<Palette[]>> {
  const defaultPlu = genDefaultPlu();
  const palettes = ['NORMAL', 'SATURATE', 'BEAST', 'TOMMY', 'SPIDER3', 'GRAY', 'GRAYISH', 'SPIDER1', 'SPIDER2', 'FLAME', 'COLD', 'P1', 'P2', 'P3', 'P4'];
  const loadPals = await Promise.all(palettes.map(p => openFileOptional(values, `${p}.PLU`, fs)));
  return values.transformedTuple('plus', [...loadPals], p => iter(p)
    .enumerate()
    .map(([p, i]) => ({ id: i, name: palettes[i], plu: p.map(ab => new Uint8Array(ab)).orElse(defaultPlu) }))
    .collect());
}

async function loadPicTags(values: ValuesContainer, fs: Source<FileSystem>): Promise<Source<PicTags>> {
  return values.transformed('picTags', await watchFile(values, 'SURFACE.DAT', fs), s => s
    .map(f => loadTags(f))
    .orElse(EMPTY_TAGS)
  );
}

function loadTags(surfaceDat: ArrayBuffer): PicTags {
  const surface = new Uint8Array(surfaceDat);
  const tags = ['None', 'Stone', 'Metal', 'Wood', 'Flesh', 'Water', 'Dirt', 'Clay', 'Snow', 'Ice', 'Leaves', 'Cloth', 'Plant', 'Goo', 'Lava'];
  return { allTags: () => tags, tags: id => surface.length <= id ? EMPTY_COLLECTION : [tags[surface[id]]] };
}

let boardId = 1;
function createBoardContext(values: ValuesContainer, art: Source<Map<number, ArtInfoExtended>>, initialBoard: BloodBoard, name?: string): BoardContext<BloodBoard> {
  const boardValues = values.createChild(`board-${boardId++}`);
  const board = boardValues.value('board', initialBoard);
  const data = boardValues.transformedTuple('data', [board, art], ([board, art]) => {
    const [rorLinks, sectorSettingsMap] = loadRorLinks(board);
    const sectorSettings = (sectorId: number) => getOrDefault(sectorSettingsMap, sectorId, DEFAULT_SECTOR_SETTING);
    const ror: BuildRor = { rorLinks, isMirrorPic: picnum => picnum === MIRROR_PIC };
    const tror: BuildTror = { ceiling: (_: number) => [], floor: (_: number) => [] };
    const spritesBySectorMap = iter(board.sprites).map(field('sectnum')).enumerate().group(first, second);
    const spritesBySector = (sectorId: number) => getOrDefault(spritesBySectorMap, sectorId, []);
    const parallaxPicnums = Math.pow(2, board.parallaxSize);
    const spriteDescriptorsMap = Iter.range(0, board.numsprites).toMap(identity(), s => spriteInfo(board, s, art));
    const spriteDescriptor = (spriteId: number) => spriteDescriptorsMap.get(spriteId);
    return { board, ror, tror, spritesBySector, parallaxPicnums, spriteDescriptor, sectorSettings }
  });


  const grid = DefaultGridController(values);
  const save = async () => saveBloodMap(board.get());
  const dispose = async () => boardValues.dispose();

  return { name, data, ...createBoardModifier(board, data), grid, save, dispose };
}

function createloadBoard(values: ValuesContainer, art: Source<Map<number, ArtInfoExtended>>): Fn<Stream, Promise<BoardContext<BloodBoard>>> {
  return async (stream: Stream, name?: string): Promise<BoardContext<BloodBoard>> => createBoardContext(values, art, loadBloodMap(stream), name);
}

function createCreateBoard(values: ValuesContainer, art: Source<Map<number, ArtInfoExtended>>): Supplier<Promise<BoardContext<BloodBoard>>> {
  return async () => createBoardContext(values, art, newBoard(), 'unnnamed');
}

function engineSettings(values: ValuesContainer, off: Source<number>): Source<EngineSettings> {
  return values.transformed('settings', off, off => {
    const trans1 = 0.66;
    const trans2 = 0.33;
    const lotagSectorText = (sector: Sector) => getOrDefault(SECTOR_TAGS, sector.lotag, '');
    const lotagSpriteText = (sprite: Sprite) => getOrDefault(SPRITE_TAGS, sprite.lotag, '');
    const lotagWallText = (wall: Wall) => getOrDefault(WALL_TAGS, wall.lotag, '');
    return { spriteShadowOff: true, trans1, trans2, lotagSectorText, lotagSpriteText, lotagWallText, fontPicnum: off + 1, pointPicnum: off };
  });
}

type FileById = (fid: number, ext: string) => Optional<ArrayBuffer>;
function loadFileById(values: ValuesContainer, bloodRff: Source<Optional<RffFile>>): Source<FileById> {
  const toFileById: Fn<RffFile, FileById> = (rff: RffFile) => (fid, ext) => rff.getRecordById(ext, fid).map(rec => rff.get(rec));
  return values.transformed('file-by-id', bloodRff, rff => rff.map(toFileById).orElse((_1, _2) => Optional.empty()));
}

type VoxelInfo = (picnum: number) => number;

async function createSpriteVoxelSwap(values: ValuesContainer, fs: Source<FileSystem>): Promise<Source<VoxelSwap>> {
  const bloodRffFile = await openFileOptional(values, 'BLOOD.RFF', fs);
  const bloodRff = values.transformed('blood-rff', bloodRffFile, o => o.map(buff => new RffFile(buff)));
  const fileById = loadFileById(values, bloodRff);
  const voxelDat = await openFileOptional(values, 'voxel.dat', fs);
  const loadVoxelInfo = (buff: ArrayBuffer): VoxelInfo => {
    const info = new Uint16Array(buff);
    return picnum => info[picnum] ?? 0xffff;
  }
  const voxelInfo = values.transformed('voxel-info', voxelDat, buff => buff.map(loadVoxelInfo).orElse(_ => 0xffff));
  const cache = new Map<number, Optional<VoxelData>>();
  return values.transformedTuple('sprite-swap', [fileById, voxelInfo], ([fileById, voxelInfo]) => {
    cache.clear();
    return picnum => {
      const fileId = voxelInfo(picnum);
      if (fileId === 0xffff) return Optional.empty();
      return getOrCreate(cache, fileId, fileId => {
        const voxelFile = fileById(fileId, 'kvx');
        return voxelFile.map(buff => readKvx(new Stream(buff)));
      })
    }
  })
}

const sfxRecord = builder()
  .field('relVol', int)
  .field('pitch', int)
  .field('pitchRange', int)
  .field('format', int)
  .field('loopStart', int)
  .field('rawName', string(9))
  .build();
const sampleRates = [11025, 11025, 11025, 11025, 11025, 22050, 22050, 22050, 22050, 44100, 44100, 44100, 44100];
function getSampleRate(format: number): number {
  if (format < 13) return sampleRates[format];
  return 11025;
}

function readSound(soundsRff: RffFileType, rec: FatRecord): Sound {
  const file = soundsRff.get(rec);
  const sfx = sfxRecord.read(new Stream(file));
  const volume = sfx.relVol / 80;
  return { id: rec.fileId, distance: 0, file: sfx.rawName + ".raw", sampleRate: getSampleRate(sfx.format), pitchLower: 0, pitchUpper: 0, priority: 0, type: sfx.format, volume };
}

async function createSounds(values: ValuesContainer, soundsRff: Source<RffFileType>): Promise<Source<Sound[]>> {
  return values.transformed('sounds', soundsRff, sounds =>
    sounds.getTypeRecords('sfx').map(rec => readSound(sounds, rec)))
}

async function loadRff(values: ValuesContainer, root: Source<FileSystem>, name: Source<string>): Promise<Source<RffFileType>> {
  return values.transformedAsync(`rff file ${name.name}`, await watchFileNamed(values, name, root),
    async data => data.map(buff => new RffFile(buff) as RffFileType).orElse(EMPTY_RFF_FILE));
}

export const createEngineContextWork: Task<EngineContext<BloodBoard>, [Source<FileSystem>, ValuesContainer]> =
  cookbookInput(typeToken<[Source<FileSystem>, ValuesContainer]>(), (book, input) =>
    book.paste([input], async (handle, [fs, values]) =>
      values.createChild('blood-module').initializeAsync(values => cookbookImmediate(handle, book => {
        const addon = book.recepie('Loading addon.json', [], async () => loadAddonJson(values, fs));
        const mainRffName = book.recepie('Main RFF name', [addon], async addon => values.transformed('main rff', addon, addon => addon.rff_main ?? 'BLOOD.RFF'));
        const soundsRffName = book.recepie('Sounds RFF name', [addon], async addon => values.transformed('sounds rff', addon, addon => addon.rff_sound ?? 'SOUNDS.RFF'));
        const defname = book.recepie('Def name', [addon], async addon => values.transformed('defname', addon, addon => addon.def_modules?.[0] ?? ''));
        const defs = book.paste([defname], async (handle, defname) => loadEngineDefsWork('', values)(handle, fs, defname));
        const mainRffFile = book.recepie('Loading main rff', [mainRffName], async name => loadRff(values, fs, name));
        const soundsRffFile = book.recepie('Loading sounds rff', [soundsRffName], async name => loadRff(values, fs, name));
        const mainFS = book.recepie('Loading main rff FS', [mainRffFile, mainRffName], async (rff, name) => values.transformedTuple('main-fs', [rff, name], ([rff, name]) => createRffFsFile(name, rff)));
        const soundsFS = book.recepie('Loading sounds rff FS', [soundsRffFile, soundsRffName], async (rff, name) => values.transformedTuple('sounds-fs', [rff, name], ([rff, name]) => createRffFsFile(name, rff)));
        const guiRff = book.recepie('Loading GUI.RFF', [], async () => packegeFs(values, fs, values.const('GUI.RFF', 'GUI.RFF'), async buff => createRffFsArrayBuffer('GUI.RFF', buff)));
        const res = book.recepie('Creating Resources', [mainFS, soundsFS, guiRff], async (blood, sounds, gui) =>
          values.transformedTuple('stackFs', [blood, sounds, gui, fs], ([blood, sounds, gui, fs]) => stack(fs, stack(blood, stack(sounds, gui)))));
        const pal = book.recepie('Loading BLOOD.PAL', [res], async res => openFile(values, 'BLOOD.PAL', res).then(bloodPal => loadRaw('pal', values, bloodPal)));
        const trans = book.recepie('Loading TRANS.TLU', [res], async res => openFile(values, 'TRANS.TLU', res).then(bloodPal => loadRaw('trans', values, bloodPal)));
        const plus = book.recepie('Loading PLUs', [res], res => loadPlus(values, res));
        const tags = book.recepie('Loading Tags', [res], res => loadPicTags(values, res));
        const voxels = book.recepie('Loading Voxels', [res], res => createSpriteVoxelSwap(values, res));
        const sounds = book.recepie('Loading Sounds', [soundsRffFile], soundsRff => createSounds(values, soundsRff));
        const art = book.recepieTask([res], res => loadArtTask(values, res));
        const artMap = book.recepieTask([res, pal, defs, art], (res, pal, defs, art) => loadArtMapTask(values, defs, art, res, pal));
        const picAddons = book.recepieTask([res, pal, artMap], (res, pal, artMap) => loadEditorPicAddons(values, artMap, res, pal));
        return book.recepie('Compose', [res, pal, trans, plus, tags, voxels, sounds, art, picAddons],
          async (resources, pal, trans, plus, picTags, spriteVoxelSwap, sounds, art, artAddon): Promise<EngineContext<BloodBoard>> => {
            const api = engineApi();
            const settings = engineSettings(values, artAddon.offset);
            const name = values.const('name', "Blood");
            const artMap = artAddon.map;
            const shadowsteps = values.const('shadowsteps', 64);
            const aliases = values.const('aliases', EMPTY_ALIASES);
            const maxPluId = loadMaxPluId(values, plus);
            const parallaxInfo = (_: number) => 0xffffff;
            const blends = values.const<Fn<number, GlBlend>>('blend', _ => DEFAULT_BLEND);
            const loadBoard = createloadBoard(values, artAddon.map);
            const createBoard = createCreateBoard(values, artAddon.map);
            const dispose = () => values.dispose();
            return { name, resources, api, settings, pal, trans, picTags, plus, maxPluId, art, artMap, shadowsteps, aliases, spriteVoxelSwap, blends, sounds, parallaxInfo, loadBoard, createBoard, dispose }
          });
      }))));
