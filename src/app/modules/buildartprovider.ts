import { Dependency, Injector } from "../../utils/injector";
import { warning } from "../../utils/logger";
import { createTexture } from "../../utils/gl/textures";
import { ArtProvider } from "../apis/app";
import { ArtFiles, ArtInfo, Attributes } from "../../build/art";
import { rect } from "../../utils/collections";
import { Texture } from "../../utils/gl/drawstruct";

export const GL_ = new Dependency<WebGLRenderingContext>('GL');
export const ArtFiles_ = new Dependency<ArtFiles>('ArtFiles');
export const UtilityTextures_ = new Dependency<{ [index: number]: Texture }>('UtilityTextures');
export const ParallaxTextures_ = new Dependency<number>('Number of parallax textures');

export async function BuildArtProviderConstructor(injector: Injector) {
  const [art, util, gl, parallax] = await Promise.all([
    injector.getInstance(ArtFiles_),
    injector.getInstance(UtilityTextures_),
    injector.getInstance(GL_),
    injector.getInstance(ParallaxTextures_)]);
  return new BuildArtProvider(art, util, gl, parallax);
}

export class BuildArtProvider implements ArtProvider {
  private textures: Texture[] = [];
  private parallaxTextures: Texture[] = [];
  private infos: ArtInfo[] = [];

  constructor(
    private arts: ArtFiles,
    private addTextures: { [index: number]: Texture },
    private gl: WebGLRenderingContext,
    private parallaxPics: number) { }

  private createTexture(w: number, h: number, arr: Uint8Array): Texture {
    const repeat = WebGLRenderingContext.CLAMP_TO_EDGE;
    const filter = WebGLRenderingContext.NEAREST;
    return createTexture(w, h, this.gl, { filter: filter, repeat: repeat }, arr, this.gl.LUMINANCE);
  }

  public get(picnum: number): Texture {
    const add = this.addTextures[picnum];
    if (add != undefined) return add;
    let tex = this.textures[picnum];
    if (tex != undefined) return tex;

    const info = this.arts.getInfo(picnum);
    if (info.h <= 0 || info.w <= 0) return this.get(0);
    const arr = this.axisSwap(info.img, info.h, info.w);
    tex = this.createTexture(info.w, info.h, arr);

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
    tex = this.createTexture(w * this.parallaxPics, h, merged);

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
      ? new ArtInfo(add.getWidth(), add.getHeight(), new Attributes(), null)
      : this.arts.getInfo(picnum);
    this.infos[picnum] = info;
    return info;
  }
}
