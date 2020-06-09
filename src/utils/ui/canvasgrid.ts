import { int } from "../mathutils";
import { take, enumerate } from "../collections";

export type Translator = (x: number, y: number) => [number, number];
export type Widget = (ctx: CanvasRenderingContext2D, trans: Translator) => void;

export class CanvasGrid {
  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly cellWidth: number,
    readonly cellHeight: number,
    private bg = 'black'
  ) { }

  draw(widgets: Iterable<Widget>) {
    const canvas = this.canvas;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const ctx = canvas.getContext('2d');
    const wcells = this.horizontalCells();
    const hcells = this.verticalCells();
    const cells = wcells * hcells;

    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, w, h);

    for (const [widget, i] of enumerate(take(widgets, cells))) {
      const x = (i % wcells) * this.cellWidth;
      const y = int(i / wcells) * this.cellHeight;

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();

      widget(ctx, (x_, y_) => [x - x_, y - y_]);
      ctx.restore();
    }
  }

  horizontalCells() { return int(this.canvas.clientWidth / this.cellWidth) }
  verticalCells() { return int(this.canvas.clientHeight / this.cellHeight) }
}