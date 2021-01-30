import { ArtFiles, ArtInfo, Attributes } from "../../build/formats/art";
import { rect } from "../../utils/collections";
import { Texture } from "../../utils/gl/drawstruct";
import { createTexture, TextureImpl } from "../../utils/gl/textures";
import { IndexedImgLib, INDEXED_IMG_LIB } from "../../utils/imglib";
import { create, Dependency, lifecycle } from "../../utils/injector";
import { warning } from "../../utils/logger";
import { int } from "../../utils/mathutils";
import { ArtProvider } from "../apis/app";

export const GL = new Dependency<WebGLRenderingContext>('GL');
export const ART_FILES = new Dependency<ArtFiles>('ArtFiles');
export type TextureProvider = (id: number) => Texture;
export const TEXTURES_OVERRIDE = new Dependency<TextureProvider>('Textures Override');
export const PARALLAX_TEXTURES = new Dependency<number>('Number of parallax textures');

export function createIndexedTexture(gl: WebGLRenderingContext, w: number, h: number, arr: Uint8Array, mipmaps = true, lib: IndexedImgLib): Texture {
  const repeat = WebGLRenderingContext.CLAMP_TO_EDGE;
  const filter = mipmaps ? WebGLRenderingContext.NEAREST_MIPMAP_NEAREST : WebGLRenderingContext.NEAREST;
  const tex = createTexture(w, h, gl, { filter: filter, repeat: repeat }, arr, gl.LUMINANCE);
  if (mipmaps) addMipMaps(gl, w, h, arr, tex, lib);
  return tex;
}

function addMipMaps(gl: WebGLRenderingContext, w: number, h: number, arr: Uint8Array, tex: TextureImpl, lib: IndexedImgLib) {
  let level = 1;
  while (w >= 1 || h >= 1) {
    const nw = int(w / 2);
    const dw = Math.max(1, nw);
    const nh = int(h / 2);
    const dh = Math.max(1, nh);
    const mip = lib.resize(dw, dh, w, h, arr);
    tex.mip(gl, level, dw, dh, mip);
    arr = mip;
    w = nw;
    h = nh;
    level++;
  }
}

export const BuildArtProviderConstructor = lifecycle(async (injector, lifecycle) => {
  return lifecycle(await create(injector, BuildArtProvider, ART_FILES, TEXTURES_OVERRIDE, GL, PARALLAX_TEXTURES, INDEXED_IMG_LIB), async p => p.stop());
});

export class BuildArtProvider implements ArtProvider {
  private textures: Texture[] = [];
  private parallaxTextures: Texture[] = [];
  private infos: ArtInfo[] = [];

  constructor(
    private arts: ArtFiles,
    private addTextures: TextureProvider,
    private gl: WebGLRenderingContext,
    private parallaxPics: number,
    private lib: IndexedImgLib) {
  }

  public stop() {
    this.textures.forEach(t => t.destroy(this.gl));
    this.parallaxTextures.forEach(t => t.destroy(this.gl));
  }

  public get(picnum: number): Texture {
    const add = this.addTextures(picnum);
    if (add != undefined) return add;
    let tex = this.textures[picnum];
    if (tex != undefined) return tex;

    const info = this.arts.getInfo(picnum);
    if (info.h <= 0 || info.w <= 0) return this.get(0);
    const arr = this.axisSwap(info.img, info.h, info.w);
    tex = createIndexedTexture(this.gl, info.w, info.h, arr, false, this.lib);

    this.textures[picnum] = tex;
    return tex;
  }

  public getParallaxTexture(picnum: number): Texture {
    let tex = this.parallaxTextures[picnum];
    if (tex != undefined) return tex;

    const infos: ArtInfo[] = [];
    const axisSwapped: Uint8Array[] = [];
    for (let i = 0; i < this.parallaxPics; i++) {
      infos[i] = this.arts.getInfo(picnum + i);
      if (i != 0) {
        if (infos[i].w != infos[i - 1].w || infos[i].h != infos[i - 1].h) {
          warning(`Invalid parallax texture #${picnum}`);
          return this.get(0);
        }
      }
      axisSwapped[i] = this.axisSwap(infos[i].img, infos[i].h, infos[i].w);
    }
    const w = infos[0].w;
    const h = infos[0].h;
    const merged = this.mergeParallax(w, h, axisSwapped);
    tex = createIndexedTexture(this.gl, w * this.parallaxPics, h, merged, false, this.lib);

    this.parallaxTextures[picnum] = tex;
    return tex;
  }

  private mergeParallax(w: number, h: number, arrs: Uint8Array[]): Uint8Array {
    const result = new Uint8Array(w * h * this.parallaxPics);
    for (let y = 0; y < h; y++) {
      for (let i = 0; i < this.parallaxPics; i++) {
        for (let x = 0; x < w; x++) result[y * w * this.parallaxPics + i * w + x] = arrs[i][y * w + x]
      }
    }
    return result;
  }

  private axisSwap(data: Uint8Array, w: number, h: number): Uint8Array {
    const result = new Uint8Array(w * h);
    for (const [x, y] of rect(w, h))
      result[x * h + y] = data[y * w + x];
    return result;
  }

  public getInfo(picnum: number): ArtInfo {
    let info = this.infos[picnum];
    if (info != undefined) return info;
    const add = this.addTextures(picnum);
    info = add != undefined
      ? new ArtInfo(add.getWidth(), add.getHeight(), new Attributes(), (<TextureImpl>add).data)
      : this.arts.getInfo(picnum);
    this.infos[picnum] = info;
    return info;
  }
}
