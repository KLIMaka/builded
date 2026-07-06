import { ACTION_DESCRIPTORS } from "app/apis/actions";
import { APP } from "app/apis/app";
import { EngineContext, Palette } from "app/apis/engine";
import { UI, Window } from "app/apis/ui";
import { VALUES } from "app/apis/values";
import { readKvx } from "build/formats/kvx";
import { vec2 } from "gl-matrix";
import React, { ReactElement } from "react";
import { Source, Value } from "ts-utils/callbacks";
import { range } from "ts-utils/collections";
import { cookbook } from "ts-utils/cookbook";
import { getInstances, Injector } from "ts-utils/injector";
import { iter } from "ts-utils/iter";
import { Task } from "ts-utils/scheduler";
import { Stream } from "ts-utils/stream";
import { Fn, notNull, Result } from "ts-utils/types";
import { orbitController } from "utils/camera/controller-orbit";
import { GL_CONTEXT } from "utils/gl/drawstruct";
import { BoardRenderer3D } from "../board-view/boardRenderer3d";
import { Axes } from "../board-view/ui/axes";
import { waitFor } from "../scheduler/ui/task-propgress";
import { ActionItem } from "../ui/action-list";
import { canvasWorkplane, Column, Icon, Row, Spacer, useValue, Workplane, WorkplaneBuilder } from "../ui/commons";
import { MenuButton } from "../ui/menu-button";
import { WindowBuilder } from "../ui/windows-common";

function KvxView(props: {
  builders: WorkplaneBuilder[],
  angles: Source<vec2>,
  pluLabel: Source<ReactElement>,
  pluMenuOpen: Value<boolean>,
  pluItems: Source<ActionItem[]>,
  voxelsCount: Source<number>,
}) {
  const voxelsCount = useValue(props.voxelsCount);
  return (
    <Column>
      <Row className='window-toolbar flex-auto'>
        <MenuButton openValue={props.pluMenuOpen} label={props.pluLabel} items={props.pluItems} />
      </Row>
      <Column style={{ position: 'relative' }}>
        <Workplane builders={props.builders} />
        <div style={{ position: 'absolute', left: 0, bottom: 0, padding: '15px' }} ><Axes cameraAngles={props.angles} /></div>
      </Column>
      <div className='row-block window-footer flex-auto gap-5'>
        <Spacer />
        <div className='padded-5'>{`${voxelsCount}`} Voxels</div>
      </div>
    </Column>
  );
}

export async function createKvxView(injector: Injector, ctx: EngineContext, rendererProvider: Task<Source<BoardRenderer3D>>, kvxName: string): Promise<Result<Window>> {
  const [values, app, actionDescriptors, glContext, ui] = await getInstances(injector, VALUES, APP, ACTION_DESCRIPTORS, GL_CONTEXT, UI);
  return values.create(`kvx-view`).initializeAsync(async v => {
    const task = app.scheduler.exec(cookbook(book => {
      const kvx = book.recepie('Loading kvx', [], async () => readKvx(new Stream((await ctx.resources.get().read(kvxName)).get())));
      const renderer = book.paste([], rendererProvider);
      return book.recepie('Constructing window', [kvx, renderer], async (kvx, renderer) => {
        const currentPluValue = v.value('current-plu', 0);
        const model = v.transformed('model', currentPluValue, plu => renderer.get().writeVoxelPreview(kvx, plu, glContext), { disposer: m => m.dispose() });
        const orbit = orbitController(v);
        const voxels = v.value('voxels-count', kvx.list().length);

        const canvasValue = v.valueBuilder<HTMLCanvasElement | undefined>({ name: 'canvasValue', value: undefined });
        const boardView = canvasWorkplane((canvas, w, h) => {
          canvasValue.set(canvas);
          orbit.size.set([w, h]);
          return () => canvasValue.set(undefined);
        });

        const overlayView: WorkplaneBuilder = (width, height, key) =>
          <canvas height={height} width={width} style={{ position: 'absolute' }} key={key}
            onMouseMove={e => orbit.track(e.nativeEvent.offsetX, e.nativeEvent.offsetY, e.nativeEvent.buttons === 2)}
            onWheel={e => orbit.trackZoom(e.nativeEvent.deltaY > 0 ? 10 : -10)}
            onContextMenu={e => e.preventDefault()} />

        const pluProvider = v.transformedTuple('pluProvider', [ctx.plus, currentPluValue],
          ([plus, plu]) => { const actualPlu = iter(plus).first(p => p.id === plu).orElse(plus[0]).plu; return (x: number) => (x >= 255 || x < 0) ? 255 : actualPlu[x] });
        const colors = canvasWorkplane((canvas, w, h) => {
          const render = (pal: Uint8Array, plu: Fn<number, number>) => {
            const ctx = notNull(canvas.getContext('2d'));
            ctx.clearRect(0, 0, w, h);

            const palByLum = [...range(0, 255)];
            const voxels = kvx.list();

            const stats: number[] = new Array(256).fill(0);
            iter(voxels).forEach(x => stats[x.color]++);
            stats[255] = 0;
            const max = Math.max(...stats);
            iter(palByLum).enumerate().forEach(([p, i]) => {
              const or = pal[p * 3];
              const og = pal[p * 3 + 1];
              const ob = pal[p * 3 + 2];
              ctx.fillStyle = `rgb(${or} ${og} ${ob})`;
              ctx.fillRect(i * 2, h - 4, 2, 4);
              const r = pal[plu(p) * 3];
              const g = pal[plu(p) * 3 + 1];
              const b = pal[plu(p) * 3 + 2];
              ctx.fillStyle = `rgb(${r} ${g} ${b})`;
              const bar = 4 + Math.ceil(stats[p] / max * 40);
              ctx.fillRect(i * 2, h - bar - 4, 2, bar);
              ctx.fillStyle = `white`;
              ctx.fillRect(i * 2, h - bar - 1 - 4, 2, 1);
            })
          }
          return v.handle([ctx.pal, pluProvider], ([pal, plu]) => render(pal, plu));
        })

        const gl = glContext.gl;
        const redrawProc = v.transformedTuple('redraw', [orbit.size, orbit.projection, orbit.view, canvasValue, renderer],
          ([size, projection, view, canvas, renderer]) => () => {
            if (!canvas) return;

            const [width, height] = size;
            const { offscreen } = glContext;
            offscreen.width = width;
            offscreen.height = height;

            renderer.screenSize(width, height);
            renderer.time(app.timer.now() % 10000.0);
            renderer.projection(projection);
            renderer.view(view);

            gl.viewport(0, 0, width, height);
            gl.clearColor(0, 0, 0, 1.0);
            gl.clearDepth(1);
            gl.clearStencil(0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

            model.get().render(gl);

            canvas
              ?.getContext('bitmaprenderer')
              ?.transferFromImageBitmap(offscreen.transferToImageBitmap());
          });

        const pluMenuOpen = v.value('pluMenuOpen', false);
        const pluLabel = v.transformedTuple('pluLabel', [currentPluValue, ctx.plus], ([pid, plus]) =>
          <Row className='gap-10 baseline-aligned flex-nowrap' style={{ width: '100px' }}>
            <Icon icon='palette' />
            <div className='text-ellipsis'>{plus[pid].name}</div>
          </Row>)
        const item = (plu: Palette, pid: number, currentPlu: number): ActionItem => {
          return {
            selected: pid === currentPlu,
            element: <div className="row-block baseline-aligned gap-5"><div>{plu.name}</div></div>,
            action: () => currentPluValue.set(pid),
          }
        }
        const pluItems = v.transformedTuple('pluItems', [ctx.plus, currentPluValue], ([plus, currentPlu]) =>
          iter(plus).enumerate().map(([p, pid]) => item(p, pid, currentPlu)).collect());

        const redrawTask = app.timer.onFrame(_ => redrawProc.get()());
        redrawTask.onError(e => app.logger.log('ERROR', e));
        redrawTask.start();

        return new WindowBuilder('kvx-view', actionDescriptors, v)
          .title(kvxName)
          .size(800, 600)
          .minSize(400, 400)
          .disposable(v)
          .disposable(redrawTask)
          .build(<KvxView
            builders={[boardView, colors, overlayView]}
            angles={orbit.angles}
            pluMenuOpen={pluMenuOpen}
            pluLabel={pluLabel}
            pluItems={pluItems}
            voxelsCount={voxels}
          />)
      });
    }));
    return waitFor(ui, actionDescriptors, values, `Opening kvx ${kvxName}`, task);
  });
}
