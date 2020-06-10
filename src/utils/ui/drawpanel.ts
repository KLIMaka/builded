import { Deck, map } from "../collections";
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

export enum ScrollType {
  ITEM,
  ROW,
  PAGE
}

export class DrawPanel {
  private offset = 0;
  private pageIds: Deck<number> = new Deck();

  constructor(
    private canvas: HTMLCanvasElement,
    private idsProvider: () => Iterable<number>,
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
      if (e.deltaY > 0) this.scroll(1, e.shiftKey ? ScrollType.PAGE : ScrollType.ROW);
      else if (e.deltaY < 0) this.scroll(-1, e.shiftKey ? ScrollType.PAGE : ScrollType.ROW);
    }
  }

  private prepareIds() {
    this.pageIds.clear().pushAll(
      iter(this.idsProvider())
        .skip(this.offset)
        .take(this.cellsOnPage()));
  }

  private calcIdx(x: number, y: number) {
    const cx = int(x / this.cellW);
    const cy = int(y / this.cellH);
    const idx = cy * this.horizontalCells() + cx;
    return idx < this.pageIds.length() ? this.pageIds.get(idx) : -1;
  }

  private horizontalCells() { return int(this.canvas.clientWidth / this.cellW) }
  private verticalCells() { return int(this.canvas.clientHeight / this.cellH) }
  private cellsOnPage() { return this.horizontalCells() * this.verticalCells() }

  private getDelta(type: ScrollType): number {
    switch (type) {
      case ScrollType.ITEM: return 1;
      case ScrollType.ROW: return this.horizontalCells();
      case ScrollType.PAGE: return this.cellsOnPage();
    }
  }

  public seOffset(offset: number): void { this.offset = offset }

  public scroll(off: number, type: ScrollType) {
    const d = off * this.getDelta(type);
    let newOffset = this.offset;
    if (d > 0) {
      iter(this.idsProvider())
        .skip(this.offset + this.cellsOnPage())
        .take(d)
        .forEach(_ => newOffset++);
    } else {
      newOffset = Math.max(0, newOffset + d);
    }
    if (this.offset != newOffset) {
      this.offset = newOffset;
      this.draw();
    }
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
    this.prepareIds();
    drawGrid(this.canvas, map(this.pageIds, i => this.render(i)), this.cellW, this.cellH);
  }
}