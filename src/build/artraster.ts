import { Raster } from '../utils/pixelprovider';
import { ArtInfo } from './formats/art';

export class ArtRaster implements Raster<number> {
  readonly width: number;
  readonly height: number;
  constructor(private art: ArtInfo) {
    this.width = art.w;
    this.height = art.h;
  }
  pixel(x: number, y: number) { return this.art.img[y + x * this.art.h] };
}

export function art(art: ArtInfo) {
  return new ArtRaster(art);
}