import { workplane, Workplane, WorkplaneContext, workplaneController } from "@ui/commons";
import { WindowBuilder } from "@ui/windows-common";
import { createContainer } from "ts-utils/callbacks";
import { interpolate, range } from "ts-utils/collections";
import { GL_CONTEXT, Texture } from "@utils/gl/drawstruct";
import { createTexture } from "@utils/gl/textures";
import { homography } from "ts-utils/homography";
import { loadImageFromBuffer } from "ts-utils/imgutils";
import { getInstances, Injector } from "ts-utils/injector";
import { LinearInterpolator, vector2 } from "ts-utils/interpolator";
import { iter } from "ts-utils/iter";
import { int, len2d } from "ts-utils/mathutils";
import { firstNot } from "ts-utils/objects";
import { ACTION_DESCRIPTORS } from "app/apis/actions";
import { APP } from "app/apis/app1";
import { Window } from "app/apis/ui1";
import { mat3, vec3 } from "gl-matrix";
import Optional from "optional-js";
import React, { DragEvent } from "react";
import { RectifierRenderer } from "./rectifier-renderer";

function transform(x: number, off: number, scale: number): number {
  return x * scale + off;
}

function untransform(x: number, off: number, scale: number): number {
  return x / scale - off / scale;
}

function transformRect(rect: Rect, xoff: number, yoff: number, scale: number): Rect {
  return {
    x0: transform(rect.x0, xoff, scale), y0: transform(rect.y0, yoff, scale),
    x1: transform(rect.x1, xoff, scale), y1: transform(rect.y1, yoff, scale),
    x2: transform(rect.x2, xoff, scale), y2: transform(rect.y2, yoff, scale),
    x3: transform(rect.x3, xoff, scale), y3: transform(rect.y3, yoff, scale)
  }
}

function findVertex(rect: Rect, x: number, y: number, r: number): number {
  if (len2d(x - rect.x0, y - rect.y0) <= r) return 0;
  if (len2d(x - rect.x1, y - rect.y1) <= r) return 1;
  if (len2d(x - rect.x2, y - rect.y2) <= r) return 2;
  if (len2d(x - rect.x3, y - rect.y3) <= r) return 3;
  return -1;
}

function getVertex(rect: Rect, vertex: number): [number, number] {
  if (vertex === 0) return [rect.x0, rect.y0];
  if (vertex === 1) return [rect.x1, rect.y1];
  if (vertex === 2) return [rect.x2, rect.y2];
  if (vertex === 3) return [rect.x3, rect.y3];
  throw new Error();
}

function setVertex(rect: Rect, vertex: number, x: number, y: number): void {
  if (vertex === 0) [rect.x0, rect.y0] = [x, y];
  if (vertex === 1) [rect.x1, rect.y1] = [x, y];
  if (vertex === 2) [rect.x2, rect.y2] = [x, y];
  if (vertex === 3) [rect.x3, rect.y3] = [x, y];
}

function calcHomography(rect: Rect, w: number, h: number): mat3 {
  const mat = homography(
    0, 0, rect.x0, rect.y0,
    w, 0, rect.x1, rect.y1,
    w, h, rect.x2, rect.y2,
    0, h, rect.x3, rect.y3
  );
  const scaled = mat.map(x => x / mat[8]);
  return mat3.fromValues(
    scaled[0], scaled[3], scaled[6],
    scaled[1], scaled[4], scaled[7],
    scaled[2], scaled[5], scaled[8],
  );
}

type Rect = { x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number };
function drawLines(ctx: CanvasRenderingContext2D, rect: Rect) {
  const p0 = [rect.x0, rect.y0];
  const p1 = [rect.x1, rect.y1];
  const p2 = [rect.x2, rect.y2];
  const p3 = [rect.x3, rect.y3];
  const inter = vector2(LinearInterpolator);
  const steps = 10;
  const points = iter(range(1, steps)).map(i => i / steps).collect();

  const path = new Path2D();
  iter(interpolate([p0, p1], inter, points))
    .zip(interpolate([p3, p2], inter, points))
    .forEach(([[xs, ys], [xe, ye]]) => {
      path.moveTo(int(xs) + .5, int(ys) + .5);
      path.lineTo(int(xe) + .5, int(ye) + .5);
    });
  iter(interpolate([p0, p3], inter, points))
    .zip(interpolate([p1, p2], inter, points))
    .forEach(([[xs, ys], [xe, ye]]) => {
      path.moveTo(int(xs) + .5, int(ys) + .5);
      path.lineTo(int(xe) + .5, int(ye) + .5);
    });

  ctx.setLineDash([]);
  ctx.strokeStyle = 'white';
  ctx.beginPath();
  ctx.stroke(path);

  ctx.strokeStyle = 'black';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.stroke(path);
}

export async function createRectifier(injector: Injector): Promise<Window> {
  const [app, glCtx, ads] = await getInstances(injector, APP, GL_CONTEXT, ACTION_DESCRIPTORS);

  const values = createContainer('rectifier-model');
  const editMode = values.value('editMode', true);
  const image = values.valueBuilder<Optional<Texture>>({ name: 'image', value: Optional.empty(), disposer: o => o.ifPresent(t => t.destroy(glCtx.gl)) });
  const imageSize = values.transformed('imageSize', image, img => img.map(i => [i.getWidth(), i.getHeight()]).orElse([0, 0]));

  const renderer = new RectifierRenderer(glCtx, image, values);
  await renderer.init();

  const rect = {
    x0: 0, y0: 0,
    x1: 100, y1: 0,
    x2: 100, y2: 100,
    x3: 0, y3: 100,
  }
  const rectValue = values.value('rectValue', rect);
  const rectSize = values.transformed('rectSize', rectValue, rect => [
    (len2d(rect.x0 - rect.x1, rect.y0 - rect.y1) + len2d(rect.x2 - rect.x3, rect.y2 - rect.y3)) / 2,
    (len2d(rect.x0 - rect.x3, rect.y0 - rect.y3) + len2d(rect.x1 - rect.x2, rect.y1 - rect.y2)) / 2]);
  const ctx = values.value('ctx', { xmouse: 0, ymouse: 0, xoff1: 0, yoff1: 0, scale: 1, dragging: false, disable: false, buttons: 0 } as WorkplaneContext);
  const mousePos = values.fields('mousePos', ctx, 'xmouse', 'ymouse');
  const offScale = values.fields('offScale', ctx, 'xoff', 'yoff', 'scale');
  const transformedRect = values.transformedTuple('transformedRect', [rectValue, offScale], ([rect, { xoff1: xoff, yoff1: yoff, scale }]) => transformRect(rect, xoff, yoff, scale))
  const selectedVertex = values.transformedTuple('selectedVertex', [transformedRect, mousePos], ([rect, { xmouse, ymouse }]) => findVertex(rect, xmouse, ymouse, 10));
  const dragVertex = values.transformedSelfTuple('dragVertex', [transformedRect, ctx], -1, ([rect, { xmouse, ymouse, buttons, dragging }], prev) => {
    if (buttons === 0 || dragging) return -1;
    if (buttons === 1) return prev === -1 ? findVertex(rect, xmouse, ymouse, 10) : prev;
    return prev;
  })
  const IDENT = mat3.identity(mat3.create());
  const homo = values.transformedTuple('homo', [rectValue, image], ([rect, img]) => img.map(img => calcHomography(rect, img.getWidth(), img.getHeight())).orElse(IDENT));
  values.handleStandalone([selectedVertex], vtx => ctx.modImmer(c => c.disable = vtx !== -1));
  values.handleStandalone([dragVertex, ctx], ([vertex, ctx]) => {
    if (vertex === -1) return;
    rectValue.modImmer(rect => setVertex(rect, vertex, untransform(ctx.xmouse, ctx.xoff1, ctx.scale), untransform(ctx.ymouse, ctx.yoff1, ctx.scale)))
  });
  values.handleStandalone([image], img => img.ifPresent(img => rectValue.modImmer(r => {
    r.x0 = 0; r.y0 = 0;
    r.x1 = img.getWidth(); r.y1 = 0;
    r.x2 = img.getWidth(); r.y2 = img.getHeight();
    r.x3 = 0; r.y3 = img.getHeight();
  })))

  const original = workplane((canvas, w, h) => {
    const canvasCtx = canvas.getContext('2d');
    return values.handle([transformedRect, selectedVertex, dragVertex, editMode], ([rect, hover, drag, mode]) => {
      canvasCtx.clearRect(0, 0, w, h);
      if (!mode) return;
      firstNot(drag, hover, -1).ifPresent(vtx => {
        const [x, y] = getVertex(rect, vtx);
        canvasCtx.fillStyle = 'white';
        canvasCtx.fillRect(x - 3, y - 3, 6, 6);
        canvasCtx.strokeStyle = 'black';
        canvasCtx.beginPath();
        canvasCtx.rect(x - 4, y - 4, 8, 8);
        canvasCtx.stroke();
      });
    });
  })
  const rectRenderer = workplane((canvas, w, h) => {
    const ctx = canvas.getContext('2d');
    return values.handle([transformedRect, editMode], ([rect, mode]) => {
      ctx.clearRect(0, 0, w, h);
      if (!mode) return;
      drawLines(ctx, rect);
    });
  });
  const imageRenderer = workplane((canvas, w, h) =>
    values.handle([offScale, homo, editMode, imageSize, rectSize], ([ctx, homo, mode, [iw, ih], [rw, rh]]) => {
      renderer.draw(canvas, ctx, !mode ? homo : IDENT, mode ? iw : rw, mode ? ih : rh);
    })
  );
  const rectRenderer1 = workplane((canvas, w, h) =>
    values.handle([homo, ctx, imageSize], ([homo, ctx, [iw, ih]]) => {
      const canvasCtx = canvas.getContext('2d');
      canvasCtx.clearRect(0, 0, w, h);
      const { xmouse, ymouse, xoff1: xoff, yoff1: yoff, scale } = ctx;
      const mpos = vec3.fromValues(untransform(xmouse, xoff, scale), untransform(ymouse, yoff, scale), 1);
      const homoInv = mat3.invert(mat3.create(), homo);
      const transVec = vec3.transformMat3(vec3.create(), mpos, homoInv);
      vec3.scale(transVec, transVec, 1 / transVec[2]);
      if (transVec[0] < 0 || transVec[0] > iw || transVec[1] < 0 || transVec[1] > ih) return;
      const u = vec3.transformMat3(vec3.create(), vec3.fromValues(transVec[0], 0, 1), homo);
      const d = vec3.transformMat3(vec3.create(), vec3.fromValues(transVec[0], ih, 1), homo);
      const l = vec3.transformMat3(vec3.create(), vec3.fromValues(0, transVec[1], 1), homo);
      const r = vec3.transformMat3(vec3.create(), vec3.fromValues(iw, transVec[1], 1), homo);
      vec3.scale(u, u, 1 / u[2]);
      vec3.scale(d, d, 1 / d[2]);
      vec3.scale(l, l, 1 / l[2]);
      vec3.scale(r, r, 1 / r[2]);
      canvasCtx.strokeStyle = 'white';
      canvasCtx.beginPath();
      canvasCtx.moveTo(transform(u[0], ctx.xoff1, ctx.scale), transform(u[1], ctx.yoff1, ctx.scale));
      canvasCtx.lineTo(transform(d[0], ctx.xoff1, ctx.scale), transform(d[1], ctx.yoff1, ctx.scale));
      canvasCtx.moveTo(transform(r[0], ctx.xoff1, ctx.scale), transform(r[1], ctx.yoff1, ctx.scale));
      canvasCtx.lineTo(transform(l[0], ctx.xoff1, ctx.scale), transform(l[1], ctx.yoff1, ctx.scale));
      canvasCtx.stroke();
    })
  );

  async function drop(e: DragEvent) {
    e.preventDefault();
    const { files } = e.dataTransfer;
    const file = files.item(0);
    const [w, h, img] = await loadImageFromBuffer(await file.arrayBuffer());
    image.set(Optional.of(createTexture(w, h, glCtx.gl, { filter: glCtx.gl.LINEAR }, img)));
  }

  async function pasteImage() {
    const clipboardContents = await navigator.clipboard.read();
    const file = clipboardContents[0];
    const blob = await file.getType("image/png");
    const [w, h, img] = await loadImageFromBuffer(await blob.arrayBuffer());
    image.set(Optional.of(createTexture(w, h, glCtx.gl, { filter: glCtx.gl.LINEAR }, img)));
  }


  return new WindowBuilder('rectifier', ads, values)
    .titleFromId()
    .size(800, 800)
    .action('toggle', () => editMode.mod(m => !m))
    .action('paste', () => pasteImage())
    .onClose(() => app.timer.delayed(() => values.dispose()))
    .disposable(renderer)
    .build(
      <div className="column-block" onDrop={drop} onDragOver={e => e.preventDefault()}>
        <Workplane builders={[imageRenderer, rectRenderer, rectRenderer1, original, workplaneController(ctx)]} />
      </div>
    );
}
