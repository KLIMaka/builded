import { handle, value } from "../../../utils/callbacks";
import { Raster, rect, resize } from "../../../utils/pixelprovider";

export type WorkplaneRenderer = (canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number) => void;

function createImageDataCache() {
  let id: ImageData = null;
  let buffer: Uint8ClampedArray = null;
  return (w: number, h: number) => {
    if (id != null && id.width == w && id.height == h) {
      return id;
    } else if (id != null && buffer.length == w * h * 4) {
      id = new ImageData(buffer, w, h);
      return id;
    } else {
      buffer = new Uint8ClampedArray(w * h * 4);
      id = new ImageData(buffer, w, h);
      return id;
    }
  }
}

function rasterize(raster: Raster<number>, out: ArrayBuffer) {
  const u32 = new Uint32Array(out);
  let off = 0;
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      u32[off++] = raster.pixel(x, y);
    }
  }
}

export function RasterWorkplaneRenderer(raster: Raster<number>): WorkplaneRenderer {
  const cache = createImageDataCache();
  return (canvas, x, y, w, h) => {
    const ctx = canvas.getContext('2d');
    const framed = rect(raster, x, y, w, h, 0);
    const scaled = resize(framed, canvas.width, canvas.height);
    const id = cache(canvas.width, canvas.height);
    rasterize(scaled, id.data.buffer);
    ctx.putImageData(id, 0, 0);
  }
}

export class Workplane {
  private scale = value(1);
  private xoff = value(0);
  private yoff = value(0);

  constructor(
    private plane: HTMLCanvasElement,
    private renderer: WorkplaneRenderer
  ) { }

  private setup() {
    handle(null, (p, scale, xoff, yoff) => {
      const x = xoff * scale;
      const y = yoff * scale;
      const w = this.plane.width * scale;
      const h = this.plane.height * scale;
      this.renderer(this.plane, x, y, w, h);
    }, this.scale, this.xoff, this.yoff);
  }

}