import { EMPTY_COLLECTION, getOrCreate, getOrDefault, range } from "ts-utils/collections";
import { createContainer, Source, ValuesContainer } from "ts-utils/callbacks";
import { iter } from "ts-utils/iter";
import { field } from "ts-utils/objects";
import { Stream } from "ts-utils/stream";
import { first, Function, identity, second } from "ts-utils/types";
import { ArtInfoExtended, BoardContext, BuildRor, BuildTror, DEFAULT_SECTOR_SETTING, EMPTY_ALIASES, EMPTY_TAGS, EngineContext, EngineSettings, GlBlend, Palette, PicTags, VoxelSwap } from "app/apis/engine";
import { FileSystem } from "app/apis/fs";
import { BloodBoard } from "build/blood/structs";
import { loadRorLinks, MIRROR_PIC } from "build/blood/utils";
import { EngineApi } from "build/board/mutations/api";
import { Sector, Sprite, Wall } from "build/board/structs";
import { readKvx, VoxelData } from "build/formats/kvx";
import { RffFile } from "build/formats/rff";
import Optional from "optional-js";
import { cloneBoard, cloneSector, cloneSprite, cloneWall, loadBloodMap, newBoard, newSector, newSprite, newWall, saveBloodMap } from '../../../build/blood/maploader';
import { createBoardModifier } from "../default/board-context-utils";
import { loadArtMap, loadArtWork, loadEditorPicAddons, loadMaxPluId, loadRaw, openFile, openFileOptional, packegeFs } from "../default/engine-commons";
import { createRffFsArrayBuffer, stack, watchFile } from "../fs/fs";
import { begin } from "ts-utils/work";
import { SECTOR_TAGS, SPRITE_TAGS, WALL_TAGS } from "./texts";
import { DefaultGridController } from "../default/grid";
import { spriteInfo } from "build/sprites";

function engineApi(): EngineApi<BloodBoard> {
  return { cloneBoard, cloneWall, cloneSprite, cloneSector, newWall, newSector, newSprite, newBoard };
}

function genDefaultPlu() {
  const plu = new Uint8Array(new ArrayBuffer(256 * 64));
  for (let s = 0; s < 64; s++) {
    for (let i = 0; i < 256; i++) plu[s * 256 + i] = i;
  }
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

function createloadBoard(values: ValuesContainer, art: Source<Map<number, ArtInfoExtended>>): Function<Stream, Promise<BoardContext<BloodBoard>>> {
  let boardId = 1;
  return async (stream: Stream, name?: string): Promise<BoardContext<BloodBoard>> => {
    const boardValues = values.createChild(`board-${boardId++}`);
    const board = boardValues.value('board', loadBloodMap(stream));
    const data = boardValues.transformedTuple('data', [board, art], ([board, art]) => {
      const [rorLinks, sectorSettingsMap] = loadRorLinks(board);
      const sectorSettings = (sectorId: number) => getOrDefault(sectorSettingsMap, sectorId, DEFAULT_SECTOR_SETTING);
      const ror: BuildRor = { rorLinks, isMirrorPic: picnum => picnum === MIRROR_PIC };
      const tror: BuildTror = { ceiling: (_: number) => [], floor: (_: number) => [] };
      const spritesBySectorMap = iter(board.sprites).map(field('sectnum')).enumerate().group(first, second);
      const spritesBySector = (sectorId: number) => getOrDefault(spritesBySectorMap, sectorId, []);
      const parallaxPicnums = Math.pow(2, board.parallaxSize);
      const spriteDescriptorsMap = iter(range(0, board.numsprites)).toMap(identity(), s => spriteInfo(board, s, art));
      const spriteDescriptor = (spriteId: number) => spriteDescriptorsMap.get(spriteId);
      return { board, ror, tror, spritesBySector, parallaxPicnums, spriteDescriptor, sectorSettings }
    });


    const grid = DefaultGridController(values);
    const save = async () => saveBloodMap(board.get());
    const dispose = async () => boardValues.dispose();

    return { name, data, ...createBoardModifier(board, data), grid, save, dispose };
  }
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
  const toFileById: Function<RffFile, FileById> = (rff: RffFile) => (fid, ext) => Optional.ofNullable(rff.getRecordById(ext, fid)).map(rec => rff.get(rec));
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
  return values.transformedTuple('sprite-swap', [fileById, voxelInfo], ([fileById, voxelInfo]) => picnum => {
    const fileId = voxelInfo(picnum);
    if (fileId === 0xffff) return Optional.empty();
    return getOrCreate(cache, fileId, fileId => {
      const voxelFile = fileById(fileId, 'kvx');
      return voxelFile.map(buff => readKvx(new Stream(buff)));
    })
  })
}

export const createEngineContextWork = begin()
  .input<Source<FileSystem>>()
  .thenWork((handle, fs) =>
    createContainer('blood-module').initializeAsync(values => begin()
      .input<Source<FileSystem>>()
      .thenWorkPass((handle, fs) => begin()
        .input<Source<FileSystem>>()
        .forkPass(p => p
          .thread('Loading BLOOD.RFF', fs => packegeFs(values, fs, 'BLOOD.RFF', async buff => createRffFsArrayBuffer(buff)))
          .thread('Loading SOUNDS.RFF', fs => packegeFs(values, fs, 'SOUNDS.RFF', async buff => createRffFsArrayBuffer(buff)))
          .thread('Loading GUI.RFF', fs => packegeFs(values, fs, 'GUI.RFF', async buff => createRffFsArrayBuffer(buff))))
        .then('Creating Resources', async (fs, [blood, sounds, gui]) =>
          values.transformedTuple('stackFs', [blood, sounds, gui, fs], ([blood, sounds, gui, fs]) => stack(fs, stack(blood, stack(sounds, gui)))))
        .finish()(handle, fs))
      .forkPass(p => p
        .thread('Loading BLOOD.PAL', (fs, res) => openFile(values, 'BLOOD.PAL', res).then(bloodPal => loadRaw('pal', values, bloodPal)))
        .thread('Loading TRANS.TLU', (fs, res) => openFile(values, 'TRANS.TLU', res).then(transTlu => loadRaw('trans', values, transTlu)))
        .thread('Loading PLUs', (fs, res) => loadPlus(values, res))
        .thread('Loading Tags', (fs, res) => loadPicTags(values, res))
        .thread('Loading Voxels', (fs, res) => createSpriteVoxelSwap(values, fs))
        .threadWork((handle, fs, res) => loadArtWork(handle, values, res)))
      .thenWorkPass(async (handle, fs, resources, [pal, trans, plus, picTags, spriteVoxelSwap, art]) => loadEditorPicAddons(values, loadArtMap(values, art), resources, pal)(handle))
      .then<EngineContext<BloodBoard>>('', async (fs, resources, [pal, trans, plus, picTags, spriteVoxelSwap, art], artAddon) => {
        const api = engineApi();
        const settings = engineSettings(values, artAddon.offset);
        const name = values.const('', "Blood");
        const artMap = artAddon.map;
        const shadowsteps = values.const('shadowsteps', 64);
        const aliases = values.const('aliases', EMPTY_ALIASES);
        const maxPluId = loadMaxPluId(values, plus);
        const parallaxInfo = (_: number) => 0xffffff;
        const blends = values.const<Function<number, GlBlend>>('blend', _ => ({ src: WebGL2RenderingContext.SRC_ALPHA, dst: WebGL2RenderingContext.ONE_MINUS_SRC_ALPHA }));
        const loadBoard = createloadBoard(values, artAddon.map);
        const dispose = () => values.dispose();
        return { name, resources, api, settings, pal, trans, picTags, plus, maxPluId, art, artMap, shadowsteps, aliases, spriteVoxelSwap, blends, parallaxInfo, loadBoard, dispose }
      }).finish()(handle, fs)))
  .finish();