import { createContainer, Source, ValuesContainer } from "@utils/callbacks";
import { EMPTY_COLLECTION, getOrCreate, range } from "@utils/collections";
import { iter } from "@utils/iter";
import { Stream } from "@utils/stream";
import { first, Function, second } from "@utils/types";
import { BoardUtils } from "app/apis/app";
import { BoardContext, BuildRor, EMPTY_ALIASES, EMPTY_TAGS, EngineContext, EngineSettings, Palette, PicTags, VoxelSwap } from "app/apis/engine";
import { FileSystem } from "app/apis/fs";
import { BloodBoard } from "build/blood/structs";
import { loadRorLinks, MIRROR_PIC } from "build/blood/utils";
import { EngineApi } from "build/board/mutations/api";
import { readKvx, VoxelData } from "build/formats/kvx";
import { RffFile } from "build/formats/rff";
import Optional from "optional-js";
import { cloneBoard, cloneSector, cloneSprite, cloneWall, loadBloodMap, newBoard, newSector, newSprite, newWall } from '../../../build/blood/maploader';
import { loadArtMap, loadArtWork, loadMaxPluId, loadRaw, openFile, openFileOptional, packegeFs } from "../default/engine-commons";
import { createRffFsArrayBuffer, stack, watchFile } from "../fs/fs";
import { begin } from "../scheduler/work";

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

async function loadBoard(stream: Stream): Promise<BoardContext<BloodBoard>> {
  const board = loadBloodMap(stream);
  const rorLinks = loadRorLinks(board);
  const ror = { rorLinks, isMirrorPic: picnum => picnum === MIRROR_PIC } as BuildRor;
  const spritesBySector = iter(board.sprites).map(s => s.sectnum).enumerate().group(first, second);
  const utils = { spritesBySector: (sectorId) => spritesBySector.get(sectorId) } as BoardUtils;
  const parallaxPicnums = (picnum: number): number[] => [...range(picnum, picnum + Math.pow(2, board.parallaxSize))]
  return { board, ror, utils, parallaxPicnums }
}

function engineSettings(): EngineSettings<BloodBoard> {
  const spriteShadowOff = (board: BloodBoard, spriteId: number) => {
    const spr = board.sprites[spriteId];
    const sec = board.sectors[spr.sectnum];
    if (sec.floorstat.floorShade) return sec.floorshade;
    return sec.ceilingstat.parallaxing ? sec.ceilingshade : sec.floorshade;
  }
  const trans1 = 0.66;
  const trans2 = 0.33;
  return { spriteShadowOff, trans1, trans2 };
}

type FileById = (fid: number, ext: string) => Optional<ArrayBuffer>;
function loadFileById(values: ValuesContainer, bloodRff: Source<Optional<RffFile>>): Source<FileById> {
  const toFileById: Function<RffFile, FileById> = (rff: RffFile) => (fid, ext) => Optional.ofNullable(rff.getRecordById(ext, fid)).map(rec => rff.get(rec));
  return values.transformed('file-by-id', bloodRff, rff => rff.map(toFileById).orElse((_1, _2) => Optional.empty()));
}

type VoxelInfo = (picnum: number) => number;

async function createSpriteVoxelSwap(values: ValuesContainer, fs: Source<FileSystem>): Promise<Source<VoxelSwap<BloodBoard>>> {
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
  return values.transformedTuple('sprite-swap', [fileById, voxelInfo], ([fileById, voxelInfo]) => (board, spriteId) => {
    const spr = board.sprites[spriteId];
    const fileId = voxelInfo(spr.picnum);
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
      .then<EngineContext<BloodBoard>>('', async (fs, resources, [pal, trans, plus, picTags, spriteVoxelSwap, art]) => {
        const api = engineApi();
        const settings = engineSettings();
        const name = values.const('', "Blood");
        const artMap = loadArtMap(values, art);
        const shadowsteps = values.const('shadowsteps', 64);
        const aliases = values.const('aliases', EMPTY_ALIASES);
        const maxPluId = loadMaxPluId(values, plus);
        const dispose = () => values.dispose();
        return { name, resources, api, settings, pal, trans, picTags, plus, maxPluId, art, artMap, shadowsteps, aliases, spriteVoxelSwap, loadBoard, dispose }
      }).finish()(handle, fs)))
  .finish();