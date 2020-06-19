import { int } from "../mathutils";
import { take, enumerate } from "../collections";

export type Widget = (ctx: CanvasRenderingContext2D, x: number, y: number) => void;

export function drawGrid(canvas: HTMLCanvasElement, widgets: Iterable<Widget>, cw: number, ch: number, bg = 'black') {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const ctx = canvas.getContext('2d');
  const wcells = int(w / cw);
  const hcells = int(h / ch);
  const cells = wcells * hcells;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  for (const [widget, i] of enumerate(take(widgets, cells))) {
    const x = (i % wcells) * cw;
    const y = int(i / wcells) * ch;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    widget(ctx, x, y);
    ctx.restore();
  }
}