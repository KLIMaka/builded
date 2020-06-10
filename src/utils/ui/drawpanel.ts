import { range } from "../collections";
import { drawToCanvas } from "../imgutils";
import { iter } from "../iter";
import { int } from "../mathutils";
import { BlendAlpha, fit, PixelProvider } from "../pixelprovider";
import { drawGrid, Translator } from "./canvasgrid";

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

export class DrawPanel {
  private offset = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private idsProvider: Iterable<number>,
    private provider: PixelDataProvider,
    private selectCallback: (id: number) => void,
    private cellW = 64,
    private cellH = 64,
  ) {
    canvas.onclick = (e: MouseEvent) => {
      const idx = this.calcIdx(e.offsetX, e.offsetY);
      if (idx != -1) this.selectCallback(idx);
    }
    canvas.onwheel = (e: WheelEvent) => {
      if (e.deltaY > 0) {
        this.nextRow();
      } else if (e.deltaY < 0) {
        this.lastRow();
      }
    }
  }

  private calcIdx(x: number, y: number) {
    const maxcx = this.horizontalCells();
    const maxcy = this.verticalCells();
    const cx = int(x / this.cellW);
    const cy = int(y / this.cellH);
    if (cx >= maxcx || cy >= maxcy) return -1;
    return this.offset + maxcx * cy + cx
  }

  private horizontalCells() { return int(this.canvas.clientWidth / this.cellW) }
  private verticalCells() { return int(this.canvas.clientHeight / this.cellH) }
  public setFirstId(id: number): void { this.offset = id }
  private cellsOnPage() { return this.horizontalCells() * this.verticalCells() }

  public nextRow(): void {
    const off = this.horizontalCells();
    if (this.offset + off >= this.provider.size()) return;
    this.offset += off;
    this.draw();
  }

  public lastRow(): void {
    const off = this.horizontalCells();
    if (this.offset - off < 0) return;
    this.offset -= off;
    this.draw();
  }

  public nextPage(): void {
    const cells = this.cellsOnPage()
    if (this.offset + cells >= this.provider.size()) return;
    this.offset += cells;
  }

  public prevPage(): void {
    const cells = this.cellsOnPage();
    if (this.offset - cells < 0) return;
    this.offset -= cells;
  }

  private render(id: number) {
    const cw = this.cellW;
    const ch = this.cellH;
    return (ctx: CanvasRenderingContext2D, t: Translator) => {
      const [x, y] = t(0, 0);
      ctx.font = "8px Arial";
      ctx.fillStyle = 'white';
      ctx.textAlign = "center";
      const img = this.provider.get(id);
      if (img != null) {
        const pixels = fit(cw, ch - 8, img, new Uint8Array([0, 0, 0, 255]));
        drawToCanvas(pixels, ctx, x, y, BlendAlpha);
      }
      ctx.fillText(id + "", x + cw / 2, y + ch);
    }
  }

  public draw(): void {
    const widgets = iter(this.idsProvider)
      .skip(this.offset)
      .take(this.cellsOnPage())
      .map(id => this.render(id));
    drawGrid(this.canvas, widgets, this.cellW, this.cellH);
  }
}