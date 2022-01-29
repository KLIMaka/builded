import { Raster, rasterizeRGBA8, rect, resize } from "../../../utils/pixelprovider";
import { addDragController } from "../../../utils/ui/ui";
import { PushWallModule } from "../../edit/tools/pushwall";

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

export type WorkplaneRenderer = (canvas: HTMLCanvasElement, xoff: number, yoff: number, scale: number) => void;

export function rasterWorkplaneRenderer(raster: Raster<number>): WorkplaneRenderer {
  const cache = createImageDataCache();
  return (canvas, xoff, yoff, scale) => {
    const ctx = canvas.getContext('2d');
    const scaled = resize(raster, raster.width * scale, raster.height * scale);
    const framed = rect(scaled, -xoff, -yoff, canvas.height - xoff, canvas.height - yoff, 0);
    const id = cache(canvas.width, canvas.height);
    rasterizeRGBA8(framed, id.data.buffer);
    ctx.putImageData(id, 0, 0);
  }
}

export class Workplane {
  private scale = 1;
  private xoff = 0;
  private yoff = 0;

  constructor(
    private plane: HTMLCanvasElement,
    private renderer: WorkplaneRenderer
  ) {
    addDragController(plane, (posx, posy, dx, dy, dscale) => {
      const cx = posx - plane.width / 2;
      const cy = posy - plane.height / 2;
      const ds = this.scale * dscale - this.scale;
      this.xoff += dx - cx * ds;
      this.yoff += dy - cy * ds;
      this.scale *= dscale;
      console.log(this.xoff, this.yoff, this.scale);
      this.redraw();
    });
    this.redraw();
  }

  public redraw() {
    this.renderer(this.plane, this.xoff, this.yoff, this.scale);
  }
}