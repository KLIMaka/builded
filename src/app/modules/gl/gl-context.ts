import { Disposable, Source, createContainer } from "@utils/callbacks";
import { getOrCreate, getOrDefault, range, rect } from "@utils/collections";
import { Texture } from "@utils/gl/drawstruct";
import { createTexture } from "@utils/gl/textures";
import { Dependency } from "@utils/injector";
import { iter } from "@utils/iter";
import { identity, pair, second, seq } from "@utils/types";
import { SubtaskHandle } from "app/apis/app1";
import { ArtInfoExtended, EMPTY_INFO_EXTENDED, EngineContext } from "app/apis/engine";

export type GlContext = {
  offscreen: OffscreenCanvas,
  gl: WebGL2RenderingContext,
}
export const GL_CONTEXT = new Dependency<GlContext>('Gl Context');

export function createGlContext(): GlContext {
  const offscreen = new OffscreenCanvas(0, 0);
  const gl = offscreen.getContext('webgl2', { antialias: true, stencil: true, desynchronized: false, alpha: false });
  return { offscreen, gl }
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

export async function createEngineTextures(engine: EngineContext, glCtx: GlContext, handle: SubtaskHandle): Promise<EngineTextures> {
  const { gl } = glCtx;
  function waitFor<T>(p: Promise<T>, s: string, dt: number): Promise<T> { return handle ? handle.waitFor(p, s, dt) : p }
  return createContainer('engine-textures').initializeAsync(async values => {
    const art = await waitFor(engine.artMap, 'Getting Art Map...', 1);
    const rawPal = await waitFor(engine.pal, 'Getting Palette...', 1);
    const shadowsteps = await waitFor(engine.shadowsteps, 'Getting Shadowsteps...', 1);
    const rawPlus = await waitFor(engine.plus, 'Getting Pal Lookups...', 1);
    const rawTrans = await waitFor(engine.trans, 'Getting Trans Table...', 1);
    const texDisposer = { disposer: (tex: Texture) => tex.destroy(gl) };
    const pal = values.transformed('palTexture', rawPal, pal => createTexture(256, 1, gl, { filter: gl.NEAREST }, pal, gl.RGB, 3), texDisposer);
    const plu = values.transformedTuple('pluTexture', [shadowsteps, rawPlus], ([steps, plus]) => {
      const plusLength = iter(plus).map(p => p.id).reduce(Math.max, 0) + 1;
      const pluMap = iter(plus).toMap(p => p.id, identity());
      const tex = new Uint8Array(256 * steps * plusLength);
      for (const i of range(0, plusLength)) tex.set(getOrDefault(pluMap, i, pluMap.get(0)).plu, 256 * steps * i);
      for (let i = 0; i < steps * plusLength; i++) tex[256 * i - 1] = 255;
      return createTexture(256, steps * plusLength, gl, { filter: gl.NEAREST }, tex, gl.LUMINANCE);
    }, texDisposer);
    const trans = values.transformed('transTexture', rawTrans, trans => createTexture(256, 256, gl, { filter: gl.NEAREST }, trans, gl.LUMINANCE), texDisposer);
    const defaultTexture = createTexture(1, 1, gl, { filter: gl.NEAREST, repeat: gl.CLAMP_TO_EDGE }, new Uint8Array([0]), gl.LUMINANCE)
    const textureDisposer = { disposer: (tex: Texture) => { if (tex !== defaultTexture) tex.destroy(gl) } };
    const textures = new Map<number, Source<Texture>>();
    const get = (picnum: number) => getOrCreate(textures, picnum, _ => values.transformed(`texture_${picnum}`, art, arts => {
      const info = getOrDefault(arts, picnum, EMPTY_INFO_EXTENDED);
      if (info.h <= 0 || info.w <= 0) return defaultTexture;
      const arr = axisSwap(info.img, info.h, info.w);
      return createTexture(info.w, info.h, gl, { filter: gl.NEAREST, repeat: gl.CLAMP_TO_EDGE }, arr, gl.LUMINANCE)
    }, textureDisposer))
    const parallaxTextures = new Map<string, Source<Texture>>();
    const formatParallaxTextureId = (pics: number[]) => iter(pics).map(i => i.toString()).join(',').reduce((l, r) => l + r, '');
    const getParallaxTexture = (pics: number[]) => getOrCreate(parallaxTextures, formatParallaxTextureId(pics), key => values.transformed(`parallaxTexture_${key}`, art, art => {
      const infos = iter(pics).map(p => art.get(p)).map(i => pair(i, axisSwap(i.img, i.h, i.w))).collect();
      const count = infos.length;
      const [{ w, h }, axisSwapped] = iter(infos).first().get();
      if (!iter(infos).all(([i, _]) => i.w === w && i.h === h))
        return createTexture(w, h, gl, { filter: gl.NEAREST, repeat: gl.CLAMP_TO_EDGE }, axisSwapped, gl.LUMINANCE);
      const merged = mergeParallax(w, h, iter(infos).map(second).collect());
      return createTexture(w * count, h, gl, { filter: gl.NEAREST, repeat: gl.CLAMP_TO_EDGE }, merged, gl.LUMINANCE);
    }, textureDisposer));
    const dispose = async () => seq(() => values.dispose(), () => defaultTexture.destroy(gl))();

    return { pal, plu, trans, art, get, getParallaxTexture, dispose };
  });
}