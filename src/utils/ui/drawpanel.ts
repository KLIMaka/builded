import { PixelProvider, fromPal, fit } from "../pixelprovider";
import { int } from "../mathutils";
import { drawToCanvas } from "../imgutils";

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

let noneImg = new Uint8Array([
  1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 0, 0, 0, 0, 1, 1,
  1, 0, 1, 0, 0, 1, 0, 1,
  1, 0, 0, 1, 1, 0, 0, 1,
  1, 0, 0, 1, 1, 0, 0, 1,
  1, 0, 1, 0, 0, 1, 0, 1,
  1, 1, 0, 0, 0, 0, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1,
]);

let nonePal = new Uint8Array([255, 255, 255, 255, 0, 0]);
let noneProvider = fromPal(noneImg, nonePal, 8, 8);

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
      let x = e.offsetX;
      let y = e.offsetY;
      let maxcx = int(this.canvas.width / this.cellW);
      let maxcy = int(this.canvas.height / this.cellH);
      let cx = int(x / this.cellW);
      let cy = int(y / this.cellH);
      if (cx >= maxcx || cy >= maxcy) return;
      this.selectCallback(this.firstId + maxcx * cy + cx);
    }
  }

  public setCellSize(w: number, h: number): void {
    this.cellW = w;
    this.cellH = h;
  }

  public setFirstId(id: number): void {
    this.firstId = id;
  }

  public nextPage(): void {
    let cells = int(this.canvas.width / this.cellW) * int(this.canvas.height / this.cellH);
    if (this.firstId + cells >= this.provider.size())
      return;
    this.firstId += cells;
  }

  public prevPage(): void {
    let cells = int(this.canvas.width / this.cellW) * int(this.canvas.height / this.cellH);
    if (this.firstId - cells < 0)
      return;
    this.firstId -= cells;
  }

  public draw(): void {
    let provider = this.provider;
    let canvas = this.canvas;
    let w = canvas.width;
    let h = canvas.height;
    let ctx = canvas.getContext('2d');
    let wcells = int(w / this.cellW);
    let hcells = int(h / this.cellH);
    let cells = wcells * hcells;
    let firstId = this.firstId;
    let lastId = Math.min(firstId + cells, provider.size());

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, w, h);

    for (let i = firstId; i < lastId; i++) {
      let x = ((i - firstId) % wcells) * this.cellW;
      let y = int((i - firstId) / wcells) * this.cellH;
      let img = provider.get(i);
      if (img == null)
        img = noneProvider;
      let pixels = fit(this.cellW, this.cellH, img, new Uint8Array([0, 0, 0, 255]));
      drawToCanvas(pixels, canvas, x, y);
    }
  }

}