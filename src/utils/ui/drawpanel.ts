import { drawToCanvas } from "../imgutils";
import { int } from "../mathutils";
import { fit, fromPal, PixelProvider } from "../pixelprovider";

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

  private cellW: number;
  private cellH: number;
  private firstId = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private provider: PixelDataProvider,
    private selectCallback: (id: number) => void
  ) {
    canvas.onclick = (e: MouseEvent) => {
      const x = e.offsetX;
      const y = e.offsetY;
      const maxcx = int(this.canvas.clientWidth / this.cellW);
      const maxcy = int(this.canvas.clientHeight / this.cellH);
      const cx = int(x / this.cellW);
      const cy = int(y / this.cellH);
      if (cx >= maxcx || cy >= maxcy) return;
      this.selectCallback(this.firstId + maxcx * cy + cx);
    }
    canvas.onwheel = (e: WheelEvent) => {
      if (e.deltaY > 0) {
        this.nextRow();
      } else if (e.deltaY < 0) {
        this.lastRow();
      }
    }
  }

  public setCellSize(w: number, h: number): void {
    this.cellW = w;
    this.cellH = h;
  }

  public setFirstId(id: number): void {
    this.firstId = id;
  }

  private cellsOnPage() {
    return int(this.canvas.clientWidth / this.cellW) * int(this.canvas.clientHeight / this.cellH);
  }

  private cellsOnRow() {
    return int(this.canvas.clientWidth / this.cellW);
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
    const provider = this.provider;
    const canvas = this.canvas;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const ctx = canvas.getContext('2d');
    const wcells = int(w / this.cellW);
    const hcells = int(h / this.cellH);
    const cells = wcells * hcells;
    const firstId = this.firstId;
    const lastId = Math.min(firstId + cells, provider.size());

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, w, h);
    ctx.font = "8px Arial";
    ctx.fillStyle = 'white';
    ctx.textAlign = "center";

    for (let i = firstId; i < lastId; i++) {
      const x = ((i - firstId) % wcells) * this.cellW;
      const y = int((i - firstId) / wcells) * this.cellH;
      let img = provider.get(i);
      if (img == null) img = noneProvider;
      const pixels = fit(this.cellW, this.cellH, img, new Uint8Array([0, 0, 0, 255]));
      drawToCanvas(pixels, canvas, x, y);
      ctx.fillText(i + "", x + this.cellW / 2, y + this.cellH - 4);
    }
  }

}