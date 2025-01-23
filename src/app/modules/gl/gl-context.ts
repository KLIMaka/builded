import { Disposable, Source, createContainer } from "@utils/callbacks";
import { getOrCreate, getOrDefault, range, rect } from "@utils/collections";
import { DisposableResource, GlContext, Texture } from "@utils/gl/drawstruct";
import { createTexture } from "@utils/gl/textures";
import { iter } from "@utils/iter";
import { Consumer, identity, pair, second } from "@utils/types";
import { ArtInfoExtended, EMPTY_INFO_EXTENDED, EngineContext } from "app/apis/engine";

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

export type EngineTextures = {
  readonly pal: Source<Texture>,
  readonly plu: Source<Texture>,
  readonly trans: Source<Texture>,
  readonly art: Source<Map<number, ArtInfoExtended>>,

  get(picnum: number): Source<Texture>,
  getParallaxTexture(picnums: Iterable<number>): Source<Texture>
} & Disposable;

function axisSwap(data: Uint8Array, w: number, h: number): Uint8Array {
  const result = new Uint8Array(w * h);
  for (const [x, y] of rect(w, h)) result[x * h + y] = data[y * w + x];
  return result;
}

function mergeParallax(w: number, h: number, arrs: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(w * h * arrs.length);
  for (let y = 0; y < h; y++) {
    for (let i = 0; i < arrs.length; i++) {
      for (let x = 0; x < w; x++) result[y * w * arrs.length + i * w + x] = arrs[i][y * w + x]
    }
  }
  return result;
}

export async function createEngineTextures(engine: EngineContext, glCtx: GlContext): Promise<EngineTextures> {
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
    const defaultTexture = createTexture(glCtx, 1, 1, new Uint8Array([0]), gl.LUMINANCE)
    const textureDisposer = { disposer: (tex: Texture) => { if (tex !== defaultTexture) tex.dispose() } };
    const textures = new Map<number, Source<Texture>>();
    const get = (picnum: number) => getOrCreate(textures, picnum, _ => values.transformed(`texture_${picnum}`, art, arts => {
      const info = getOrDefault(arts, picnum, EMPTY_INFO_EXTENDED);
      if (info.h <= 0 || info.w <= 0) return defaultTexture;
      const arr = axisSwap(info.img, info.h, info.w);
      return createTexture(glCtx, info.w, info.h, arr, gl.LUMINANCE)
    }, textureDisposer))
    const parallaxTextures = new Map<string, Source<Texture>>();
    const formatParallaxTextureId = (pics: number[]) => iter(pics).map(i => i.toString()).join(',').reduce((l, r) => l + r, '');
    const getParallaxTexture = (pics: number[]) => getOrCreate(parallaxTextures, formatParallaxTextureId(pics), key => values.transformed(`parallaxTexture_${key}`, art, art => {
      const infos = iter(pics).map(p => art.get(p)).map(i => pair(i, axisSwap(i.img, i.h, i.w))).collect();
      const count = infos.length;
      const [{ w, h }, axisSwapped] = iter(infos).first().get();
      if (!iter(infos).all(([i, _]) => i.w === w && i.h === h))
        return createTexture(glCtx, w, h, axisSwapped, gl.LUMINANCE);
      const merged = mergeParallax(w, h, iter(infos).map(second).collect());
      return createTexture(glCtx, w * count, h, merged, gl.LUMINANCE);
    }, textureDisposer));

    const dispose = async () => { await values.dispose(); defaultTexture.dispose() }
    return { pal, plu, trans, art, get, getParallaxTexture, dispose };
  });
}