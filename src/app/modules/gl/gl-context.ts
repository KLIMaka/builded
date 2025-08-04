import { createContainer, Disposable, Source, ValuesContainer } from "ts-utils/callbacks";
import { getOrCreate, getOrDefault, range } from "ts-utils/collections";
import { DisposableResource, GlContext, ResourceFactory, Texture } from "@utils/gl/drawstruct";
import { createTexture } from "@utils/gl/textures";
import { axisSwap } from "ts-utils/imgutils";
import { iter } from "ts-utils/iter";
import { int, sum } from "ts-utils/mathutils";
import { Stream } from "ts-utils/stream";
import { Packer, Rect } from "ts-utils/texcoordpacker";
import { Consumer, Function, identity, pair } from "ts-utils/types";
import { NOOP_TASK_HANDLE } from "ts-utils/scheduler";
import { ArtInfoExtended, EngineContext, VoxelSwap } from "app/apis/engine";
import { animStruct, ArtInfo } from "build/formats/art";
import { unpackVoxelSides } from "build/formats/kvx";
import Optional from "optional-js";
import { begin, tuple, Work } from "ts-utils/work";

export function createGlContext(): GlContext {
  const offscreen = new OffscreenCanvas(0, 0);
  const gl = offscreen.getContext('webgl2', { antialias: true, stencil: true, desynchronized: false, alpha: false });
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const resources = new Map<string, Set<any>>();
  const resource = <T>(tag: string, value: T, disposer: Consumer<T>): DisposableResource<T> => {
    const res = getOrCreate(resources, tag, _ => new Set<T>());
    res.add(value);
    return { value, dispose: async () => { res.delete(value); disposer(value) } }
  }
  const info = () => iter(resources.entries()).map(([n, s]) => `${n}:${s.size}`).join(',').reduce((l, r) => l + r, '');
  return { offscreen, gl, resource, info }
}

export type VoxelDrawData = {
  size: number,
  texture: WebGLTexture,
}

export type EngineTextures = Readonly<{
  pal: Source<WebGLTexture>,
  plu: Source<WebGLTexture>,
  trans: Source<WebGLTexture>,
  atlas: Source<WebGLTexture>,
  infos: Source<WebGLTexture>,
  art: Source<Map<number, ArtInfoExtended>>,
  voxels: Source<Function<number, Optional<VoxelDrawData>>>,

  get(picnum: number, additional?: number): Source<number>,
}> & Disposable;

type AtlasRect = { rect: Rect, depth: number, uploaded: boolean }

function createArtTextureWork(values: ValuesContainer, glCtx: GlContext, arts: Source<Map<number, ArtInfoExtended>>, parallaxInfo: Function<number, number>): Work<[], [Source<ArtTexture>]> {
  const size = Math.min(4096, glCtx.gl.getParameter(glCtx.gl.MAX_TEXTURE_SIZE));
  let packers: Packer[] = [];
  const pack = (w: number, h: number): AtlasRect => iter(packers)
    .enumerate()
    .map(([p, depth]) => ({ depth, rect: p.pack(w, h), uploaded: false }))
    .first(({ rect }) => rect !== undefined)
    .orElseGet(() => {
      const packer = new Packer(size, size);
      const rect = packer.pack(w, h);
      const depth = packers.length;
      const uploaded = false;
      packers.push(packer);
      return { depth, rect, uploaded };
    });

  let loadHandle = NOOP_TASK_HANDLE;
  async function loadTextures(arts: Map<number, ArtInfoExtended>): Promise<ArtTexture> {
    packers = [];
    const whs = iter(arts)
      .filter(([_, a]) => a.w > 0 && a.h > 0)
      .map(([id, a]) => pair(id, pair(a.w, a.h)))
      .collect();
    whs.sort(([id1, [w1, h1]], [id2, [w2, h2]]) => - w1 * h1 + w2 * h2);
    const rects = new Map<number, AtlasRect>();
    const jobs = iter(whs).map(([id, [w, h]]) => () => { rects.set(id, pack(w, h)) }).collect();
    await loadHandle.waitForBatchTask(jobs, 'Allocate Atlas');
    return new ArtTexture(glCtx, arts, size, size, rects, packers.length, parallaxInfo);
  }

  return begin()
    .thenWork(tuple(async handle => {
      loadHandle = handle;
      const result = await values.transformedAsync('atlas', arts, arts => loadTextures(arts), m => m.dispose())
      loadHandle = NOOP_TASK_HANDLE;
      return result;
    })).finish();
}

class ArtTexture implements Disposable {
  readonly atlasId: DisposableResource<WebGLTexture>;
  readonly infoId: DisposableResource<WebGLTexture>;

  constructor(
    private glCtx: GlContext,
    private arts: Map<number, ArtInfoExtended>,
    private width: number,
    private height: number,
    private rects: Map<number, AtlasRect>,
    private depth: number,
    private parallaxInfo: Function<number, number>,
  ) {
    const { gl, resource } = glCtx;
    this.atlasId = this.initAtlasTexture(gl, resource);
    this.infoId = this.initInfoTexture(gl, resource);
  }

  private initAtlasTexture(gl: WebGL2RenderingContext, resource: ResourceFactory): DisposableResource<WebGLTexture> {
    const atlasId = resource('texture', gl.createTexture(), t => gl.deleteTexture(t));
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, atlasId.value);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.R8, this.width, this.height, this.depth);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    return atlasId;
  }

  private initInfoTexture(gl: WebGL2RenderingContext, resource: ResourceFactory): DisposableResource<WebGLTexture> {
    const infoId = resource('texture', gl.createTexture(), t => gl.deleteTexture(t));
    gl.bindTexture(gl.TEXTURE_2D, infoId.value);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32UI, 256, 256);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return infoId;
  }

  get(picnum: number, additional = 0): number {
    const atlasRect = this.rects.get(picnum);
    if (atlasRect?.uploaded ?? true) return picnum;
    const info = this.arts.get(picnum);
    if (info === undefined) return picnum;
    const arr = axisSwap(info.img, info.h, info.w);
    this.uploadToAtlas(this.glCtx.gl, atlasRect, arr);
    this.uploadToInfo(picnum, info, atlasRect);
    atlasRect.uploaded = true;
    if (info.attrs.frames > 0) range(1, info.attrs.frames + 1).forEach(o => this.get(picnum + o));
    if (additional > 0) range(1, additional).forEach(o => this.get(picnum + o));
    return picnum;
  }

  private uploadToInfo(picnum: number, info: ArtInfo, atlasRect: AtlasRect) {
    const buff = new ArrayBuffer(16);
    const stream = new Stream(buff);
    stream.writeUShort(atlasRect.rect.w);
    stream.writeUShort(atlasRect.rect.h);
    stream.writeUShort(atlasRect.rect.xoff);
    stream.writeUShort(atlasRect.rect.yoff);
    stream.writeUInt((atlasRect.depth & 0xff) | (this.parallaxInfo(picnum) << 8));
    animStruct.write(stream, info.attrs);
    const gl = this.glCtx.gl;
    const x = picnum % 256;
    const y = int(picnum / 256);
    gl.bindTexture(gl.TEXTURE_2D, this.infoId.value);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_INT, new Uint32Array(buff));
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private uploadToAtlas(gl: WebGL2RenderingContext, atlasRect: AtlasRect, img: Uint8Array) {
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlasId.value);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, atlasRect.rect.xoff, atlasRect.rect.yoff, atlasRect.depth, atlasRect.rect.w, atlasRect.rect.h, 1, gl.RED, gl.UNSIGNED_BYTE, img);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
  }

  async dispose() {
    this.atlasId.dispose();
    this.infoId.dispose();
  }
}

function getVoxel(picnum: number, cache: Map<number, [number, DisposableResource<WebGLTexture>]>, voxels: VoxelSwap, glCtx: GlContext): Optional<VoxelDrawData> {
  const loaded = cache.get(picnum);
  if (loaded !== undefined) return Optional.of({ texture: loaded[1].value, size: loaded[0] });
  return voxels(picnum).map(data => {
    const voxels = data.list();
    const count = (x: number) => range(0, 6).map(i => (x >> i) & 1).reduce((l, r) => l + r);
    const quads = voxels.map(v => count(v.sides)).reduce(sum);
    const quadPixels = Math.ceil(quads / 4);
    const WIDTH = 1024;
    const w = WIDTH;
    const h = Math.ceil((voxels.length + 1 + quadPixels) / WIDTH);
    const texData = new Uint32Array(w * h * 4);
    texData.set([data.xpivot, data.ypivot, data.zpivot, quadPixels + 1]);
    voxels.map((v, i) => unpackVoxelSides(v.sides).map(s => i | (s << 28))).flat().forEach((v, i) => texData[4 + i] = v);
    voxels.forEach((v, i) => texData.set([v.x, v.y, v.z, v.color], 4 + quadPixels * 4 + i * 4));
    const { gl, resource } = glCtx;
    const tex = resource('texture', gl.createTexture(), t => gl.deleteTexture(t));
    gl.bindTexture(gl.TEXTURE_2D, tex.value);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32UI, w, h, 0, gl.RGBA_INTEGER, gl.UNSIGNED_INT, texData);
    gl.bindTexture(gl.TEXTURE_2D, null);
    cache.set(picnum, [quads, tex]);
    return { texture: tex.value, size: quads };
  });
}

export const createEngineTexturesWork = begin()
  .multiInput<[EngineContext, GlContext]>()
  .thenWork((handle, engine, glCtx) =>
    createContainer('engine-textures').initializeAsync(async values => begin()
      .thenWorkPass(createArtTextureWork(values, glCtx, engine.artMap, engine.parallaxInfo))
      .then<EngineTextures>('Create Textures', async artTexture => {
        const { gl } = glCtx;
        const art = engine.artMap;
        const texDisposer = { disposer: (tex: Texture) => tex.dispose() };
        const palTexture = values.transformed('pal-texture-value', engine.pal, pal => createTexture(glCtx, 256, 1, pal, gl.RGB, 3), texDisposer);
        const pal = values.transformed('pal-texture', palTexture, p => p.get());
        const pluTexture = values.transformedTuple('plu-texture-value', [engine.shadowsteps, engine.plus, engine.maxPluId], ([steps, plus, maxPluId]) => {
          const plusLength = maxPluId + 1;
          const pluMap = iter(plus).toMap(p => p.id, identity());
          const tex = new Uint8Array(256 * steps * plusLength);
          const defPlu = pluMap.get(0);
          for (const i of range(0, plusLength)) tex.set(getOrDefault(pluMap, i, defPlu).plu, 256 * steps * i);
          for (let i = 0; i < steps * plusLength; i++) tex[256 * i - 1] = 255;
          return createTexture(glCtx, 256, steps * plusLength, tex, gl.LUMINANCE);
        }, texDisposer);
        const plu = values.transformed('plu-texture', pluTexture, p => p.get());
        const transTexture = values.transformed('trans-texture-value', engine.trans, trans => createTexture(glCtx, 256, 256, trans, gl.LUMINANCE), texDisposer);
        const trans = values.transformed('trans-texture', transTexture, t => t.get());
        const textures = new Map<number, Source<number>>();
        const atlas = values.transformed(`atlas-texture`, artTexture, t => t.atlasId.value);
        const infos = values.transformed(`infos-texture`, artTexture, t => t.infoId.value);
        const get = (picnum: number, additional = 0) => getOrCreate(textures, picnum, _ => values.transformed(`texture_${picnum}`, artTexture, mega => mega.get(picnum, additional)));
        const voxelsCache = new Map<number, [number, DisposableResource<WebGLTexture>]>();
        const voxels = values.transformed('voxels', engine.spriteVoxelSwap, voxels => (picnum: number) => getVoxel(picnum, voxelsCache, voxels, glCtx));
        const dispose = async () => { values.dispose(); voxelsCache.values().forEach(([_, t]) => t.dispose()) }
        return { pal, plu, trans, atlas, infos, art, voxels, get, dispose };
      }).finish()(handle)))
  .finish();