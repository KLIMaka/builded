import { WindowBuilder } from "@ui/windows-common";
import { Controller3D } from "@utils/camera/controller3d";
import { GL_CONTEXT, GlContext } from "@utils/gl/drawstruct";
import { ACTION_DESCRIPTORS, ActionDescriptors, StateChecker } from "app/apis/actions";
import { APP, App } from "app/apis/app";
import { BoardContext, EMPTY_INFO_EXTENDED, EngineContext } from "app/apis/engine";
import { UI, Ui, Window } from "app/apis/ui";
import { VALUES, Values } from "app/apis/values";
import { EngineTextures } from "app/modules/gl/gl-context";
import { waitFor } from "app/modules/scheduler/ui/task-propgress";
import { ArtRaster } from "build/artraster";
import { BloodBoard } from "build/blood/structs";
import { findSector } from "build/board/query";
import { Sector, Sprite, Wall } from "build/board/structs";
import { ZSCALE, build2gl, getPlayerStart, gl2build } from "build/utils";
import { vec3 } from "gl-matrix";
import React from "react";
import { Source, ValuesContainer, disposer } from "ts-utils/callbacks";
import { getOrDefault } from "ts-utils/collections";
import { cookbook } from "ts-utils/cookbook";
import { drawToCanvas } from "ts-utils/imgutils";
import { Injector, getInstances } from "ts-utils/injector";
import { quadraticInterpolator } from "ts-utils/interpolator";
import { iter } from "ts-utils/iter";
import { int } from "ts-utils/mathutils";
import { applyNotNullish } from "ts-utils/objects";
import { fit, palRasterizer, pluTransform, transform } from "ts-utils/pixelprovider";
import { Scheduler, Task, gen } from "ts-utils/scheduler";
import { Stream } from "ts-utils/stream";
import { DelayedValue } from "ts-utils/timed";
import { Result, nil, notNull } from "ts-utils/types";
import { createBoardGlContext } from "../gl/board-context";
import { WorkplaneBuilder, WorkplaneHandlers, canvasWorkplane } from "../ui/commons";
import { Renderable } from "./api";
import { BoardRenderer3D } from "./boardRenderer3d";
import { createToRender, drawImpl } from "./draw-data";
import { getOverlay } from "./overlay";
import { createHitscan, createSelection, createSnapTarget, createTargets } from "./tools";
import { createDrawSectorTool } from "./tools/drawsector";
import { createTransform } from "./tools/transform";
import { createUtilsTool } from "./tools/utils";
import { BoardViewWindow, UtilsContext } from "./ui/board-view-ui";
import { Gizmo } from "./ui/gizmo";
import { ViewPosition } from "./view";

function createViewPosition(values: ValuesContainer, ctl: Controller3D, boardCtx: BoardContext): Source<ViewPosition> {
  let lastSector = -1;
  return values.transformedTuple('viewPosition', [ctl.getPosition(), boardCtx.data], ([pos, data]) => {
    const [x, y, z] = gl2build(vec3.create(), pos);
    const { sec, x: nx, y: ny, z: nz } = findSector(data, x, y, z, lastSector);
    lastSector = sec;
    if (x !== nx || y !== ny || z !== nz) {
      const [nnx, nny, nnz] = build2gl(vec3.create(), vec3.fromValues(nx, ny, nz));
      ctl.setPosition(nnx, nny, nnz);
    }
    return { x: int(x), y: int(y), z: int(z), sec: lastSector } as ViewPosition
  });
}

async function loadBoardContext(ctx: EngineContext, mapName: string) {
  const mapFile = await ctx.resources.get().read(mapName).then(o => o.orElseThrow(() => new Error(`Map ${mapName} not found`)));
  return ctx.loadBoard(new Stream(mapFile), mapName);
}

export async function createBoardView(injector: Injector, ctx: EngineContext, textures: EngineTextures, rendererProvider: Task<Source<BoardRenderer3D>>, mapName: string): Promise<Result<Window>> {
  const [values, app, actionDescriptors, glContext, ui] = await getInstances(injector, VALUES, APP, ACTION_DESCRIPTORS, GL_CONTEXT, UI);
  return values.create(`board-view`).initializeAsync(async localValues => {
    localValues.handleStandalone([ctx.settings], settings => {
      textures.get(settings.fontPicnum).get();
      textures.get(settings.pointPicnum).get();
    });
    const task = app.scheduler.exec(cookbook(book => {
      const boardCtx = book.recepie('Loading map', [], async () => loadBoardContext(ctx, mapName));
      const renderer = book.paste([], rendererProvider);
      const postLoad = book.paste([boardCtx], async (handle, boardCtx) => {
        const { board, parallaxPicnums } = boardCtx.data.get();
        const loadSectorTextures = (sector: Sector) => {
          textures.get(sector.ceilingpicnum, sector.ceilingstat.parallaxing ? parallaxPicnums : 1).get();
          textures.get(sector.floorpicnum, sector.floorstat.parallaxing ? parallaxPicnums : 1).get();
        }
        const loadSpriteTextures = (sprite: Sprite) => {
          textures.get(sprite.picnum).get()
          ctx.spriteVoxelSwap.get()(sprite.picnum).ifPresent(_ => textures.voxels.get()(sprite.picnum))
        }
        const loadWallTextures = (wall: Wall) => {
          textures.get(wall.picnum).get();
          textures.get(wall.overpicnum).get();
        }
        boardCtx.onSectorsChange((b, ss) => ss.forEach(s => applyNotNullish(b.board.sectors[s], loadSectorTextures)));
        boardCtx.onSpritesChange((b, ss) => ss.forEach(s => applyNotNullish(b.board.sprites[s], loadSpriteTextures)));
        boardCtx.onWallsChange((b, ws) => ws.forEach(w => applyNotNullish(b.board.walls[w], loadWallTextures)));
        const tasks = iter(board.sectors).map(s => () => loadSectorTextures(s))
          .chain(iter(board.sprites).map(s => () => loadSpriteTextures(s)))
          .chain(iter(board.walls).map(w => () => loadWallTextures(w)))
          .collect();
        await handle.waitMaybe(gen(tasks, (_, i, total) => `Preloading textures (${i}/${total})`), 'Preloading textures');
      })
      return book.recepie('Constructing window', [boardCtx, renderer, postLoad], async (boardCtx, renderer, _) =>
        createWindow(values, localValues, ctx, boardCtx, renderer, glContext, app, ui, actionDescriptors, injector));
    }));
    return waitFor(ui, actionDescriptors, values, `Opening map ${mapName}`, task);
  });
}


function createUtils(values: ValuesContainer, engine: EngineContext) {
  const rasterizer = values.transformed('pal-rasterizer', engine.pal, palRasterizer);
  const picRasterizer = values.transformedTuple('pic-rasterizer', [engine.artMap, engine.plus, rasterizer],
    ([art, plus, rasterizer]) => (picnum: number, pal: number, canvas: HTMLCanvasElement | null) => {
      if (canvas === null) return;
      const info = getOrDefault(art, picnum, EMPTY_INFO_EXTENDED);
      const plu = pluTransform(iter(plus).first(p => p.id === pal).orElse(plus[0]).plu);
      drawToCanvas(transform(fit(128, 128, new ArtRaster(info), 255), plu), notNull(canvas.getContext('2d')), rasterizer);
    });
  const picInfo = values.transformed('pic-info', engine.artMap, art => (picnum: number) => getOrDefault(art, picnum, EMPTY_INFO_EXTENDED));
  const alias = values.transformed('alias', engine.aliases, aliases => (picnum: number) => aliases.get(picnum));
  return { picRasterizer, picInfo, alias };
}

function drawOverlayImpl(gl: WebGL2RenderingContext, ...rs: Renderable[]) {
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  rs.forEach(r => r.render(gl));
  gl.disable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
}

async function saveBoard(engine: EngineContext, boardCtx: BoardContext, ui: Ui, actionDescriptors: ActionDescriptors, values: Values, scheduler: Scheduler) {
  await waitFor(ui, actionDescriptors, values, "Save", scheduler.exec(async handle => {
    const writable = await engine.resources.get().writable();
    writable.ifPresent(async fs => fs.write(boardCtx.name ?? '', await boardCtx.save()))
  }));
}

function createWindow(values: Values, localValues: ValuesContainer, engine: EngineContext, boardCtx: BoardContext, renderer: Source<BoardRenderer3D>, glContext: GlContext, app: App, ui: Ui, actionDescriptors: ActionDescriptors, injector: Injector): Window {
  localValues.handleStandalone([renderer, localValues.field('parallaxPicnums', boardCtx.data, "parallaxPicnums")], ([renderer, parallaxPicnums]) => {
    renderer.depthShadowScale(1024);
    renderer.parallaxPics(parallaxPicnums);
  })
  const boardGlCtx = createBoardGlContext(localValues, glContext, boardCtx);
  const { board } = boardCtx.data.get();

  const sprite = getPlayerStart(board);
  const ctl = new Controller3D(localValues.createChild('camera'));

  const [posx, posy, posz] = build2gl(vec3.create(), vec3.fromValues(sprite.x, sprite.y, sprite.z));
  ctl.setPosition(posx, posy, posz);
  const viewPosition = createViewPosition(localValues.createChild('viewPosition'), ctl, boardCtx);
  const hitscan = createHitscan(localValues.createChild('hitscan'), ctl, viewPosition, engine.artMap, boardCtx);
  const targets = createTargets(localValues.createChild('targets'), hitscan);
  const snapTarget = createSnapTarget(localValues.createChild('snapTargets'), hitscan, boardCtx);
  // const entity = createEntity(values, targets);
  const entity = localValues.field('entyty', snapTarget, 'entity');
  const selection = createSelection(localValues.createChild('selection'), entity, boardCtx, engine);
  const moveState = localValues.value('move-state', false);
  const verticalState = localValues.value('vertical-state', false);
  const parallelState = localValues.value('parallel-state', false);
  const transform = createTransform(localValues.createChild('transform'), ctl, moveState, parallelState, verticalState, hitscan, selection, renderer);

  const vis = localValues.value('vis', (board as BloodBoard).visibility ?? 512);
  const shadowOff = localValues.value('shadow-mod', 0);
  localValues.handleStandalone([vis, renderer], ([vis, renderer]) => renderer.globalVis(vis));
  localValues.handleStandalone([shadowOff, renderer], ([shadow, renderer]) => renderer.globalShadow(shadow));
  localValues.handleStandalone([boardCtx.grid.size, renderer], ([gridSize, renderer]) => renderer.grid(gridSize));


  const toRender = createToRender(renderer, boardCtx, boardGlCtx, engine, localValues.createChild('renderer'), viewPosition, ctl.camera.forward);
  const overlay = localValues.transformedTuple('overlay', [entity, boardCtx.data, engine.settings, renderer, engine.aliases, engine.artMap], getOverlay(boardGlCtx), { disposer: disposer() })
  const utils = createUtils(localValues.createChild('utils'), engine);
  const drawSectorTool = createDrawSectorTool(localValues.createChild('drawSectorTool'), ctl, renderer, engine.settings, hitscan, boardCtx, engine);
  const utilsTool = createUtilsTool(boardCtx, selection, hitscan, engine, ctl, injector);

  const canvasValue = localValues.valueBuilder<HTMLCanvasElement | undefined>({ name: 'canvasValue', value: undefined });
  const boardView = canvasWorkplane((canvas, w, h) => {
    canvasValue.set(canvas);
    ctl.setSize(w, h);
    return () => canvasValue.set(undefined);
  });

  const pos = localValues.value('pos', vec3.create());
  const overlayView: WorkplaneBuilder = (width, height, key) => {
    const handlers: WorkplaneHandlers = {
      handleMouseMove: e => ctl.track(e.offsetX, e.offsetY, (e.buttons & 2) !== 0),
      handleClick: _ => {
        const e = entity.get();
        if (e.isSprite()) {
          const spr = boardCtx.data.get().board.sprites[e.id];
          pos.set(vec3.fromValues(spr.x, spr.z / ZSCALE, spr.y));
        }
      },
      handleWheel: nil(),
      handleMouseButton: nil(),
    }
    return <Gizmo
      width={width}
      height={height}
      projection={ctl.projection}
      camPos={ctl.camera.position}
      transform={ctl.camera.transform}
      pos={pos} key={key}
      handlers={handlers} />
  };


  const actionsCtx = actionDescriptors.sub('board-view');
  const bind = (name: string) => actionsCtx.get(name).bind().get();
  const inter = quadraticInterpolator(0.8);
  const forwardDamper = new DelayedValue(250, 0, inter, app.timer.now);
  const backDamper = new DelayedValue(250, 0, inter, app.timer.now);
  const leftDamper = new DelayedValue(250, 0, inter, app.timer.now);
  const rightDamper = new DelayedValue(250, 0, inter, app.timer.now);
  const states: StateChecker[] = [
    { bind: bind('forward'), action: s => forwardDamper.set(s ? 1 : 0) },
    { bind: bind('back'), action: s => backDamper.set(s ? -1 : 0) },
    { bind: bind('strife-left'), action: s => leftDamper.set(s ? -1 : 0) },
    { bind: bind('strife-right'), action: s => rightDamper.set(s ? 1 : 0) },
    { bind: bind('move'), action: s => moveState.set(s) },
    { bind: bind('move-vertical'), action: s => verticalState.set(s) },
    { bind: bind('move-parallel'), action: s => parallelState.set(s) },
  ];

  const gl = glContext.gl;
  const draw = localValues.transformedTuple('draw', [engine.blends, toRender, ctl.camera.transform, renderer],
    ([blends, data, view, renderer]) => () => drawImpl(renderer, gl, blends, view, data, view));

  const redrawProc = localValues.transformedTuple('redraw', [ctl.size, ctl.projection, canvasValue, renderer, draw, overlay, drawSectorTool.renderable, transform],
    ([size, projection, canvas, renderer, draw, overlay, renderable, transform]) => () => {
      if (!canvas) return;

      const [width, height] = size;
      const { offscreen } = glContext;
      offscreen.width = width;
      offscreen.height = height;

      renderer.screenSize(width, height);
      renderer.time(app.timer.now() % 10000.0);
      renderer.projection(projection);

      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 1.0);
      gl.clearDepth(1);
      gl.clearStencil(0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

      draw();
      drawOverlayImpl(gl, overlay, renderable, transform);

      canvas
        ?.getContext('bitmaprenderer')
        ?.transferFromImageBitmap(offscreen.transferToImageBitmap());
    });

  const updateMovement = app.timer.onFrame(dt => {
    ctl.moveForward((forwardDamper.get() + backDamper.get()) * 5 * dt);
    ctl.moveSideway((leftDamper.get() + rightDamper.get()) * 5 * dt);
  })
  const redrawTask = app.timer.onFrame(_ => redrawProc.get()());
  redrawTask.onError(e => app.logger.log('ERROR', e));
  updateMovement.start();
  redrawTask.start();

  const actionsFactory = (desc: ActionDescriptors) => {
    return [
      desc.bindSync('undo', () => boardCtx.undo()),
      desc.bindSync('grid-inc', () => boardCtx.grid.incGridSize()),
      desc.bindSync('grid-dec', () => boardCtx.grid.decGridSize()),
      desc.bind('save', async () => saveBoard(engine, boardCtx, ui, actionDescriptors, values, app.scheduler)),
      ...drawSectorTool.registerActions(desc),
      ...utilsTool.registerActions(desc)
    ];
  }

  return new WindowBuilder('board-view', actionDescriptors, localValues)
    .title(boardCtx.name ?? '')
    .size(800, 600)
    .minSize(400, 400)
    .action('vis_inc', () => vis.mod(v => v * 2))
    .action('vis_dec', () => vis.mod(v => v / 2))
    .action('shadow_off_dec', () => shadowOff.mod(o => o - 1))
    .action('shadow_off_inc', () => shadowOff.mod(o => o + 1))
    .actionsFactory(actionsFactory)
    .states(states)
    .disposable(redrawTask)
    .disposable(updateMovement)
    .disposable(localValues)
    .disposable(boardCtx)
    .disposable(boardGlCtx)
    .build(
      <UtilsContext.Provider value={{ ...utils, viewPosition, boardCtx, engine }}>
        <BoardViewWindow
          builders={[boardView, overlayView]}
          states={states}
          board={localValues.field('board', boardCtx.data, 'board')}
          ent={entity}
          ctl={ctl}
        />
      </UtilsContext.Provider>)
}

