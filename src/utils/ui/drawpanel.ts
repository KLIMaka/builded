import { range } from "../collections";
import { drawToCanvas } from "../imgutils";
import { iter } from "../iter";
import { int } from "../mathutils";
import { fit, fromPal, PixelProvider, BlendAlpha } from "../pixelprovider";
import { CanvasGrid, Translator } from "./canvasgrid";

export class PixelDataProvider {

  constructor(
    private s: number,
    private f: (i: number) => PixelProvider
  ) { }

  public size(): number {
    return this.s;
  }

  public get(i: number): PixelProvider {
    return this.f(i);
  }
}

const noneImg = new Uint8Array([
  1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 0, 0, 0, 0, 1, 1,
  1, 0, 1, 0, 0, 1, 0, 1,
  1, 0, 0, 1, 1, 0, 0, 1,
  1, 0, 0, 1, 1, 0, 0, 1,
  1, 0, 1, 0, 0, 1, 0, 1,
  1, 1, 0, 0, 0, 0, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1,
]);

const nonePal = new Uint8Array([255, 255, 255, 255, 0, 0]);
const noneProvider = fromPal(noneImg, nonePal, 8, 8);

export class DrawPanel {
  private firstId = 0;

  constructor(
    private grid: CanvasGrid,
    private provider: PixelDataProvider,
    private selectCallback: (id: number) => void,
  ) {
    grid.canvas.onclick = (e: MouseEvent) => {
      const idx = this.calcIdx(e.offsetX, e.offsetY);
      if (idx != -1) this.selectCallback(idx);
    }
    grid.canvas.onwheel = (e: WheelEvent) => {
      if (e.deltaY > 0) {
        this.nextRow();
      } else if (e.deltaY < 0) {
        this.lastRow();
      }
    }
  }

  private calcIdx(x: number, y: number) {
    const maxcx = this.grid.horizontalCells();
    const maxcy = this.grid.verticalCells();
    const cx = int(x / this.grid.cellWidth);
    const cy = int(y / this.grid.cellHeight);
    if (cx >= maxcx || cy >= maxcy) return -1;
    return this.firstId + maxcx * cy + cx
  }

  public setFirstId(id: number): void {
    this.firstId = id;
  }

  private cellsOnPage() {
    return this.grid.horizontalCells() * this.grid.verticalCells();
  }

  private cellsOnRow() {
    return this.grid.horizontalCells();
  }

  public nextRow(): void {
    const off = this.cellsOnRow();
    if (this.firstId + off >= this.provider.size()) return;
    this.firstId += off;
    this.draw();
  }

  public lastRow(): void {
    const off = this.cellsOnRow();
    if (this.firstId - off < 0) return;
    this.firstId -= off;
    this.draw();
  }

  public nextPage(): void {
    const cells = this.cellsOnPage()
    if (this.firstId + cells >= this.provider.size()) return;
    this.firstId += cells;
  }

  public prevPage(): void {
    const cells = this.cellsOnPage();
    if (this.firstId - cells < 0) return;
    this.firstId -= cells;
  }

  public draw(): void {
    const cw = this.grid.cellWidth;
    const ch = this.grid.cellHeight;
    this.grid.draw(
      iter(range(0, this.provider.size()))
        .skip(this.firstId)
        .take(this.cellsOnPage())
        .map(i => {
          return (ctx: CanvasRenderingContext2D, t: Translator) => {
            const [x, y] = t(0, 0);
            ctx.font = "8px Arial";
            ctx.fillStyle = 'white';
            ctx.textAlign = "center";
            let img = this.provider.get(i);
            if (img == null) img = noneProvider;
            const pixels = fit(cw, ch, img, new Uint8Array([0, 0, 0, 255]));
            drawToCanvas(pixels, ctx, x, y, BlendAlpha);
            ctx.fillText(i + "", x + cw / 2, y + ch - 4);
          }
        })
    );
  }

}