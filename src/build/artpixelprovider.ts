import { AbstractPixelProvider, BlendFunc } from '../utils/pixelprovider';
import { ArtInfo } from './formats/art';

export class ArtPixelProvider extends AbstractPixelProvider {
  private palTmp = new Uint8Array([0, 0, 0, 255]);
  private trans = new Uint8Array([0, 0, 0, 255]);

  constructor(
    private info: ArtInfo,
    private pal: Uint8Array,
    private plu: (idx: number) => number = x => x
  ) {
    super(info.w, info.h);
  }

  public putToDst(x: number, y: number, dst: Uint8Array, dstoff: number, blend: BlendFunc): void {
    const img = this.info.img;
    const orig = img[y + x * this.info.h];
    if (orig == 255) {
      blend(dst, dstoff, this.trans, 0);
      return;
    }
    const idx = this.plu(orig);
    const paloff = idx * 3;
    this.palTmp[0] = this.pal[paloff];
    this.palTmp[1] = this.pal[paloff + 1];
    this.palTmp[2] = this.pal[paloff + 2];
    blend(dst, dstoff, this.palTmp, 0);
  }
}