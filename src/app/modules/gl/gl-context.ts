import { createContainer, Disposable, Source } from "@utils/callbacks";
import { getOrCreate, getOrDefault, range } from "@utils/collections";
import { DisposableResource, GlContext, ResourceFactory, Texture } from "@utils/gl/drawstruct";
import { createTexture } from "@utils/gl/textures";
import { axisSwap } from "@utils/imgutils";
import { iter } from "@utils/iter";
import { int, sum } from "@utils/mathutils";
import { Stream } from "@utils/stream";
import { Packer, Rect } from "@utils/texcoordpacker";
import { Consumer, Function, identity, pair } from "@utils/types";
import { ArtInfoExtended, EngineContext, VoxelSwap } from "app/apis/engine";
import { animStruct, ArtInfo } from "build/formats/art";
import { unpackVoxelSides } from "build/formats/kvx";
import Optional from "optional-js";

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

export type EngineTextures = {
  readonly pal: Source<Texture>,
  readonly plu: Source<Texture>,
  readonly trans: Source<Texture>,
  readonly atlas: Source<WebGLTexture>,
  readonly infos: Source<WebGLTexture>,
  readonly art: Source<Map<number, ArtInfoExtended>>,
  readonly voxels: Source<Function<number, Optional<VoxelDrawData>>>,

  get(picnum: number, additional?: number): Source<number>,
} & Disposable;

type AtlasRect = { rect: Rect, depth: number, uploaded: boolean }
class ArtTexture implements Disposable {
  readonly atlasId: DisposableResource<WebGLTexture>;
  readonly infoId: DisposableResource<WebGLTexture>;
  private rects = new Map<number, AtlasRect>();
  private depth: number;

  constructor(
    private glCtx: GlContext,
    private arts: Map<number, ArtInfoExtended>,
    private width: number,
    private height: number,
    private parallaxInfo: Function<number, number>,
    private voxelsSwaps: Source<VoxelSwap>,
  ) {
    const { gl, resource } = glCtx;
    const packers: Packer[] = [];
    const pack = (w: number, h: number): AtlasRect => iter(packers)
      .enumerate()
      .map(([p, depth]) => ({ depth, rect: p.pack(w, h), uploaded: false }))
      .first(({ rect }) => rect !== undefined)
      .orElseGet(() => {
        const packer = new Packer(this.width, this.height);
        const rect = packer.pack(w, h);
        const depth = packers.length;
        const uploaded = false;
        packers.push(packer);
        return { depth, rect, uploaded };
      });
    const whs = iter(this.arts)
      .filter(([_, a]) => a.w > 0 && a.h > 0)
      .map(([id, a]) => pair(id, pair(a.w, a.h)))
      .collect();
    whs.sort(([id1, [w1, h1]], [id2, [w2, h2]]) => - w1 * h1 + w2 * h2);
    whs.forEach(([id, [w, h]]) => this.rects.set(id, pack(w, h)));
    this.depth = packers.length;
    console.log(`Atlas created with ${this.depth} layers`);
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
    console.log(`Creating voxel texture for ${picnum} with ${quads} quads, ${voxels.length} voxels, ${quadPixels} pixels, ${w}x${h}`);
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

export function createEngineTextures(engine: EngineContext, glCtx: GlContext): EngineTextures {
  const { gl } = glCtx;
  return createContainer('engine-textures').initialize(values => {
    const art = engine.artMap;
    const texDisposer = { disposer: (tex: Texture) => tex.dispose() };
    const pal = values.transformed('palTexture', engine.pal, pal => createTexture(glCtx, 256, 1, pal, gl.RGB, 3), texDisposer);
    const plu = values.transformedTuple('pluTexture', [engine.shadowsteps, engine.plus, engine.maxPluId], ([steps, plus, maxPluId]) => {
      const plusLength = maxPluId + 1;
      const pluMap = iter(plus).toMap(p => p.id, identity());
      const tex = new Uint8Array(256 * steps * plusLength);
      const defPlu = pluMap.get(0);
      for (const i of range(0, plusLength)) tex.set(getOrDefault(pluMap, i, defPlu).plu, 256 * steps * i);
      for (let i = 0; i < steps * plusLength; i++) tex[256 * i - 1] = 255;
      return createTexture(glCtx, 256, steps * plusLength, tex, gl.LUMINANCE);
    }, texDisposer);
    const trans = values.transformed('transTexture', engine.trans, trans => createTexture(glCtx, 256, 256, trans, gl.LUMINANCE), texDisposer);
    const textures = new Map<number, Source<number>>();
    const size = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));
    const artTexture = values.transformed(`atlas`, art, arts => new ArtTexture(glCtx, arts, size, size, engine.parallaxInfo, engine.spriteVoxelSwap), { disposer: m => m.dispose() });
    const atlas = values.transformed(`atlas-texture`, artTexture, t => t.atlasId.value);
    const infos = values.transformed(`infos-texture`, artTexture, t => t.infoId.value);
    const get = (picnum: number, additional = 0) => getOrCreate(textures, picnum, _ => values.transformed(`texture_${picnum}`, artTexture, mega => mega.get(picnum, additional)));
    const voxelsCache = new Map<number, [number, DisposableResource<WebGLTexture>]>();
    const voxels = values.transformed('voxels', engine.spriteVoxelSwap, voxels => (picnum: number) => getVoxel(picnum, voxelsCache, voxels, glCtx));
    const dispose = async () => { await values.dispose(); voxelsCache.values().forEach(([_, t]) => t.dispose()) }
    return { pal, plu, trans, atlas, infos, art, voxels, get, dispose };
  });
}