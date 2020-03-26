import { ArtFiles, ArtInfo, Attributes } from "../../build/formats/art";
import { rect } from "../../utils/collections";
import { convertPal, resizeIndexed, rgb2xyz, xyz2lab } from "../../utils/color";
import { Texture } from "../../utils/gl/drawstruct";
import { createTexture, TextureImpl } from "../../utils/gl/textures";
import { Dependency, Injector } from "../../utils/injector";
import { warning } from "../../utils/logger";
import { int } from "../../utils/mathutils";
import { ArtProvider } from "../apis/app";
import { RAW_PAL } from "./artselector";
import init, { ImgLib } from "../../libs_js/wasm_lib";

export const GL = new Dependency<WebGLRenderingContext>('GL');
export const ArtFiles_ = new Dependency<ArtFiles>('ArtFiles');
export const UtilityTextures_ = new Dependency<{ [index: number]: Texture }>('UtilityTextures');
export const ParallaxTextures_ = new Dependency<number>('Number of parallax textures');

export function createIndexedTexture(gl: WebGLRenderingContext, w: number, h: number, arr: Uint8Array, pal: number[], labpal: number[], mipmaps = true, lib: ImgLib): Texture {
  const repeat = WebGLRenderingContext.CLAMP_TO_EDGE;
  const filter = mipmaps ? WebGLRenderingContext.NEAREST_MIPMAP_NEAREST : WebGLRenderingContext.NEAREST;
  const tex = createTexture(w, h, gl, { filter: filter, repeat: repeat }, arr, gl.LUMINANCE);
  if (mipmaps) addMipMaps(gl, w, h, arr, tex, pal, labpal, lib);
  return tex;
}

function addMipMaps(gl: WebGLRenderingContext, w: number, h: number, arr: Uint8Array, tex: TextureImpl, pal: number[], labpal: number[], lib: ImgLib) {
  let div = 2;
  let level = 1;
  while (int(w / div) >= 1 || int(h / div) >= 1) {
    const dw = Math.max(1, int(w / div));
    const dh = Math.max(1, int(h / div));
    const mip = new Uint8Array(dw * dh);
    lib.resize(dw, dh, mip, w, h, arr);
    // const mip = resizeIndexed(dw, dh, w, h, arr, pal, labpal);
    tex.mip(gl, level, dw, dh, mip);
    div *= 2;
    level++;
  }
}

export async function BuildArtProviderConstructor(injector: Injector) {
  const [art, util, gl, parallax, pal] = await Promise.all([
    injector.getInstance(ArtFiles_),
    injector.getInstance(UtilityTextures_),
    injector.getInstance(GL),
    injector.getInstance(ParallaxTextures_),
    injector.getInstance(RAW_PAL),
    init()]);
  const lib = ImgLib.init(pal, 256);
  return new BuildArtProvider(art, util, gl, parallax, pal, lib);
}

export class BuildArtProvider implements ArtProvider {
  private textures: Texture[] = [];
  private parallaxTextures: Texture[] = [];
  private infos: ArtInfo[] = [];
  private pal: number[];
  private labpal: number[];

  constructor(
    private arts: ArtFiles,
    private addTextures: { [index: number]: Texture },
    private gl: WebGLRenderingContext,
    private parallaxPics: number,
    pal: Uint8Array,
    private lib: ImgLib) {
    this.pal = [...pal];
    const xyzPal = convertPal(this.pal, rgb2xyz);
    this.labpal = convertPal(xyzPal, xyz2lab);
  }

  public get(picnum: number): Texture {
    const add = this.addTextures[picnum];
    if (add != undefined) return add;
    let tex = this.textures[picnum];
    if (tex != undefined) return tex;

    const info = this.arts.getInfo(picnum);
    if (info.h <= 0 || info.w <= 0) return this.get(0);
    const arr = this.axisSwap(info.img, info.h, info.w);
    tex = createIndexedTexture(this.gl, info.w, info.h, arr, this.pal, this.labpal, true, this.lib);

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
    tex = createIndexedTexture(this.gl, w * this.parallaxPics, h, merged, this.pal, this.labpal, true, this.lib);

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
    const add = this.addTextures[picnum];
    info = add != undefined
      ? new ArtInfo(add.getWidth(), add.getHeight(), new Attributes(), (<TextureImpl>add).data)
      : this.arts.getInfo(picnum);
    this.infos[picnum] = info;
    return info;
  }
}
